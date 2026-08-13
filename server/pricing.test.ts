import { describe, expect, it } from "vitest";
import { applyMargin, applySupplierPricingModel, calculateCosting } from "./pricing";

describe("applySupplierPricingModel", () => {
  it("Collimatic (net_price): uses the supplier price directly as net cost", () => {
    const r = applySupplierPricingModel("net_price", { listUnitPrice: 1000 });
    expect(r.netUnitCost).toBe(1000);
    expect(r.explanation).toContain("Collimatic");
  });

  it("Marlin/Duravant (list_minus_distribution): subtracts the distribution discount", () => {
    const r = applySupplierPricingModel("list_minus_distribution", {
      listUnitPrice: 1000,
      distributionDiscountPct: 25,
    });
    expect(r.netUnitCost).toBe(750);
  });

  it("Marlin/Duravant: falls back to line discount when no distribution discount given", () => {
    const r = applySupplierPricingModel("list_minus_distribution", {
      listUnitPrice: 200,
      discountPct: 10,
    });
    expect(r.netUnitCost).toBe(180);
  });

  it("Foodmate (as_is): price used exactly as provided", () => {
    const r = applySupplierPricingModel("as_is", { listUnitPrice: 33717 });
    expect(r.netUnitCost).toBe(33717);
    expect(r.explanation).toContain("Foodmate");
  });

  it("Nutri Soy (list_minus_stated_discount): deducts the stated discount", () => {
    const r = applySupplierPricingModel("list_minus_stated_discount", {
      listUnitPrice: 500,
      discountPct: 10,
    });
    expect(r.netUnitCost).toBe(450);
  });

  it("Phenova (footer_based): net footer → price is net cost", () => {
    const r = applySupplierPricingModel("footer_based", {
      listUnitPrice: 800,
      footerIndicatesNet: true,
      discountPct: 20,
    });
    expect(r.netUnitCost).toBe(800);
    expect(r.explanation).toContain("NET");
  });

  it("Phenova (footer_based): gross footer → discount deducted", () => {
    const r = applySupplierPricingModel("footer_based", {
      listUnitPrice: 800,
      footerIndicatesNet: false,
      discountPct: 20,
    });
    expect(r.netUnitCost).toBe(640);
    expect(r.explanation).toContain("GROSS");
  });
});

describe("applyMargin", () => {
  it("applies margin on selling price: sell = cost / (1 - m)", () => {
    expect(applyMargin(80, 20)).toBe(100);
  });

  it("matches the demo figures approximately (26,132.84 at 22.5% ≈ 33,720)", () => {
    const sell = applyMargin(26132.84, 22.5);
    expect(sell).toBeGreaterThan(33700);
    expect(sell).toBeLessThan(33740);
  });

  it("rejects margins of 100% or more", () => {
    expect(() => applyMargin(100, 100)).toThrow();
  });
});

describe("calculateCosting", () => {
  it("replicates the QU-8452 demo: EUR total ÷ 0.61 + freight + installation", () => {
    // Net sell total of €33,717 ex-works at 0% margin so equipment total is exact.
    const result = calculateCosting({
      lineItems: [{ description: "Wing Cutter Super Cut", quantity: 1, listUnitPrice: 33717 }],
      pricingModel: "as_is",
      marginPct: 0,
      exchangeRate: 0.61,
      currency: "EUR",
      freightCostAud: 5000,
      installationCostAud: 10000,
    });
    expect(result.totalSellForeign).toBe(33717);
    expect(result.totalSellAud).toBeCloseTo(55273.77, 1);
    expect(result.grandTotalAud).toBeCloseTo(70273.77, 1);
  });

  it("applies pricing model, margin, FX and local costs together", () => {
    const result = calculateCosting({
      lineItems: [
        { description: "Machine", quantity: 2, listUnitPrice: 1000 },
        { description: "Spare kit", quantity: 1, listUnitPrice: 500 },
      ],
      pricingModel: "list_minus_distribution",
      distributionDiscountPct: 20,
      marginPct: 20,
      exchangeRate: 0.5,
      currency: "USD",
      freightCostAud: 1000,
      installationCostAud: 2000,
      otherLocalCostAud: 500,
    });
    // net: 800 & 400; sell: 1000 & 500; totals: 2000 + 500 = 2500 USD
    expect(result.lineItems[0].netUnitCost).toBe(800);
    expect(result.lineItems[0].sellUnitPrice).toBe(1000);
    expect(result.totalSellForeign).toBe(2500);
    // 2500 / 0.5 = 5000 AUD + 3500 local = 8500
    expect(result.totalSellAud).toBe(5000);
    expect(result.grandTotalAud).toBe(8500);
  });

  it("keeps AUD totals unconverted for AUD-quoted suppliers", () => {
    const result = calculateCosting({
      lineItems: [{ description: "Local item", quantity: 1, listUnitPrice: 1000 }],
      pricingModel: "net_price",
      marginPct: 50,
      exchangeRate: 0.61,
      currency: "AUD",
    });
    expect(result.totalSellAud).toBe(2000);
    expect(result.grandTotalAud).toBe(2000);
  });
});

  it("applies 2% currency exchange markdown when specified", () => {
    const result = calculateCosting({
      lineItems: [{ description: "Test Item", quantity: 1, listUnitPrice: 100 }],
      pricingModel: "as_is",
      marginPct: 0,
      exchangeRate: 1.0,
      currency: "EUR",
      currencyMarkdownPct: 2,
    });
    // Effective rate = 1.0 * 0.98 = 0.98. 100 / 0.98 = 102.04
    expect(result.totalSellAud).toBeCloseTo(102.04, 2);
  });
