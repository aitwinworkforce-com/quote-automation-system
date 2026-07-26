import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { generateQuotePdf } from "../pdfGenerator";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

function sanitizeSegment(s: string): string {
  return (s || "uncategorised").replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "uncategorised";
}

export const pdfRouter = router({
  /**
   * Final step: generate the Oestergaard-branded quote PDF.
   * Preconditions enforced:
   *  - costing complete (exchange rate confirmed + totals present)
   *  - Salesforce quotation number manually entered by the user
   * The generated PDF is stored organised by customer / product category.
   */
  generateQuote: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .mutation(async ({ input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (!quote.salesforceQuoteNumber) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The Salesforce quotation number must be entered before the final PDF can be generated.",
        });
      }
      if (!quote.exchangeRateConfirmed || !quote.grandTotalAud) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Costing must be completed (with a confirmed exchange rate) before generating the PDF.",
        });
      }
      const lineItems = await db.getQuoteLineItems(input.quoteId);

      const pdfBuffer = await generateQuotePdf(quote, lineItems);

      // Organised storage: quotes/{customer}/{product-category}/Quotation-{SF#}.pdf
      const customerSeg = sanitizeSegment(quote.customerName ?? "unknown-customer");
      const categorySeg = sanitizeSegment(quote.productCategory ?? "general");
      const fileKey = `quotes/${customerSeg}/${categorySeg}/Quotation-${sanitizeSegment(quote.salesforceQuoteNumber)}.pdf`;
      const { key, url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      await db.updateQuote(input.quoteId, {
        status: "finalized",
        generatedPdfKey: key,
        generatedPdfUrl: url,
      });

      return { url, key };
    }),
});
