import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { fetchLiveRates } from "../exchangeRate";
import { extractQuoteFromPdf } from "../extraction";
import { calculateCosting, type PricingModel } from "../pricing";
import { getSupplierCommission } from "../commission";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

function sanitizeSegment(s: string): string {
  return (s || "uncategorised").replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "uncategorised";
}

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  listUnitPrice: z.number(),
  discountPct: z.number().nullable().optional(),
});

export const quotesRouter = router({
  // ------------------------------------------------------------------
  // Suppliers
  // ------------------------------------------------------------------
  suppliers: protectedProcedure.query(() => db.listSuppliers()),

  // ------------------------------------------------------------------
  // Step 1: Upload supplier PDF → S3, create draft quote, AI extraction
  // ------------------------------------------------------------------
  uploadAndExtract: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        // Optional companion files
        docxFileName: z.string().optional(),
        docxFileBase64: z.string().optional(),
        xlsFileName: z.string().optional(),
        xlsFileBase64: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 25 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds 25MB limit" });
      }
      // Determine file type from extension
      const ext = input.fileName.split(".").pop()?.toLowerCase() || "pdf";
      const mimeMap: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel" };
      const mime = mimeMap[ext] || "application/octet-stream";

      // Store the primary supplier file
      const key = `supplier-quotes/incoming/${Date.now()}-${sanitizeSegment(input.fileName)}`;
      const { key: storedKey, url } = await storagePut(key, buffer, mime);

      // Store optional companion DOCX
      let docxData: { key?: string; url?: string; name?: string } = {};
      if (input.docxFileBase64 && input.docxFileName) {
        const docxBuf = Buffer.from(input.docxFileBase64, "base64");
        const docxKey = `supplier-quotes/incoming/${Date.now()}-${sanitizeSegment(input.docxFileName)}`;
        const docxResult = await storagePut(docxKey, docxBuf, mimeMap["docx"]);
        docxData = { key: docxResult.key, url: docxResult.url, name: input.docxFileName };
      }

      // Store optional companion XLS/XLSX
      let xlsData: { key?: string; url?: string; name?: string } = {};
      if (input.xlsFileBase64 && input.xlsFileName) {
        const xlsBuf = Buffer.from(input.xlsFileBase64, "base64");
        const xlsExt = input.xlsFileName.split(".").pop()?.toLowerCase() || "xlsx";
        const xlsKey = `supplier-quotes/incoming/${Date.now()}-${sanitizeSegment(input.xlsFileName)}`;
        const xlsResult = await storagePut(xlsKey, xlsBuf, mimeMap[xlsExt] || mimeMap["xlsx"]);
        xlsData = { key: xlsResult.key, url: xlsResult.url, name: input.xlsFileName };
      }

      // Create the draft quote record first so failures are traceable
      const quoteId = await db.createQuote({
        createdBy: ctx.user.id,
        status: "draft",
        supplierPdfKey: storedKey,
        supplierPdfUrl: url,
        supplierPdfName: input.fileName,
        supplierDocxKey: docxData.key,
        supplierDocxUrl: docxData.url,
        supplierDocxName: docxData.name,
        supplierXlsKey: xlsData.key,
        supplierXlsUrl: xlsData.url,
        supplierXlsName: xlsData.name,
        quoteDate: new Date().toLocaleDateString("en-AU"),
      });
      // A brand-new quote is the root of its own revision family (Rev A)
      await db.updateQuote(quoteId, { rootQuoteId: quoteId });

      // AI extraction — send the PDF bytes inline as a base64 data URL
      // (storage URLs are relative proxy paths the LLM backend cannot fetch)
      const extracted = await extractQuoteFromPdf(buffer, input.fileName);

      // Match supplier to configuration
      const allSuppliers = await db.listSuppliers();
      const nameLc = extracted.supplier_name.toLowerCase();
      const matched = allSuppliers.find(s => {
        const parts = s.name.toLowerCase().split("/").map(p => p.trim());
        return parts.some(p => nameLc.includes(p) || p.includes(nameLc));
      });

      await db.updateQuote(quoteId, {
        status: "extracted",
        supplierId: matched?.id,
        supplierName: matched?.name ?? extracted.supplier_name,
        supplierQuoteRef: extracted.supplier_quote_number,
        supplierCurrency: extracted.currency,
        // Prefer the discount stated on the quote; fall back to the supplier's configured default
        distributionDiscountPct:
          extracted.distribution_discount_pct?.toString() ??
          (matched?.defaultDiscountPct ? matched.defaultDiscountPct.toString() : undefined),
        customerName: extracted.customer_name ?? undefined,
        customerContact: extracted.customer_contact ?? undefined,
        customerAddress: extracted.customer_address ?? undefined,
       productCategory: extracted.product_name,
       productDescription: extracted.product_description,
        technicalDetails: extracted.technical_details || undefined,
       supplierTerms: extracted.supplier_terms_summary ?? undefined,
        footerPricingNote: extracted.footer_pricing_note ?? undefined,
        paymentTerms: extracted.payment_terms ?? undefined,
        deliveryTerms: extracted.delivery_terms ?? undefined,
        warrantyTerms: extracted.warranty_terms ?? undefined,
      });

      await db.replaceQuoteLineItems(
        quoteId,
        extracted.line_items.map((li, idx) => ({
          quoteId,
          position: idx,
          description: li.description,
          quantity: li.quantity.toString(),
          listUnitPrice: li.unit_price.toString(),
          discountPct: li.discount_pct?.toString(),
        })),
      );

      return {
        quoteId,
        extracted,
        matchedSupplier: matched ?? null,
        supplierDefaults: getSupplierDefaults(matched?.name ?? extracted.supplier_name),
      };
    }),

  // ------------------------------------------------------------------
  // Step 2: Live exchange rates (fetch only — confirmation is separate)
  // ------------------------------------------------------------------
  fetchRates: protectedProcedure.query(async () => fetchLiveRates()),

  confirmRate: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        pair: z.enum(["AUD/EUR", "AUD/USD", "AUD/AUD", "AUD/NZD", "AUD/GBP"]),
        rate: z.number().positive(),
        source: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateQuote(input.quoteId, {
        exchangeRate: input.rate.toString(),
        exchangeRateConfirmed: 1,
        exchangeRateSource: input.source,
        rateConfirmedBy: ctx.user.id,
        rateConfirmedByName: ctx.user.name ?? `User #${ctx.user.id}`,
        rateConfirmedAt: new Date(),
      });
      await db.logExchangeRate({
        quoteId: input.quoteId,
        pair: input.pair,
        rate: input.rate.toString(),
        source: input.source,
        confirmedBy: ctx.user.id,
        confirmedAt: new Date(),
      });
      return { success: true };
    }),

  // ------------------------------------------------------------------
  // Step 3: Costing calculation (requires confirmed exchange rate)
  // ------------------------------------------------------------------
  calculateCosting: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        marginPct: z.number().min(0).max(99),
        lineItems: z.array(lineItemSchema),
        distributionDiscountPct: z.number().nullable().optional(),
        footerIndicatesNet: z.boolean().nullable().optional(),
        freightCostAud: z.number().min(0).default(0),
        installationCostAud: z.number().min(0).default(0),
        otherLocalCostAud: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (!quote.exchangeRateConfirmed || !quote.exchangeRate) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Exchange rate must be fetched and explicitly confirmed before costing can be applied.",
        });
      }
      const supplier = quote.supplierId ? await db.getSupplierById(quote.supplierId) : undefined;
      const pricingModel: PricingModel = (supplier?.pricingModel as PricingModel) ?? "as_is";

      // Look up supplier commission from authoritative table
      const commission = quote.supplierName ? getSupplierCommission(quote.supplierName) : null;

      const result = calculateCosting({
        lineItems: input.lineItems,
        pricingModel,
        distributionDiscountPct: input.distributionDiscountPct,
        footerIndicatesNet: input.footerIndicatesNet,
        marginPct: input.marginPct,
        exchangeRate: Number(quote.exchangeRate),
        currency: (quote.supplierCurrency as "EUR" | "USD" | "AUD" | "NZD" | "GBP") ?? "EUR",
        currencyMarkdownPct: 2,
        freightCostAud: input.freightCostAud,
        installationCostAud: input.installationCostAud,
        otherLocalCostAud: input.otherLocalCostAud,
      });

      // Calculate commission amount for audit
      const commissionPct = commission?.commissionPct ?? 0;
      const commissionAmount = result.totalCostForeign * (commissionPct / 100);

      await db.updateQuote(input.quoteId, {
        status: "costed",
        marginPct: input.marginPct.toString(),
        distributionDiscountPct: input.distributionDiscountPct?.toString(),
        freightCostAud: result.freightCostAud.toString(),
        installationCostAud: result.installationCostAud.toString(),
        otherLocalCostAud: result.otherLocalCostAud.toString(),
        totalCostForeign: result.totalCostForeign.toString(),
        totalSellForeign: result.totalSellForeign.toString(),
        totalSellAud: result.totalSellAud.toString(),
        grandTotalAud: result.grandTotalAud.toString(),
      });

      await db.replaceQuoteLineItems(
        input.quoteId,
        result.lineItems.map((li, idx) => ({
          quoteId: input.quoteId,
          position: idx,
          description: li.description,
          quantity: li.quantity.toString(),
          listUnitPrice: li.listUnitPrice.toString(),
          discountPct: li.discountPct?.toString(),
          netUnitCost: li.netUnitCost.toString(),
          sellUnitPrice: li.sellUnitPrice.toString(),
          sellTotalPrice: li.sellTotalPrice.toString(),
        })),
      );

      return {
        ...result,
        commissionPct,
        commissionAmount: Math.round((commissionAmount + Number.EPSILON) * 100) / 100,
        commissionSupplier: commission?.supplierName ?? null,
      };
    }),

  // ------------------------------------------------------------------
  // Step 4: Update quote details (header fields, terms)
  // ------------------------------------------------------------------
  updateDetails: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        customerName: z.string().optional(),
        customerContact: z.string().optional(),
        customerAddress: z.string().optional(),
       productCategory: z.string().optional(),
       productDescription: z.string().optional(),
        technicalDetails: z.string().optional(),
       quoteDate: z.string().optional(),
        supplierQuoteRef: z.string().optional(),
        paymentTerms: z.string().optional(),
        deliveryTerms: z.string().optional(),
        warrantyTerms: z.string().optional(),
        validityDays: z.number().optional(),
        supplierTerms: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { quoteId, ...fields } = input;
      const quote = await db.getQuoteById(quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateQuote(quoteId, fields);
      return { success: true };
    }),

  // ------------------------------------------------------------------
  // Step 5: Salesforce quotation number (manual entry, mandatory)
  // ------------------------------------------------------------------
  setSalesforceNumber: protectedProcedure
    .input(z.object({ quoteId: z.number(), salesforceQuoteNumber: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateQuote(input.quoteId, {
        salesforceQuoteNumber: input.salesforceQuoteNumber.trim(),
        status: "awaiting_sf_number",
      });
      return { success: true };
    }),

  // ------------------------------------------------------------------
  // Queries: history dashboard, quote detail
  // ------------------------------------------------------------------
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.string().optional(),
          supplierName: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => db.listQuotes(input ?? {})),

  get: protectedProcedure.input(z.object({ quoteId: z.number() })).query(async ({ input }) => {
    const quote = await db.getQuoteById(input.quoteId);
    if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
    const lineItems = await db.getQuoteLineItems(input.quoteId);
    const supplier = quote.supplierId ? await db.getSupplierById(quote.supplierId) : undefined;
    return { quote, lineItems, supplier: supplier ?? null };
  }),

  delete: protectedProcedure.input(z.object({ quoteId: z.number() })).mutation(async ({ input }) => {
    await db.deleteQuote(input.quoteId);
    return { success: true };
  }),
});
import { getSupplierDefaults } from "../supplierReference";
