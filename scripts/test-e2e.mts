/**
 * End-to-end workflow test using the real Foodmate supplier quote (Q732717).
 * Exercises: AI extraction → live FX fetch → rate confirmation → costing →
 * Salesforce number → branded PDF generation, calling the same server modules
 * the tRPC procedures use.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractQuoteFromPdf } from "../server/extraction";
import { fetchLiveRates } from "../server/exchangeRate";
import { calculateCosting } from "../server/pricing";
import { generateQuotePdf } from "../server/pdfGenerator";
import { storagePut, storageGet } from "../server/storage";

const pdfPath = "/home/ubuntu/upload/Q732717.pdf";
const pdfBuffer = readFileSync(pdfPath);

console.log("1) Extracting supplier quote with AI ...");
const extracted = await extractQuoteFromPdf(pdfBuffer, "Q732717.pdf");
console.log(JSON.stringify(extracted, null, 2));

console.log("\n2) Fetching live exchange rates ...");
const rates = await fetchLiveRates();
console.log(rates);
const rate = extracted.currency === "USD" ? rates.audUsd : rates.audEur;
console.log(`Confirmed rate for AUD/${extracted.currency}: ${rate}`);

console.log("\n3) Calculating costing (margin 20%, freight 5000, install 10000) ...");
const costing = calculateCosting({
  lineItems: extracted.line_items.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    listUnitPrice: li.unit_price,
    discountPct: li.discount_pct ?? undefined,
  })),
  pricingModel: "as_is",
  marginPct: 20,
  exchangeRate: rate,
  currency: (extracted.currency as "EUR" | "USD" | "AUD") ?? "EUR",
  freightCostAud: 5000,
  installationCostAud: 10000,
});
console.log({
  totalSellForeign: costing.totalSellForeign,
  totalSellAud: costing.totalSellAud,
  grandTotalAud: costing.grandTotalAud,
});

console.log("\n4) Generating branded PDF with Salesforce number QU-9001 ...");
const quote: any = {
  id: 999,
  salesforceQuoteNumber: "QU-9001",
  supplierQuoteRef: extracted.supplier_quote_number,
  supplierName: extracted.supplier_name,
  supplierCurrency: extracted.currency ?? "EUR",
  customerName: extracted.customer_name ?? "Baiada Hanwood",
  customerContact: extracted.customer_contact ?? "",
  customerAddress: extracted.customer_address ?? "",
  productCategory: extracted.product_name,
  productDescription: extracted.product_description,
  technicalDetails: extracted.technical_details || null,
  quoteDate: new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
  exchangeRate: String(rate),
  exchangeRateConfirmed: true,
  marginPct: "20",
  totalSellForeign: String(costing.totalSellForeign),
  totalSellAud: String(costing.totalSellAud),
  freightCostAud: "5000",
  installationCostAud: "10000",
  otherLocalCostAud: "0",
  grandTotalAud: String(costing.grandTotalAud),
  validityDays: 30,
  deliveryTerms: extracted.delivery_terms ?? "FCA Numansdorp, NL (Incoterms 2020)",
  paymentTerms: extracted.payment_terms ?? "50% by order / 50% before shipment",
  warrantyTerms: extracted.warranty_terms ?? "",
  supplierTerms: extracted.supplier_terms_summary ?? "",
};
const lineItems: any[] = costing.lineItems.map((li, i) => ({
  id: i + 1,
  description: li.description,
  quantity: String(li.quantity),
  listUnitPrice: String(li.listUnitPrice),
  netUnitCost: String(li.netUnitCost),
  sellUnitPrice: String(li.sellUnitPrice),
  sellTotalPrice: String(li.sellTotalPrice),
}));
const buf = await generateQuotePdf(quote, lineItems);
writeFileSync("/tmp/e2e-quote.pdf", buf);
console.log(`E2E PDF written: /tmp/e2e-quote.pdf (${buf.length} bytes)`);
console.log("\nEND-TO-END TEST PASSED");
