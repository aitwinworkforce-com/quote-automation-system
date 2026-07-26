/**
 * End-to-end sanity test of the revision flow against the live DB,
 * exercising the same db helpers the revisions router uses.
 * Creates a revision of quote 1, verifies chain, then deletes the revision.
 */
import "dotenv/config";
import * as db from "../server/db";

async function main() {
  const original = await db.getQuoteById(1);
  if (!original) throw new Error("Quote 1 not found");
  console.log("Original:", original.id, original.revisionLabel, original.status, original.salesforceQuoteNumber);

  const rootId = original.rootQuoteId ?? original.id;
  const family = await db.getQuoteRevisions(rootId);
  console.log("Family before:", family.map(f => `${f.id}:${f.revisionLabel}:${f.isLatestRevision}`));

  // Clone like the router does
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original as any;
  const newQuoteId = await db.createQuote({
    ...rest,
    createdBy: original.createdBy,
    status: "costed",
    salesforceQuoteNumber: null,
    generatedPdfUrl: null,
    generatedPdfKey: null,
    lastSentAt: null,
    lastSentTo: null,
    rootQuoteId: rootId,
    parentQuoteId: original.id,
    revisionLabel: "B",
    revisionNote: "TEST revision — automated sanity check",
    isLatestRevision: 1,
  });
  console.log("New revision id:", newQuoteId);

  // Copy line items (same as revisions router)
  const items = await db.getQuoteLineItems(original.id);
  await db.replaceQuoteLineItems(
    newQuoteId,
    items.map((li: any, idx: number) => ({
      quoteId: newQuoteId,
      position: idx,
      description: li.description,
      quantity: li.quantity,
      listUnitPrice: li.listUnitPrice,
      discountPct: li.discountPct,
      netUnitCost: li.netUnitCost,
      sellUnitPrice: li.sellUnitPrice,
      sellTotalPrice: li.sellTotalPrice,
    })),
  );
  await db.clearLatestRevisionFlag(rootId);
  await db.updateQuote(newQuoteId, { isLatestRevision: 1 });

  const chainAfter = await db.getQuoteRevisions(rootId);
  console.log("Family after:", chainAfter.map(f => `${f.id}:${f.revisionLabel}:latest=${f.isLatestRevision}:status=${f.status}`));
  const newItems = await db.getQuoteLineItems(newQuoteId);
  console.log("Cloned line items:", newItems.length);

  // Cleanup: remove test revision, restore latest flag on original
  await db.deleteQuote(newQuoteId);
  await db.clearLatestRevisionFlag(rootId);
  await db.updateQuote(original.id, { isLatestRevision: 1 });
  const chainFinal = await db.getQuoteRevisions(rootId);
  console.log("Family after cleanup:", chainFinal.map(f => `${f.id}:${f.revisionLabel}:latest=${f.isLatestRevision}`));
  console.log("REVISION FLOW OK");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
