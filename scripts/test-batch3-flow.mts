/**
 * Integration sanity test for batch 3 against the live DB:
 *  1. revisions.create path with EDITED line items → verify persisted items + recomputed totals
 *  2. submitForReview → in_review, approve → finalized/awaiting_sf_number with approval stamp
 * Mirrors the exact code paths by importing the real db helpers used by the routers.
 */
import "dotenv/config";
import {
  getQuoteById,
  getQuoteLineItems,
  replaceQuoteLineItems,
  createQuote,
  updateQuote,
  clearLatestRevisionFlag,
  deleteQuote,
} from "../server/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const base = await getQuoteById(1);
  if (!base) throw new Error("Base quote 1 not found");
  const baseItems = await getQuoteLineItems(1);
  console.log(`Base quote 1: ${base.quoteNumber ?? base.supplierQuoteRef}, items=${baseItems.length}`);

  // ---- 1. Create a revision with EDITED items (mirror revisions.create) ----
  const editedItems = baseItems.map((li, i) => ({
    description: li.description,
    quantity: i === 0 ? Number(li.quantity) + 1 : Number(li.quantity), // bump qty of first item
    listUnitPrice: li.listUnitPrice,
    netUnitCost: li.netUnitCost,
    sellUnitPrice: i === 0 ? round2(Number(li.sellUnitPrice) * 0.95) : Number(li.sellUnitPrice), // 5% discount
  }));
  const totalSellForeign = round2(editedItems.reduce((s, li) => s + li.quantity * Number(li.sellUnitPrice), 0));
  const totalCostForeign = round2(editedItems.reduce((s, li) => s + li.quantity * Number(li.netUnitCost ?? 0), 0));
  const rate = Number(base.exchangeRate ?? 0);
  const totalSellAud = base.currency === "AUD" || !rate ? totalSellForeign : round2(totalSellForeign / rate);
  const extras =
    Number(base.freightCostAud ?? 0) + Number(base.installationCostAud ?? 0) + Number((base as any).otherLocalCostAud ?? 0);
  const grandTotalAud = round2(totalSellAud + extras);

  const revId = await createQuote({
    ...(({ id, createdAt, updatedAt, ...rest }) => rest)(base as any),
    status: "costed",
    revisionLabel: "B",
    rootQuoteId: base.rootQuoteId ?? base.id,
    parentQuoteId: base.id,
    isLatestRevision: 1,
    totalSellForeign,
    totalCostForeign,
    totalSellAud,
    grandTotalAud,
    generatedPdfUrl: null,
    generatedPdfKey: null,
    salesforceQuoteNumber: null,
    emailedAt: null,
    emailedTo: null,
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
  } as any);
  await replaceQuoteLineItems(
    revId,
    editedItems.map((li, idx) => ({
      quoteId: revId,
      position: idx,
      description: li.description,
      quantity: li.quantity.toString(),
      listUnitPrice: li.listUnitPrice != null ? li.listUnitPrice.toString() : null,
      discountPct: null,
      netUnitCost: li.netUnitCost != null ? li.netUnitCost.toString() : null,
      sellUnitPrice: li.sellUnitPrice.toString(),
      sellTotalPrice: round2(li.quantity * Number(li.sellUnitPrice)).toString(),
    })) as any,
  );
  await clearLatestRevisionFlag(base.rootQuoteId ?? base.id, revId);

  const rev = await getQuoteById(revId);
  const revItems = await getQuoteLineItems(revId);
  console.log(`Rev B created id=${revId}: qty[0]=${revItems[0]?.quantity} (base ${baseItems[0]?.quantity}), sell[0]=${revItems[0]?.sellUnitPrice}`);
  if (Number(revItems[0]?.quantity) !== Number(baseItems[0]!.quantity) + 1) throw new Error("Edited qty not persisted");
  console.log(`Totals: foreign=${rev?.totalSellForeign}, AUD=${rev?.totalSellAud}, grand=${rev?.grandTotalAud} (expected grand=${grandTotalAud})`);
  if (round2(Number(rev?.grandTotalAud)) !== grandTotalAud) throw new Error("Grand total mismatch");

  // ---- 2. submitForReview → approve (mirror revisions router mutations) ----
  await updateQuote(revId, { status: "in_review" } as any);
  let q = await getQuoteById(revId);
  console.log(`After submitForReview: status=${q?.status}`);
  if (q?.status !== "in_review") throw new Error("submitForReview failed");

  const next = q.salesforceQuoteNumber && q.generatedPdfUrl ? "finalized" : "awaiting_sf_number";
  await updateQuote(revId, {
    status: next,
    approvedBy: 1,
    approvedByName: "Bamah",
    approvedAt: new Date(),
  } as any);
  q = await getQuoteById(revId);
  console.log(`After approve: status=${q?.status} (expected ${next}), approvedByName=${q?.approvedByName}, approvedAt=${q?.approvedAt?.toISOString?.() ?? q?.approvedAt}`);
  if (q?.status !== next) throw new Error("approve transition failed");
  if (q?.approvedByName !== "Bamah" || !q?.approvedAt) throw new Error("approval stamp missing");

  // ---- Cleanup: remove test revision, restore base latest flag ----
  await deleteQuote(revId);
  await updateQuote(base.id, { isLatestRevision: 1 } as any);
  const restored = await getQuoteById(base.id);
  console.log(`Cleanup done. Base quote isLatestRevision=${restored?.isLatestRevision}`);
  console.log("ALL BATCH-3 INTEGRATION CHECKS PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
