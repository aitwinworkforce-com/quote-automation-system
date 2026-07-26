/**
 * Smoke test: generate a sample Oestergaard quotation PDF using the QU-8452
 * demo data and write it to /tmp/test-quote.pdf for visual inspection.
 */
import { writeFileSync } from "node:fs";
import { generateQuotePdf } from "../server/pdfGenerator";

const quote: any = {
  id: 1,
  salesforceQuoteNumber: "QU-8452",
  supplierQuoteRef: "Q732717",
  supplierName: "Foodmate",
  supplierCurrency: "EUR",
  customerName: "Baiada Hanwood",
  customerContact: "John Smith",
  customerAddress: "123 Poultry Drive, Hanwood NSW 2680",
  productCategory: "Wing Cutter Super Cut",
  technicalDetails: "Length : 1593 mm\nWidth : 1297 mm\nHeight : 1507 mm\nWeight : 285 kg\nElectrical power (IP66) : 2x 0,75 kW",
  productDescription:
    "The SuperCut Wing Cutter is a high-speed inline wing segmenting solution designed for accurate anatomical cutting of wing sections with minimal yield loss. Suitable for integration into existing cut-up lines.",
  quoteDate: "1st June 2026",
  exchangeRate: "0.61",
  exchangeRateConfirmed: true,
  marginPct: "20",
  totalSellForeign: "33717.00",
  totalSellAud: "55273.77",
  freightCostAud: "5000.00",
  installationCostAud: "10000.00",
  otherLocalCostAud: "0",
  grandTotalAud: "70273.77",
  validityDays: 30,
  deliveryTerms: "FCA Numansdorp, NL (Incoterms 2020)",
  paymentTerms: "50% by order / 50% before shipment",
  warrantyTerms:
    "15 months from delivery or 2,000 operating hours or 12 months after commissioning, whichever comes first",
  supplierTerms:
    "Manuals in additional languages available at EUR 2,500 per set. FAT available at EUR 2,500 per day. Foodmate General Terms and Conditions (October 2023) apply.",
};

const lineItems: any[] = [
  {
    id: 1,
    description: "SuperCut Wing Cutter, complete with infeed guides and drive unit",
    quantity: "1",
    listUnitPrice: "33717.00",
    netUnitCost: "33717.00",
    sellUnitPrice: "33717.00",
    sellTotalPrice: "33717.00",
  },
];

const buf = await generateQuotePdf(quote, lineItems);
writeFileSync("/tmp/test-quote.pdf", buf);
console.log(`PDF written: /tmp/test-quote.pdf (${buf.length} bytes)`);
