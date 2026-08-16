import { describe, it, expect } from "vitest";
import { scoreQuoteAccuracy, type QuoteDataForScoring } from "./accuracy";

function makeFullData(): QuoteDataForScoring {
  return {
    supplierName: "Foodmate",
    supplierQuoteRef: "Q732717",
    extractedItemCount: 3,
    storedItemCount: 3,
    pricingModel: "as_is",
    supplierConfigExists: true,
    sourceCurrency: "EUR",
    exchangeRate: 1.65,
    rateConfirmedByName: "Bamah",
    rateConfirmedAt: "2026-07-27T00:34:00Z",
    currencyMarkdownPct: 2,
    discountPct: 0,
    marginPct: 20,
    lineItems: [
      { description: "Wing Cutter", qty: 1, unitPrice: 30000, sellTotalPrice: 50000 },
      { description: "Spare Parts", qty: 1, unitPrice: 5000, sellTotalPrice: 8000 },
      { description: "Installation", qty: 1, unitPrice: 10000, sellTotalPrice: 16000 },
    ],
    grandTotalAud: 74000,
    computedGrandTotalAud: 74000,
    hasPdfGenerated: true,
    hasSupplierPdfStored: true,
    sfQuoteNumber: "SF-Q-2026-00147",
    customerName: "Baiada Poultry Pty Ltd - Hanwood",
    status: "finalized",
    approvedByName: "Bamah",
  };
}

describe("Accuracy Scoring Engine", () => {
  it("returns 100% for a fully complete and reconciled quote", () => {
    const report = scoreQuoteAccuracy(makeFullData());
    expect(report.score).toBe(100);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it("deducts 15 points when grand total does not reconcile", () => {
    const data = makeFullData();
    data.grandTotalAud = 74000;
    data.computedGrandTotalAud = 73000; // $1000 drift
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(85);
    const driftCheck = report.checks.find((c) => c.id === "total_reconciles");
    expect(driftCheck?.passed).toBe(false);
    expect(driftCheck?.detail).toContain("DRIFT");
  });

  it("deducts 15 points when exchange rate is not confirmed", () => {
    const data = makeFullData();
    data.rateConfirmedByName = null;
    data.rateConfirmedAt = null;
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(85);
    const fxCheck = report.checks.find((c) => c.id === "fx_confirmed");
    expect(fxCheck?.passed).toBe(false);
  });

  it("deducts 10 points when currency markdown is missing", () => {
    const data = makeFullData();
    data.currencyMarkdownPct = 0;
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(90);
  });

  it("deducts 10 points when supplier PDF is missing", () => {
    const data = makeFullData();
    data.hasSupplierPdfStored = false;
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(90);
  });

  it("accumulates multiple deductions correctly", () => {
    const data = makeFullData();
    data.hasSupplierPdfStored = false; // -10
    data.rateConfirmedByName = null;   // -15
    data.rateConfirmedAt = null;
    data.customerName = null;          // -5
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(70);
  });

  it("returns 0% when all checks fail", () => {
    const data: QuoteDataForScoring = {
      supplierName: null,
      supplierQuoteRef: null,
      extractedItemCount: 0,
      storedItemCount: 3,
      pricingModel: null,
      supplierConfigExists: false,
      sourceCurrency: null,
      exchangeRate: null,
      rateConfirmedByName: null,
      rateConfirmedAt: null,
      currencyMarkdownPct: null,
      discountPct: null,
      marginPct: null,
      lineItems: [],
      grandTotalAud: null,
      computedGrandTotalAud: null,
      hasPdfGenerated: false,
      hasSupplierPdfStored: false,
      sfQuoteNumber: null,
      customerName: null,
      status: "draft",
      approvedByName: null,
    };
    const report = scoreQuoteAccuracy(data);
    expect(report.score).toBe(0);
  });
});
