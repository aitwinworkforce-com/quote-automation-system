import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const round2 = (n: number) => Math.round(n * 100) / 100;

const editedItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  listUnitPrice: z.number().nullable().optional(),
  netUnitCost: z.number().nullable().optional(),
  sellUnitPrice: z.number().min(0),
});

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
        /** Optional edited line items — replaces the straight clone when provided. */
        items: z.array(editedItemSchema).min(1).optional(),
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

      if (input.items && input.items.length > 0) {
        // Edited line items supplied — write them and recompute quote totals
        await db.replaceQuoteLineItems(
          newQuoteId,
          input.items.map((li, idx) => ({
            quoteId: newQuoteId,
            position: idx,
            description: li.description,
            quantity: li.quantity.toString(),
            listUnitPrice: li.listUnitPrice != null ? li.listUnitPrice.toString() : null,
            discountPct: null,
            netUnitCost: li.netUnitCost != null ? li.netUnitCost.toString() : null,
            sellUnitPrice: li.sellUnitPrice.toString(),
            sellTotalPrice: round2(li.quantity * li.sellUnitPrice).toString(),
          })),
        );
        const totalSellForeign = round2(
          input.items.reduce((s, li) => s + li.quantity * li.sellUnitPrice, 0),
        );
        const totalCostForeign = round2(
          input.items.reduce((s, li) => s + li.quantity * (li.netUnitCost ?? 0), 0),
        );
        const rate = Number(original.exchangeRate) || 0;
        // Rate is AUD→foreign (e.g. 0.61 EUR per AUD), so AUD = foreign / rate.
        const totalSellAud =
          original.supplierCurrency === "AUD" || !rate
            ? totalSellForeign
            : round2(totalSellForeign / rate);
        const grandTotalAud = round2(
          totalSellAud +
            Number(original.freightCostAud ?? 0) +
            Number(original.installationCostAud ?? 0) +
            Number(original.otherLocalCostAud ?? 0),
        );
        await db.updateQuote(newQuoteId, {
          totalCostForeign: totalCostForeign.toString(),
          totalSellForeign: totalSellForeign.toString(),
          totalSellAud: totalSellAud.toString(),
          grandTotalAud: grandTotalAud.toString(),
        });
      } else {
        // No edits — clone line items as-is
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
      }

      // The new revision becomes the latest for the family
      await db.clearLatestRevisionFlag(rootId);
      await db.updateQuote(newQuoteId, { isLatestRevision: 1 });

      return { newQuoteId, revisionLabel: newLabel };
    }),

  /** Submit a costed quote for manager review. */
  submitForReview: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["costed", "awaiting_sf_number"].includes(quote.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only costed quotes can be submitted for review.",
        });
      }
      await db.updateQuote(input.quoteId, {
        status: "in_review",
        submittedForReviewAt: new Date(),
        submittedForReviewBy: ctx.user.id,
      });
      return { success: true };
    }),

  /** Approve a quote in review (manager/admin only). */
  approve: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only managers (admin role) can approve quotes." });
      }
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (quote.status !== "in_review") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Quote is not in review." });
      }
      await db.updateQuote(input.quoteId, {
        // Approved: continue to finalisation, or straight to finalized if the PDF already exists
        status: quote.salesforceQuoteNumber && quote.generatedPdfUrl ? "finalized" : "awaiting_sf_number",
        approvedAt: new Date(),
        approvedBy: ctx.user.id,
        approvedByName: ctx.user.name ?? `User #${ctx.user.id}`,
      });
      return { success: true };
    }),
});
