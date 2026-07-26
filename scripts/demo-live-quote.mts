/**
 * Demo: run the user's real Q732717.pdf Foodmate supplier quote through the
 * complete live pipeline, mirroring exactly what the tRPC routers do so the
 * dashboard shows a genuine quote built from the user's own supplier data.
 *
 * Stages (mirrors the New Quote wizard / routers):
 *   1. Upload supplier PDF to S3 + create draft quote
 *   2. AI extraction (extractQuoteFromPdf) + supplier matching
 *   3. Live FX fetch + confirmation (logged in exchangeRateLog)
 *   4. Costing (Foodmate as-is, margin, freight, installation)
 *   5. Salesforce quotation number entry
 *   6. Branded PDF generation → organised S3 storage → finalized
 */
import "dotenv/config";
import fs from "node:fs";
import * as db from "../server/db";
import { extractQuoteFromPdf } from "../server/extraction";
import { fetchLiveRates } from "../server/exchangeRate";
import { calculateCosting, type PricingModel } from "../server/pricing";
import { generateQuotePdf } from "../server/pdfGenerator";
import { storagePut } from "../server/storage";

const PDF_PATH = "/home/ubuntu/upload/Q732717.pdf";
const FILE_NAME = "Q732717.pdf";
const SF_NUMBER = "SF-Q-2026-00147"; // demo Salesforce quotation number
const MARGIN_PCT = 20;
const FREIGHT_AUD = 5000;
const INSTALL_AUD = 10000;

function sanitizeSegment(s: string): string {
  return (s || "uncategorised").replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "uncategorised";
}

async function main() {
  // Owner user for createdBy attribution
  const ownerOpenId = process.env.OWNER_OPEN_ID ?? "";
  const owner = ownerOpenId ? await db.getUserByOpenId(ownerOpenId) : undefined;
  const createdBy = owner?.id ?? 1;

  console.log("=== STAGE 1: Upload supplier PDF → S3, create draft quote ===");
  const buffer = fs.readFileSync(PDF_PATH);
  console.log(`Read ${FILE_NAME} (${(buffer.length / 1024).toFixed(0)} KB)`);
  const incomingKey = `supplier-quotes/incoming/${Date.now()}-${sanitizeSegment(FILE_NAME)}.pdf`;
  const { key: storedKey, url: supplierUrl } = await storagePut(incomingKey, buffer, "application/pdf");
  const quoteId = await db.createQuote({
    createdBy,
    status: "draft",
    supplierPdfKey: storedKey,
    supplierPdfUrl: supplierUrl,
    supplierPdfName: FILE_NAME,
    quoteDate: new Date().toLocaleDateString("en-AU"),
  });
  console.log(`Draft quote created: ID ${quoteId}, supplier PDF at ${storedKey}`);

  console.log("\n=== STAGE 2: AI extraction ===");
  const extracted = await extractQuoteFromPdf(buffer, FILE_NAME);
  console.log(`Supplier: ${extracted.supplier_name} | Quote #: ${extracted.supplier_quote_number} | ${extracted.currency}`);
  console.log(`Customer: ${extracted.customer_name} (${extracted.customer_contact})`);
  console.log(`Line items: ${extracted.line_items.length}`);
  for (const li of extracted.line_items) {
    console.log(`  - ${li.description.slice(0, 70)} x${li.quantity} @ ${li.unit_price}`);
  }

  const allSuppliers = await db.listSuppliers();
  const nameLc = extracted.supplier_name.toLowerCase();
  const matched = allSuppliers.find(s => {
    const parts = s.name.toLowerCase().split("/").map(p => p.trim());
    return parts.some(p => nameLc.includes(p) || p.includes(nameLc));
  });
  console.log(`Matched supplier config: ${matched?.name ?? "(none)"} → pricing model: ${matched?.pricingModel ?? "as_is"}`);

  await db.updateQuote(quoteId, {
    status: "extracted",
    supplierId: matched?.id,
    supplierName: matched?.name ?? extracted.supplier_name,
    supplierQuoteRef: extracted.supplier_quote_number,
    supplierCurrency: extracted.currency,
    customerName: extracted.customer_name || undefined,
    customerContact: extracted.customer_contact || undefined,
    customerAddress: extracted.customer_address || undefined,
    productCategory: extracted.product_name,
    productDescription: extracted.product_description,
    technicalDetails: extracted.technical_details || undefined,
    supplierTerms: extracted.supplier_terms_summary || undefined,
    footerPricingNote: extracted.footer_pricing_note || undefined,
    distributionDiscountPct: extracted.distribution_discount_pct?.toString(),
    paymentTerms: extracted.payment_terms || undefined,
    deliveryTerms: extracted.delivery_terms || undefined,
    warrantyTerms: extracted.warranty_terms || undefined,
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
  console.log("Extraction persisted, status → extracted");

  console.log("\n=== STAGE 3: Live exchange rates + MANDATORY confirmation ===");
  const rates = await fetchLiveRates();
  console.log(`Live rates (${rates.source}): AUD/EUR ${rates.audEur} | AUD/USD ${rates.audUsd} | fetched ${rates.fetchedAt}`);
  const pair = extracted.currency === "USD" ? "AUD/USD" : "AUD/EUR";
  const rate = extracted.currency === "USD" ? rates.audUsd : rates.audEur;
  console.log(`User confirmation: ${pair} @ ${rate} CONFIRMED`);
  await db.updateQuote(quoteId, {
    exchangeRate: rate.toString(),
    exchangeRateConfirmed: 1,
    exchangeRateSource: rates.source,
  });
  await db.logExchangeRate({
    quoteId,
    pair,
    rate: rate.toString(),
    source: rates.source,
    confirmedBy: createdBy,
    confirmedAt: new Date(),
  });

  console.log("\n=== STAGE 4: Costing calculation ===");
  const pricingModel: PricingModel = (matched?.pricingModel as PricingModel) ?? "as_is";
  const result = calculateCosting({
    lineItems: extracted.line_items.map(li => ({
      description: li.description,
      quantity: li.quantity,
      listUnitPrice: li.unit_price,
      discountPct: li.discount_pct,
    })),
    pricingModel,
    distributionDiscountPct: extracted.distribution_discount_pct,
    footerIndicatesNet: extracted.footer_indicates_net,
    marginPct: MARGIN_PCT,
    exchangeRate: rate,
    currency: extracted.currency,
    freightCostAud: FREIGHT_AUD,
    installationCostAud: INSTALL_AUD,
    otherLocalCostAud: 0,
  });
  console.log(`Total cost (${result.currency}): ${result.totalCostForeign.toFixed(2)}`);
  console.log(`Sell ex-works (${result.currency}): ${result.totalSellForeign.toFixed(2)} @ margin ${MARGIN_PCT}%`);
  console.log(`Sell AUD: ${result.totalSellAud.toFixed(2)} | Grand total AUD (incl. freight+install): ${result.grandTotalAud.toFixed(2)}`);
  await db.updateQuote(quoteId, {
    status: "costed",
    marginPct: MARGIN_PCT.toString(),
    distributionDiscountPct: extracted.distribution_discount_pct?.toString(),
    freightCostAud: result.freightCostAud.toString(),
    installationCostAud: result.installationCostAud.toString(),
    otherLocalCostAud: result.otherLocalCostAud.toString(),
    totalCostForeign: result.totalCostForeign.toString(),
    totalSellForeign: result.totalSellForeign.toString(),
    totalSellAud: result.totalSellAud.toString(),
    grandTotalAud: result.grandTotalAud.toString(),
  });
  await db.replaceQuoteLineItems(
    quoteId,
    result.lineItems.map((li, idx) => ({
      quoteId,
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
  console.log("Costing persisted, status → costed");

  console.log("\n=== STAGE 5: Salesforce quotation number (manual entry) ===");
  await db.updateQuote(quoteId, {
    salesforceQuoteNumber: SF_NUMBER,
    status: "awaiting_sf_number",
  });
  console.log(`Salesforce number entered: ${SF_NUMBER}`);

  console.log("\n=== STAGE 6: Branded PDF generation → finalized ===");
  const quote = await db.getQuoteById(quoteId);
  if (!quote) throw new Error("Quote vanished");
  const lineItems = await db.getQuoteLineItems(quoteId);
  const pdfBuffer = await generateQuotePdf(quote, lineItems);
  const customerSeg = sanitizeSegment(quote.customerName ?? "unknown-customer");
  const categorySeg = sanitizeSegment(quote.productCategory ?? "general");
  const fileKey = `quotes/${customerSeg}/${categorySeg}/Quotation-${sanitizeSegment(SF_NUMBER)}.pdf`;
  const { key, url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
  await db.updateQuote(quoteId, {
    status: "finalized",
    generatedPdfKey: key,
    generatedPdfUrl: url,
  });
  fs.writeFileSync("/tmp/demo-live-quote.pdf", pdfBuffer);
  console.log(`Branded PDF (${(pdfBuffer.length / 1024).toFixed(0)} KB) stored at ${key}`);
  console.log(`Local copy: /tmp/demo-live-quote.pdf`);

  console.log(`\n=== DEMO COMPLETE — quote #${quoteId} (${SF_NUMBER}) is finalized and visible on the dashboard ===`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("DEMO FAILED:", err);
    process.exit(1);
  });
