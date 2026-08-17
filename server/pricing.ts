/**
 * Oestergaard Supplier Pricing Engine
 * ------------------------------------
 * Implements the exact supplier-specific pricing rules from the
 * "Quote Automation Process" documentation. These rules MUST NOT be
 * generalised — each supplier has its own model:
 *
 *  - Collimatic          → net_price: price received IS Oestergaard's net cost.
 *  - Marlin / Duravant   → list_minus_distribution: list price minus the
 *                          distribution discount shown separately on the quote.
 *  - Foodmate            → as_is: use the price exactly as provided.
 *  - Nutri Soy / Tofu    → list_minus_stated_discount: list price minus the
 *                          percentage discount stated on the quote (e.g. 10%).
 *  - Phenova             → footer_based: the quote footer indicates whether
 *                          the price is net or gross; if gross, a discount
 *                          must be deducted; if net, treat like net_price.
 */

export type PricingModel =
  | "net_price"
  | "list_minus_distribution"
  | "as_is"
  | "list_minus_stated_discount"
  | "footer_based";

export interface PricingInput {
  /** Unit price as it appears on the supplier quote (list or net). */
  listUnitPrice: number;
  /** Discount % stated on the quote line / footer (if any). */
  discountPct?: number | null;
  /** Distribution discount % (Marlin/Duravant), from quote or config. */
  distributionDiscountPct?: number | null;
  /** Phenova only: whether the footer indicates the price is net. */
  footerIndicatesNet?: boolean | null;
}

export interface PricingResult {
  netUnitCost: number;
  explanation: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Derive Oestergaard's net unit cost from the supplier quote price,
 * according to the supplier's configured pricing model.
 */
export function applySupplierPricingModel(model: PricingModel, input: PricingInput): PricingResult {
  const list = input.listUnitPrice;
  switch (model) {
    case "net_price": {
      // Collimatic — price is already Oestergaard-specific net cost.
      return {
        netUnitCost: round2(list),
        explanation: "Net price model (Collimatic): supplier price is already the Oestergaard net cost. Margin applied directly.",
      };
    }
    case "list_minus_distribution": {
      // Marlin / Duravant — subtract the distribution discount.
      const disc = input.distributionDiscountPct ?? input.discountPct ?? 0;
      const net = list * (1 - disc / 100);
      return {
        netUnitCost: round2(net),
        explanation: `List-minus-distribution model (Marlin/Duravant): list price ${list.toFixed(2)} minus distribution discount ${disc}% = net cost ${round2(net).toFixed(2)}.`,
      };
    }
    case "as_is": {
      // Foodmate — customer price managed directly; use as-is.
      return {
        netUnitCost: round2(list),
        explanation: "As-is model (Foodmate): price used exactly as provided; handled directly within the team.",
      };
    }
    case "list_minus_stated_discount": {
      // Nutri Soy / Tofu — deduct the stated percentage discount.
      const disc = input.discountPct ?? 0;
      const net = list * (1 - disc / 100);
      return {
        netUnitCost: round2(net),
        explanation: `List-minus-stated-discount model (Nutri Soy): list price ${list.toFixed(2)} minus stated discount ${disc}% = net cost ${round2(net).toFixed(2)}.`,
      };
    }
    case "footer_based": {
      // Phenova — footer note determines net vs gross.
      if (input.footerIndicatesNet) {
        return {
          netUnitCost: round2(list),
          explanation: "Footer-based model (Phenova): quote footer indicates NET pricing — price used as Oestergaard net cost.",
        };
      }
      const disc = input.discountPct ?? 0;
      const net = list * (1 - disc / 100);
      return {
        netUnitCost: round2(net),
        explanation: `Footer-based model (Phenova): quote footer indicates GROSS pricing — discount ${disc}% deducted to reach net cost ${round2(net).toFixed(2)}.`,
      };
    }
  }
}

/**
 * Apply the agreed margin percentage to a net cost to derive selling price.
 * Matches the embedded-Excel behaviour demonstrated by Bill:
 *   cost AUD 26,132.84 + 20% margin ≈ AUD 33,717
 *   i.e. selling = cost / (1 - margin/100)  (margin on selling price)
 */
export function applyMargin(netCost: number, marginPct: number): number {
  if (marginPct >= 100) throw new Error("Margin percentage must be below 100");
  return round2(netCost / (1 - marginPct / 100));
}

export interface CostingInput {
  lineItems: Array<{
    description: string;
    quantity: number;
    listUnitPrice: number;
    discountPct?: number | null;
  }>;
  pricingModel: PricingModel;
  distributionDiscountPct?: number | null;
  footerIndicatesNet?: boolean | null;
  marginPct: number;
  /** Exchange rate expressed as AUD→foreign (e.g. AUD/EUR = 0.61 → 1 AUD buys 0.61 EUR). */
  exchangeRate: number;
  currency: "EUR" | "USD" | "AUD" | "NZD" | "GBP";
  /** Optional currency exchange markdown % (e.g. 2%). */
  currencyMarkdownPct?: number;
  freightCostAud?: number;
  installationCostAud?: number;
  otherLocalCostAud?: number;
}

export interface CostedLineItem {
  description: string;
  quantity: number;
  listUnitPrice: number;
  discountPct: number | null;
  netUnitCost: number;
  sellUnitPrice: number;
  sellTotalPrice: number;
  explanation: string;
}

export interface CostingResult {
  lineItems: CostedLineItem[];
  totalCostForeign: number;
  /** Total selling price ex-works in supplier currency (after margin). */
  totalSellForeign: number;
  /** Equipment selling total converted to AUD at the confirmed rate. */
  totalSellAud: number;
  freightCostAud: number;
  installationCostAud: number;
  otherLocalCostAud: number;
  /** Grand total in AUD excl. GST (equipment + local costs). */
  grandTotalAud: number;
  currency: "EUR" | "USD" | "AUD" | "NZD" | "GBP";
  exchangeRate: number;
  marginPct: number;
}

/**
 * Full costing calculation, replicating the embedded Excel costing sheet:
 * 1. Apply supplier pricing model → net cost per line
 * 2. Apply margin → selling price per line (in supplier currency)
 * 3. Convert equipment total to AUD via confirmed exchange rate (AUD/foreign)
 * 4. Add estimated local AUD costs (freight, installation, other)
 */
export function calculateCosting(input: CostingInput): CostingResult {
  const costedItems: CostedLineItem[] = input.lineItems.map(item => {
    const { netUnitCost, explanation } = applySupplierPricingModel(input.pricingModel, {
      listUnitPrice: item.listUnitPrice,
      discountPct: item.discountPct,
      distributionDiscountPct: input.distributionDiscountPct,
      footerIndicatesNet: input.footerIndicatesNet,
    });
    const sellUnitPrice = applyMargin(netUnitCost, input.marginPct);
    return {
      description: item.description,
      quantity: item.quantity,
      listUnitPrice: item.listUnitPrice,
      discountPct: item.discountPct ?? null,
      netUnitCost,
      sellUnitPrice,
      sellTotalPrice: round2(sellUnitPrice * item.quantity),
      explanation,
    };
  });

  const totalCostForeign = round2(costedItems.reduce((s, i) => s + i.netUnitCost * i.quantity, 0));
  const totalSellForeign = round2(costedItems.reduce((s, i) => s + i.sellTotalPrice, 0));

  // Convert to AUD. Rate is AUD→foreign (e.g. 0.61 EUR per AUD), so AUD = foreign / rate.
  const markdown = input.currencyMarkdownPct ?? 0;
  const effectiveRate = markdown > 0 ? input.exchangeRate * (1 - markdown / 100) : input.exchangeRate;
  const totalSellAud =
    input.currency === "AUD" ? totalSellForeign : round2(totalSellForeign / effectiveRate);

  const freightCostAud = round2(input.freightCostAud ?? 0);
  const installationCostAud = round2(input.installationCostAud ?? 0);
  const otherLocalCostAud = round2(input.otherLocalCostAud ?? 0);
  const grandTotalAud = round2(totalSellAud + freightCostAud + installationCostAud + otherLocalCostAud);

  return {
    lineItems: costedItems,
    totalCostForeign,
    totalSellForeign,
    totalSellAud,
    freightCostAud,
    installationCostAud,
    otherLocalCostAud,
    grandTotalAud,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    marginPct: input.marginPct,
  };
}
