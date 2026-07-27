import { describe, expect, it } from "vitest";
import { QUOTE_STATUSES, STATUS_LABELS } from "../shared/types";

/**
 * Unit tests for feature batch 3:
 *  - revision totals recompute when line items are edited
 *  - review/approval status transition rules
 *  - status label/enum completeness (incl. in_review)
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

// Mirrors the recompute block in revisions.create when items[] are supplied
function recomputeTotals(
  items: { quantity: number; netUnitCost: number | null; sellUnitPrice: number }[],
  opts: { exchangeRate: number; currency: string; freightAud: number; installAud: number; otherAud: number },
) {
  const totalSellForeign = round2(items.reduce((s, li) => s + li.quantity * li.sellUnitPrice, 0));
  const totalCostForeign = round2(items.reduce((s, li) => s + li.quantity * (li.netUnitCost ?? 0), 0));
  const rate = opts.exchangeRate || 0;
  const totalSellAud =
    opts.currency === "AUD" || !rate ? totalSellForeign : round2(totalSellForeign / rate);
  const grandTotalAud = round2(totalSellAud + opts.freightAud + opts.installAud + opts.otherAud);
  return { totalSellForeign, totalCostForeign, totalSellAud, grandTotalAud };
}

describe("revision totals recompute (edited line items)", () => {
  it("recomputes foreign totals and converts to AUD by dividing by the AUD→EUR rate", () => {
    const r = recomputeTotals(
      [
        { quantity: 2, netUnitCost: 100, sellUnitPrice: 150 },
        { quantity: 1, netUnitCost: 50, sellUnitPrice: 80 },
      ],
      { exchangeRate: 0.6142, currency: "EUR", freightAud: 1000, installAud: 500, otherAud: 0 },
    );
    expect(r.totalSellForeign).toBe(380); // 2*150 + 80
    expect(r.totalCostForeign).toBe(250); // 2*100 + 50
    expect(r.totalSellAud).toBe(round2(380 / 0.6142));
    expect(r.grandTotalAud).toBe(round2(380 / 0.6142 + 1500));
  });
  it("skips conversion for AUD-denominated quotes", () => {
    const r = recomputeTotals(
      [{ quantity: 3, netUnitCost: null, sellUnitPrice: 200 }],
      { exchangeRate: 0.6142, currency: "AUD", freightAud: 0, installAud: 0, otherAud: 250 },
    );
    expect(r.totalSellAud).toBe(600);
    expect(r.grandTotalAud).toBe(850);
    expect(r.totalCostForeign).toBe(0); // null net cost treated as 0
  });
  it("falls back to foreign totals when rate is missing", () => {
    const r = recomputeTotals(
      [{ quantity: 1, netUnitCost: 10, sellUnitPrice: 20 }],
      { exchangeRate: 0, currency: "EUR", freightAud: 0, installAud: 0, otherAud: 0 },
    );
    expect(r.totalSellAud).toBe(20);
  });
});

describe("review/approval status transitions", () => {
  // Mirrors guards in revisions.submitForReview and revisions.approve
  const canSubmitForReview = (status: string) => ["costed", "awaiting_sf_number"].includes(status);
  const canApprove = (status: string, role: string) => role === "admin" && status === "in_review";
  const approvedNextStatus = (q: { salesforceQuoteNumber: string | null; generatedPdfUrl: string | null }) =>
    q.salesforceQuoteNumber && q.generatedPdfUrl ? "finalized" : "awaiting_sf_number";

  it("only costed/awaiting_sf_number quotes can be submitted", () => {
    expect(canSubmitForReview("costed")).toBe(true);
    expect(canSubmitForReview("awaiting_sf_number")).toBe(true);
    expect(canSubmitForReview("draft")).toBe(false);
    expect(canSubmitForReview("in_review")).toBe(false);
    expect(canSubmitForReview("finalized")).toBe(false);
  });
  it("only admins can approve, and only quotes in review", () => {
    expect(canApprove("in_review", "admin")).toBe(true);
    expect(canApprove("in_review", "user")).toBe(false);
    expect(canApprove("costed", "admin")).toBe(false);
  });
  it("approval routes to finalized only when SF number and PDF exist", () => {
    expect(approvedNextStatus({ salesforceQuoteNumber: "QU-1", generatedPdfUrl: "https://x/q.pdf" })).toBe("finalized");
    expect(approvedNextStatus({ salesforceQuoteNumber: null, generatedPdfUrl: null })).toBe("awaiting_sf_number");
    expect(approvedNextStatus({ salesforceQuoteNumber: "QU-1", generatedPdfUrl: null })).toBe("awaiting_sf_number");
  });
});

describe("status enum completeness", () => {
  it("includes in_review and has a label for every status", () => {
    expect(QUOTE_STATUSES).toContain("in_review");
    for (const s of QUOTE_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
    expect(STATUS_LABELS.in_review).toBe("In Review");
  });
});
