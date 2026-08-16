import { describe, it, expect } from "vitest";
import { getSupplierCommission, applyCommission, calculateCommissionAmount, SUPPLIER_COMMISSIONS } from "./commission";

describe("Supplier Commission Engine", () => {
  it("returns correct commission for Foodmate (20%)", () => {
    const result = getSupplierCommission("Foodmate");
    expect(result).not.toBeNull();
    expect(result!.commissionPct).toBe(20);
  });

  it("returns correct commission for Henneken (20%)", () => {
    const result = getSupplierCommission("Henneken");
    expect(result).not.toBeNull();
    expect(result!.commissionPct).toBe(20);
  });

  it("returns correct commission for Colimatic (25%)", () => {
    const result = getSupplierCommission("Colimatic");
    expect(result).not.toBeNull();
    expect(result!.commissionPct).toBe(25);
  });

  it("returns correct commission for Nothum (12.5%)", () => {
    const result = getSupplierCommission("Nothum");
    expect(result).not.toBeNull();
    expect(result!.commissionPct).toBe(12.5);
  });

  it("returns null for unknown supplier", () => {
    const result = getSupplierCommission("Unknown Corp");
    expect(result).toBeNull();
  });

  it("case-insensitive lookup", () => {
    const result = getSupplierCommission("foodmate");
    expect(result).not.toBeNull();
    expect(result!.commissionPct).toBe(20);
  });

  it("applyCommission: €10000 at 20% commission = €8000 purchase price", () => {
    expect(applyCommission(10000, 20)).toBe(8000);
  });

  it("applyCommission: €10000 at 25% commission = €7500 purchase price", () => {
    expect(applyCommission(10000, 25)).toBe(7500);
  });

  it("applyCommission: €24090 at 20% commission = €19272 purchase price", () => {
    // Henneken HVM650 Mixer from real Costing.xlsx
    expect(applyCommission(24090, 20)).toBe(19272);
  });

  it("calculateCommissionAmount: €10000 at 20% = €2000 commission earned", () => {
    expect(calculateCommissionAmount(10000, 20)).toBe(2000);
  });

  it("has 17 suppliers in the commission table", () => {
    expect(SUPPLIER_COMMISSIONS.length).toBe(17);
  });
});

