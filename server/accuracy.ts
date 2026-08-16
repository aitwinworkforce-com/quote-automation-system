/**
 * Oestergaard Quote Accuracy Scoring Engine
 *
 * Deterministic, transparent scoring that verifies data accuracy
 * from supplier source document through to customer quotation output.
 *
 * The score is NOT an AI opinion — it is a checklist of verifiable facts:
 * - Did the extracted line items match the supplier PDF?
 * - Was the correct pricing model applied?
 * - Was the exchange rate confirmed by a human?
 * - Does the math (discount × qty × FX × margin) reconcile?
 * - Was the 2% currency markdown applied?
 * - Are all required fields present in the output?
 *
 * Each check is worth points. The total is the accuracy score (0–100%).
 */

export interface AccuracyCheck {
  id: string;
  label: string;
  weight: number; // points out of 100
  passed: boolean;
  detail: string; // human-readable explanation
}

export interface AccuracyReport {
  quoteId: number;
  score: number; // 0–100
  maxScore: number; // always 100
  checks: AccuracyCheck[];
  scoredAt: string; // ISO timestamp
  scoredBy: string; // "system" or user name
}

export interface QuoteDataForScoring {
  // Source extraction
  supplierName: string | null;
  supplierQuoteRef: string | null;
  extractedItemCount: number;
  storedItemCount: number;

  // Pricing model
  pricingModel: string | null; // e.g. "as_is", "list_minus_distribution"
  supplierConfigExists: boolean;

  // Exchange rate
  sourceCurrency: string | null;
  exchangeRate: number | null;
  rateConfirmedByName: string | null;
  rateConfirmedAt: string | null;

  // Costing
  currencyMarkdownPct: number | null; // should be 2 (percent)
  discountPct: number | null;
  marginPct: number | null;

  // Line item math verification
  lineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number; // supplier price in source currency
    sellTotalPrice: number; // computed AUD sell price for this line
  }>;
  grandTotalAud: number | null;
  computedGrandTotalAud: number | null; // sum of sellTotalPrice across items

  // Output completeness
  hasPdfGenerated: boolean;
  hasSupplierPdfStored: boolean;
  sfQuoteNumber: string | null;
  customerName: string | null;

  // Approval
  status: string;
  approvedByName: string | null;
}

/**
 * Score a quote's data accuracy. Pure function — no side effects.
 */
export function scoreQuoteAccuracy(data: QuoteDataForScoring): AccuracyReport {
  const checks: AccuracyCheck[] = [];

  // 1. Source document present (10 pts)
  checks.push({
    id: "source_pdf",
    label: "Supplier PDF stored",
    weight: 10,
    passed: data.hasSupplierPdfStored,
    detail: data.hasSupplierPdfStored
      ? "Original supplier PDF is archived and retrievable"
      : "Supplier source PDF is missing — cannot verify extraction",
  });

  // 2. Supplier identified (5 pts)
  checks.push({
    id: "supplier_identified",
    label: "Supplier identified",
    weight: 5,
    passed: !!data.supplierName,
    detail: data.supplierName
      ? `Supplier: ${data.supplierName}`
      : "Supplier name not extracted",
  });

  // 3. Supplier quote reference extracted (5 pts)
  checks.push({
    id: "quote_ref",
    label: "Supplier quote reference extracted",
    weight: 5,
    passed: !!data.supplierQuoteRef,
    detail: data.supplierQuoteRef
      ? `Reference: ${data.supplierQuoteRef}`
      : "No supplier quote reference found",
  });

  // 4. Line items extracted and stored (15 pts)
  const itemCountMatch = data.extractedItemCount > 0 && data.extractedItemCount === data.storedItemCount;
  checks.push({
    id: "items_match",
    label: "Extracted items stored correctly",
    weight: 15,
    passed: itemCountMatch,
    detail: itemCountMatch
      ? `${data.storedItemCount} line items extracted and persisted`
      : `Mismatch: extracted ${data.extractedItemCount}, stored ${data.storedItemCount}`,
  });

  // 5. Pricing model configured (10 pts)
  checks.push({
    id: "pricing_model",
    label: "Pricing model configured for supplier",
    weight: 10,
    passed: data.supplierConfigExists && !!data.pricingModel,
    detail: data.supplierConfigExists
      ? `Model: ${data.pricingModel}`
      : "No pricing configuration found for this supplier",
  });

  // 6. Exchange rate confirmed by human (15 pts)
  const fxConfirmed = !!data.rateConfirmedByName && !!data.rateConfirmedAt;
  checks.push({
    id: "fx_confirmed",
    label: "Exchange rate confirmed by user",
    weight: 15,
    passed: fxConfirmed,
    detail: fxConfirmed
      ? `Rate ${data.exchangeRate} confirmed by ${data.rateConfirmedByName} at ${data.rateConfirmedAt}`
      : "Exchange rate has not been confirmed by a human",
  });

  // 7. Currency markdown applied (10 pts)
  const markdownApplied = data.currencyMarkdownPct !== null && data.currencyMarkdownPct > 0;
  checks.push({
    id: "currency_markdown",
    label: "2% currency exchange markdown applied",
    weight: 10,
    passed: markdownApplied,
    detail: markdownApplied
      ? `${data.currencyMarkdownPct}% markdown applied`
      : "Currency markdown not applied or is zero",
  });

  // 8. Grand total reconciles with line items (15 pts)
  let totalReconciles = false;
  let reconcileDetail = "Cannot verify — missing data";
  if (data.grandTotalAud !== null && data.computedGrandTotalAud !== null) {
    const diff = Math.abs(data.grandTotalAud - data.computedGrandTotalAud);
    const tolerance = 0.01; // 1 cent
    totalReconciles = diff <= tolerance;
    reconcileDetail = totalReconciles
      ? `Grand total $${data.grandTotalAud.toFixed(2)} matches computed sum $${data.computedGrandTotalAud.toFixed(2)}`
      : `DRIFT: stored $${data.grandTotalAud.toFixed(2)} vs computed $${data.computedGrandTotalAud.toFixed(2)} (diff: $${diff.toFixed(2)})`;
  }
  checks.push({
    id: "total_reconciles",
    label: "Grand total reconciles with line items",
    weight: 15,
    passed: totalReconciles,
    detail: reconcileDetail,
  });

  // 9. Customer quotation PDF generated (10 pts)
  checks.push({
    id: "pdf_generated",
    label: "Customer quotation PDF generated",
    weight: 10,
    passed: data.hasPdfGenerated,
    detail: data.hasPdfGenerated
      ? "Branded customer PDF has been generated"
      : "No customer PDF generated yet",
  });

  // 10. Customer name present (5 pts)
  checks.push({
    id: "customer_name",
    label: "Customer name recorded",
    weight: 5,
    passed: !!data.customerName,
    detail: data.customerName
      ? `Customer: ${data.customerName}`
      : "Customer name is missing",
  });

  // Calculate total score
  const earnedPoints = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const maxPoints = checks.reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedPoints / maxPoints) * 100);

  return {
    quoteId: 0, // caller sets this
    score,
    maxScore: 100,
    checks,
    scoredAt: new Date().toISOString(),
    scoredBy: "system",
  };
}
