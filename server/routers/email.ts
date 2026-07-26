import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { isEmailConfigured, sendQuoteEmail } from "../email";
import { storageGet } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Send-to-Customer — emails the finalized quotation PDF with a
 * customizable subject/message, and keeps a full audit log per quote.
 */
export const emailRouter = router({
  /** Whether SMTP credentials are configured (drives UI state). */
  isConfigured: protectedProcedure.query(() => ({ configured: isEmailConfigured() })),

  /** Email history for a quote. */
  history: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .query(({ input }) => db.getQuoteEmailLog(input.quoteId)),

  /** Send the finalized quotation PDF to the customer. */
  sendQuote: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        to: z.string().email(),
        cc: z.string().email().optional().or(z.literal("")).transform(v => (v ? v : undefined)),
        subject: z.string().min(1).max(500),
        message: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (quote.status !== "finalized" || !quote.generatedPdfKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The quotation must be finalized (PDF generated) before it can be emailed.",
        });
      }

      // Fetch the stored PDF bytes via a presigned URL
      const { url } = await storageGet(quote.generatedPdfKey);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not retrieve the stored quotation PDF." });
      }
      const pdfBuffer = Buffer.from(await resp.arrayBuffer());
      const filename = `Quotation-${quote.salesforceQuoteNumber ?? quote.id}.pdf`;

      try {
        await sendQuoteEmail({
          to: input.to,
          cc: input.cc,
          subject: input.subject,
          message: input.message,
          attachment: { filename, content: pdfBuffer },
        });
        await db.logQuoteEmail({
          quoteId: input.quoteId,
          sentBy: ctx.user.id,
          toEmail: input.to,
          ccEmail: input.cc,
          subject: input.subject,
          message: input.message,
          status: "sent",
        });
        await db.updateQuote(input.quoteId, {
          lastSentAt: new Date(),
          lastSentTo: input.to,
        });
        return { success: true };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await db.logQuoteEmail({
          quoteId: input.quoteId,
          sentBy: ctx.user.id,
          toEmail: input.to,
          ccEmail: input.cc,
          subject: input.subject,
          message: input.message,
          status: "failed",
          errorDetail: detail,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email failed to send: ${detail}` });
      }
    }),
});
