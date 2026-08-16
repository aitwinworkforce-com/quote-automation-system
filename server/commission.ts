/**
 * Oestergaard Supplier Commission Engine
 * ----------------------------------------
 * Source: Supplierscommission.xlsx (Sheet2)
 *
 * Each supplier has an "Equipment Discount" which represents
 * the commission/discount Oestergaard receives from the supplier.
 * This is NOT the customer discount — it is Oestergaard's margin
 * on the supplier's list price.
 *
 * The commission is applied as: Oestergaard buys at (100% - commission%)
 * of the supplier's list price.
 *
 * Special cases:
 * - Beritech: tiered (15% / 25% / 30% by product)
 * - Nothum: 12.5% commission (not discount)
 * - Oestergaard: 10% (internal/own products)
 */

export interface SupplierCommission {
  supplierName: string;
  commissionPct: number;
  notes: string;
}

/**
 * Authoritative supplier commission table from Supplierscommission.xlsx
 */
export const SUPPLIER_COMMISSIONS: SupplierCommission[] = [
  { supplierName: "Beritech", commissionPct: 25, notes: "15% / 25% / 30% by product (default 25%)" },
  { supplierName: "BMB S.R.L.", commissionPct: 20, notes: "" },
  { supplierName: "Colimatic", commissionPct: 25, notes: "" },
  { supplierName: "Foodmate", commissionPct: 20, notes: "" },
  { supplierName: "Finova", commissionPct: 15, notes: "" },
  { supplierName: "GPI Group", commissionPct: 20, notes: "" },
  { supplierName: "Heinen", commissionPct: 20, notes: "" },
  { supplierName: "Henneken", commissionPct: 20, notes: "" },
  { supplierName: "Marelec", commissionPct: 20, notes: "" },
  { supplierName: "Marlen", commissionPct: 20, notes: "" },
  { supplierName: "MPS", commissionPct: 20, notes: "" },
  { supplierName: "Nothum", commissionPct: 12.5, notes: "12.5% commission" },
  { supplierName: "Oestergaard", commissionPct: 10, notes: "Internal/own products" },
  { supplierName: "PSS", commissionPct: 20, notes: "" },
  { supplierName: "TECNOVAC", commissionPct: 20, notes: "" },
  { supplierName: "Unifortes", commissionPct: 20, notes: "" },
  { supplierName: "Qupaq", commissionPct: 20, notes: "" },
];

/**
 * Look up the commission percentage for a supplier.
 * Returns null if the supplier is not in the commission table.
 */
export function getSupplierCommission(supplierName: string): SupplierCommission | null {
  const normalized = supplierName.toLowerCase().trim();
  return SUPPLIER_COMMISSIONS.find(
    (s) => s.supplierName.toLowerCase() === normalized
  ) ?? null;
}

/**
 * Calculate Oestergaard's purchase price after applying the supplier commission.
 * purchase = listPrice * (1 - commissionPct / 100)
 */
export function applyCommission(listPrice: number, commissionPct: number): number {
  return Math.round((listPrice * (1 - commissionPct / 100) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate the commission amount earned by Oestergaard on a line item.
 * commission = listPrice * commissionPct / 100
 */
export function calculateCommissionAmount(listPrice: number, commissionPct: number): number {
  return Math.round((listPrice * commissionPct / 100 + Number.EPSILON) * 100) / 100;
}
