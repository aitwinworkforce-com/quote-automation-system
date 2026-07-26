import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Quote versioning — revision tracking.
 * "Create revision" clones an existing quote (header, costing, line items)
 * into a new draft linked to the original via rootQuoteId/parentQuoteId,
 * with an incremented revision label (A → B → C ...). The full chain is
 * queryable so every iteration remains auditable.
 */

function nextRevisionLabel(current: string): string {
  // A → B → ... → Z → AA → AB ...
  const chars = current.toUpperCase().split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    i--;
  }
  return "A" + chars.join("");
}

export const revisionsRouter = router({
  /** Full revision chain for a quote's family, oldest first. */
  chain: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .query(async ({ input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      const rootId = quote.rootQuoteId ?? quote.id;
      const revisions = await db.getQuoteRevisions(rootId);
      return revisions.map(r => ({
        id: r.id,
        revisionLabel: r.revisionLabel,
        status: r.status,
        salesforceQuoteNumber: r.salesforceQuoteNumber,
        grandTotalAud: r.grandTotalAud,
        isLatestRevision: r.isLatestRevision,
        revisionNote: r.revisionNote,
        createdAt: r.createdAt,
      }));
    }),

  /** Clone a quote into a new linked revision. */
  create: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const original = await db.getQuoteById(input.quoteId);
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const rootId = original.rootQuoteId ?? original.id;
      const family = await db.getQuoteRevisions(rootId);
      // Highest existing label in the family determines the next one
      const labels = family.map(f => f.revisionLabel || "A");
      const highest = labels.sort((a, b) => (a.length - b.length) || a.localeCompare(b)).pop() ?? "A";
      const newLabel = nextRevisionLabel(highest);

      // Clone the quote row (reset finalization + email state)
      const {
        id: _id,
        createdAt: _c,
        updatedAt: _u,
        ...rest
      } = original;
      const newQuoteId = await db.createQuote({
        ...rest,
        createdBy: ctx.user.id,
        status: "costed",
        salesforceQuoteNumber: null,
        generatedPdfKey: null,
        generatedPdfUrl: null,
        lastSentAt: null,
        lastSentTo: null,
        parentQuoteId: original.id,
        rootQuoteId: rootId,
        revisionLabel: newLabel,
        isLatestRevision: 1,
        revisionNote: input.note ?? null,
        quoteDate: new Date().toLocaleDateString("en-AU"),
      });

      // Clone line items
      const items = await db.getQuoteLineItems(original.id);
      await db.replaceQuoteLineItems(
        newQuoteId,
        items.map((li, idx) => ({
          quoteId: newQuoteId,
          position: idx,
          description: li.description,
          quantity: li.quantity,
          listUnitPrice: li.listUnitPrice,
          discountPct: li.discountPct,
          netUnitCost: li.netUnitCost,
          sellUnitPrice: li.sellUnitPrice,
          sellTotalPrice: li.sellTotalPrice,
        })),
      );

      // The new revision becomes the latest for the family
      await db.clearLatestRevisionFlag(rootId);
      await db.updateQuote(newQuoteId, { isLatestRevision: 1 });

      return { newQuoteId, revisionLabel: newLabel };
    }),
});
