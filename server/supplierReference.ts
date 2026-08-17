/**
 * Supplier Reference Lookup
 * -------------------------
 * Reads from the verified supplier-master-reference.json to provide
 * authoritative pricing model, discount %, margin %, and commission
 * for any supplier. This is the single source of truth for the
 * deterministic pricing engine.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SupplierEntry {
  name: string;
  discount: string;
  pricingModel: string;
  currency: string;
}

interface VerifiedPricingModel {
  supplierDiscount?: string;
  purchaseFactor?: number;
  marginDivisor?: number;
  marginOnSell?: number;
  formula?: string;
  note?: string;
  pricingModel?: string;
  shippingAdminFee?: number;
  fxConvention?: string;
}

interface ReferenceData {
  suppliers: SupplierEntry[];
  costingFormula: {
    sellPrice: string;
    defaultGM: number;
    alternativeGM: number;
    fxMarkdown: number;
    shippingAdminFee: number;
  };
  exchangeRates: Record<string, number | string>;
  labourRates: {
    weekdayPerHour: number;
    saturdayPerHour: number;
    sundayPerHour: number;
    publicHolidayPerHour: number;
    hoursPerDay: number;
  };
  verifiedPricingModels: Record<string, VerifiedPricingModel>;
}

let _cache: ReferenceData | null = null;

function loadReference(): ReferenceData {
  if (_cache) return _cache;
  const filePath = join(__dirname, "../data/supplier-master-reference.json");
  const raw = readFileSync(filePath, "utf-8");
  _cache = JSON.parse(raw) as ReferenceData;
  return _cache;
}

export interface SupplierDefaults {
  name: string;
  pricingModel: string;
  discountPct: number;
  marginPct: number;
  currency: string;
  fxMarkdownPct: number;
  shippingAdminFeePct: number;
}

/**
 * Parse a discount string like "20%" or "25%" into a number.
 * For complex strings like "15% / 25% / 30% (by product)", returns the first value.
 */
function parseDiscountPct(raw: string): number {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Look up a supplier by name and return the verified defaults for the pricing engine.
 * Falls back to conservative defaults if the supplier is not found.
 */
export function getSupplierDefaults(supplierName: string): SupplierDefaults {
  const ref = loadReference();
  const normalised = supplierName.toLowerCase().trim();

  // Find in supplier list
  const entry = ref.suppliers.find(
    (s) => s.name.toLowerCase() === normalised || normalised.includes(s.name.toLowerCase())
  );

  // Find in verified pricing models
  const verified = Object.entries(ref.verifiedPricingModels).find(
    ([key]) => normalised.includes(key.toLowerCase())
  );

  if (entry && verified) {
    const [, model] = verified;
    return {
      name: entry.name,
      pricingModel: entry.pricingModel,
      discountPct: parseDiscountPct(entry.discount),
      marginPct: (model.marginOnSell ?? ref.costingFormula.defaultGM) * 100,
      currency: entry.currency,
      fxMarkdownPct: ref.costingFormula.fxMarkdown * 100,
      shippingAdminFeePct: ref.costingFormula.shippingAdminFee * 100,
    };
  }

  if (entry) {
    return {
      name: entry.name,
      pricingModel: entry.pricingModel,
      discountPct: parseDiscountPct(entry.discount),
      marginPct: ref.costingFormula.defaultGM * 100,
      currency: entry.currency,
      fxMarkdownPct: ref.costingFormula.fxMarkdown * 100,
      shippingAdminFeePct: ref.costingFormula.shippingAdminFee * 100,
    };
  }

  // Fallback for unknown suppliers
  return {
    name: supplierName,
    pricingModel: "list_minus_distribution",
    discountPct: 20,
    marginPct: 20,
    currency: "EUR",
    fxMarkdownPct: 2,
    shippingAdminFeePct: 5,
  };
}

/**
 * Get the full list of suppliers from the reference index.
 */
export function getAllSupplierDefaults(): SupplierDefaults[] {
  const ref = loadReference();
  return ref.suppliers.map((s) => getSupplierDefaults(s.name));
}

/**
 * Get labour rates for service cost calculations.
 */
export function getLabourRates() {
  return loadReference().labourRates;
}

/**
 * Get the exchange rate settings from the reference.
 */
export function getReferenceExchangeRates() {
  return loadReference().exchangeRates;
}
