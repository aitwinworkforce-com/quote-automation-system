# Dev Notes (internal context — backend API shape)

## tRPC procedures (server/routers.ts wires: system, auth, quotes: quotesRouter, pdf: pdfRouter)
- quotes.suppliers — query, lists supplier configs (id, name, pricingModel, notes?)
- quotes.uploadAndExtract — mutation { fileName, fileBase64 } → { quoteId, extracted, matchedSupplier }
- quotes.fetchRates — query → { base:"AUD", audEur, audUsd, source, fetchedAt }
- quotes.confirmRate — mutation { quoteId, pair: "AUD/EUR"|"AUD/USD"|"AUD/AUD", rate, source }
- quotes.calculateCosting — mutation { quoteId, marginPct, lineItems:[{description,quantity,listUnitPrice,discountPct?}], distributionDiscountPct?, footerIndicatesNet?, freightCostAud, installationCostAud, otherLocalCostAud } → CostingResult (requires exchangeRateConfirmed)
- quotes.updateDetails — mutation { quoteId, customerName?, customerContact?, customerAddress?, productCategory?, productDescription?, quoteDate?, supplierQuoteRef?, paymentTerms?, deliveryTerms?, warrantyTerms?, validityDays?, supplierTerms? }
- quotes.setSalesforceNumber — mutation { quoteId, salesforceQuoteNumber } (sets status awaiting_sf_number)
- quotes.list — query { search?, status?, supplierName? } → quote rows
- quotes.get — query { quoteId } → { quote, lineItems, supplier }
- quotes.delete — mutation { quoteId }
- pdf.generateQuote — mutation { quoteId } → { url, key } (requires salesforceQuoteNumber + confirmed rate + grandTotalAud; sets status finalized)

## Quote status enum
draft → extracted → costed → awaiting_sf_number → finalized

## Quote table key fields (decimal cols are strings in JS)
supplierName, supplierQuoteRef, supplierCurrency (EUR|USD|AUD), customerName, customerContact,
customerAddress, productCategory, productDescription, quoteDate (string en-AU), marginPct,
distributionDiscountPct, footerPricingNote, exchangeRate, exchangeRateConfirmed (0/1),
exchangeRateSource, freightCostAud, installationCostAud, otherLocalCostAud, totalCostForeign,
totalSellForeign, totalSellAud, grandTotalAud, salesforceQuoteNumber, paymentTerms, deliveryTerms,
warrantyTerms, validityDays, supplierTerms, supplierPdfUrl, supplierPdfName, generatedPdfUrl, status

## Line item fields
description, quantity, listUnitPrice, discountPct?, netUnitCost?, sellUnitPrice?, sellTotalPrice? (all decimal strings)

## Pricing models (suppliers seeded in DB)
- Collimatic → net_price (prices are net cost, no discount)
- Marlin / Duravant → list_minus_distribution (list price minus distribution discount %, default from extraction distribution_discount_pct)
- Foodmate → as_is (use as-is)
- Nutri Soy → list_minus_stated (list minus stated discount per line: discountPct)
- Phenova → footer_based (footerIndicatesNet: if footer says net → net, else treat as list)

## extraction.ts output (extractQuoteFromPdf)
{ supplier_name, supplier_quote_number, currency, customer_name?, customer_contact?, customer_address?,
  product_name, product_description, line_items:[{description, quantity, unit_price, discount_pct?}],
  supplier_terms_summary?, footer_pricing_note?, distribution_discount_pct?, payment_terms?, delivery_terms?, warranty_terms? }

## PDF generator
server/pdfGenerator.ts generateQuotePdf(quote, lineItems) → Buffer. Uses termsContent.ts OESTERGAARD_TCS.
Layout: cover, about, support, cover letter, spec, pricing table (TABLE_BLUE header #29ABE2, GREEN total #92D050, blue AUD grand total), remarks, T&Cs.

## Remaining frontend to build
- pages/NewQuote.tsx — 5-step wizard: upload → review extraction → FX confirm → costing → details/SF number/finalize
- pages/QuoteDetail.tsx — view quote, download PDFs, enter SF number if missing, regenerate

## PDF smoke test — v2 VERIFIED GOOD (9 pages, /tmp/test-quote.pdf)
All fixed: header wordmark single-line, no blank pages. Verified pages: cover, about (partner brand grid),
support, cover letter (quotation ref box, object line, signature), equipment spec, pricing table
(blue header, green ex-works total, FX conversion line @0.6100, freight, installation, blue AUD grand
total $70,273.77 — matches expected 55,273.77+5,000+10,000), payment & delivery conditions.
Remaining pages 7-9: remarks + T&Cs (not re-inspected, unchanged since v1).
## LLM extraction fix (IMPORTANT)
- storageGet() returns a RELATIVE proxy path (/manus-storage/...), NOT a fetchable absolute URL → LLM file_url 400 INVALID_ARGUMENT.
- Fix: extractQuoteFromPdf(pdfBuffer, fileName) now takes Buffer and sends data:application/pdf;base64,... inline. Model pinned to gemini-3.1-pro-preview.
- JSON schema union types ["string","null"] also removed (all fields now non-null with empty-string/0 defaults).
- Debug test confirmed: data URL works ("quotation number 732717-0"), signed/relative URL fails.
## E2E test PASSED (2026-07-26)
- Full pipeline verified with real Q732717.pdf (Foodmate): extraction → live ECB rates (AUD/EUR 0.61421) → costing (margin 20%, sell AUD 68,618.63, grand total 83,618.63 incl freight 5000 + install 10000) → PDF (9 pages, 24KB).
- Extraction returned correct: quote 732717-0, date 27/05/2026, EUR, Baiada Poultry Hanwood, Simon Camilleri, 2 line items (32665 + 1052), payment/delivery/warranty terms, full T&C summary, tech specs.
- PDF pages 1-5 verified visually: cover (wordmark, quote box, prepared-for, blue address block), about page (brand grid), support page, cover letter (date, quote ref box, address, object line, signature), equipment spec page.
- Minor: technical_details not rendered on spec page (page 5 sparse) — check pdfGenerator passes technicalDetails; not blocking.
- Pages 6-9 VERIFIED: p6 pricing table (blue header, green ex-works total row €42,146.25, blue AUD total row $83,618.63, rate note @0.6142, freight/install rows, invoicing bullet notes, Payment & Delivery Conditions block with validity/delivery/payment/warranty) — matches template. p7 Remarks (supplier terms verbatim). p8-9 full 14-clause Oestergaard T&Cs. PDF output is production-quality.
- FIXED & VERIFIED: technicalDetails column added to quotes schema (migration 0002 applied), persisted in uploadAndExtract + editable via updateDetails, rendered on PDF spec page (p5) as a "Technical Details" block under the product description. Visual check passed.

## Demo script (scripts/demo-live-quote.mts) — verified API shapes
- extractQuoteFromPdf(pdfBuffer, fileName) — TWO args; output snake_case (see above)
- applySupplierPricingModel(model: PricingModel, input: PricingInput) — NOT applySupplierPricing
- calculateCosting(input: CostingInput) — camelCase input, exchangeRate is AUD→foreign
- CostingResult: {lineItems (with netUnitCost/sellUnitPrice/sellTotalPrice/explanation), totalCostForeign, totalSellForeign, totalSellAud, freightCostAud, installationCostAud, otherLocalCostAud, grandTotalAud, currency, exchangeRate, marginPct}
- fetchLiveRates() → {base:"AUD", audEur, audUsd, source, fetchedAt}
- generateQuotePdf(quote: Quote, lineItems: QuoteLineItem[]) — TWO args
- storagePut(relKey, data, contentType?) → {key, url}
- Line items go in quoteLineItems table (separate insert), decimal cols are strings
- Best approach: mirror what server/routers/quotes.ts + server/routers/pdf.ts do internally

## Demo run RESULT (27 Jul 2026) — SUCCESS
- Quote #1 finalized: Foodmate 732717-0, Baiada Poultry Pty Ltd - Hanwood (Mr. Simon Camilleri, Murphy Rd NSW 2680 Hanwood)
- 2 line items: Wing Cutter Super Cut for Marel cut up system €32,665 + misc suspension €1,052
- FX: AUD/EUR 0.61421 (ECB via Frankfurter 2026-07-24), confirmed + logged
- Costing: cost €33,717 → sell €42,146.25 (20% margin) → AUD 68,618.63 + freight 5,000 + install 10,000 = grand total AUD 83,618.63
- SF number: SF-Q-2026-00147; PDF 27KB at quotes/baiada-poultry-pty-ltd---hanwood/wing-cutter-super-cut/Quotation-sf-q-2026-00147_3f53f59a.pdf
- Dashboard verified via screenshot: 1 total / 1 finalised, row visible; quote detail page renders all sections correctly
- Stale esbuild error cleared by webdev_restart_server (was cached from a mid-edit state; tsc always reported 0 errors)

## Feature batch 2 architecture (27 Jul 2026)
Schema (migration 0003 applied via webdev_execute_sql, includes extra `suppliers.defaultMarginPct` decimal(6,3) NOT in generated sql — added manually):
- suppliers: + defaultMarginPct decimal(6,3)
- quotes: + parentQuoteId, rootQuoteId (backfilled = id), revisionLabel varchar(8) default 'A', isLatestRevision int default 1, revisionNote text, lastSentAt timestamp, lastSentTo varchar(320)
- new table quoteEmailLog(id, quoteId, sentBy, toEmail, ccEmail, subject, message, status enum sent/failed, errorDetail, sentAt)
Server:
- server/routers/suppliers.ts → appRouter.suppliersAdmin {list, update(admin), create(admin)}; adminProcedure checks ctx.user.role==='admin'
- server/routers/revisions.ts → appRouter.revisions {chain, create}; nextRevisionLabel A→B→…Z→AA; clone resets SF#/PDF/email fields, status='costed', clears isLatestRevision on family
- server/email.ts → nodemailer SMTP via env SMTP_HOST/PORT/USER/PASS/FROM; isEmailConfigured()
- server/routers/email.ts → appRouter.email {isConfigured, history, sendQuote}; fetches PDF bytes via storageGet presigned URL, logs to quoteEmailLog, updates lastSentAt/lastSentTo
- quotes.uploadAndExtract now sets rootQuoteId=quoteId after insert + falls back to supplier.defaultDiscountPct
- db.ts helpers: updateSupplier, createSupplier, getQuoteRevisions, clearLatestRevisionFlag, logQuoteEmail, getQuoteEmailLog
Frontend TODO: Suppliers settings page (/settings/suppliers, admin), revision chain card + Create Revision button on QuoteDetail, Send to Customer dialog on QuoteDetail (finalized only), nav link in BrandHeader (35 lines), Home.tsx dashboard shows revision label + filter isLatestRevision.
Existing UI facts: QuoteDetail.tsx (351 lines) uses trpc.quotes.get {quote, lineItems, supplier}; header buttons row at ~line 130; finalize card ~277; regenerate card ~323. useAuth() from @/_core/hooks/useAuth has user?.role. NewQuote wizard costing step has marginPct input (default 20) — should prefill from supplier.defaultMarginPct.
SMTP secrets not yet requested from user — must call webdev_request_secrets for SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional).

## Feature batch 2 verification (27 Jul)
- User SKIPPED SMTP secrets (secrets card interrupted) — email UI shows "not configured" alert; do not re-request.
- pnpm test: 22/22 pass across 4 files incl. new server/features.test.ts (revision labels, highest-label pick, email guard, pct bounds).
- Screenshots: dashboard + /settings/suppliers render correctly (5 suppliers listed, Add supplier button, Suppliers nav link in header). /quotes/4 showed loading skeleton in shot (query still fetching, same as previous behaviour — data exists; quote 4 = Q732717 finalized demo).
- User id 1 (Bamah) promoted to admin role for supplier settings edit access.
- Frontend added: pages/SupplierSettings.tsx, components/SendQuoteDialog.tsx, QuoteDetail revision card + New revision dialog + Rev badge + Send-to-customer button (finalized only), BrandHeader Suppliers link, App.tsx route /settings/suppliers.
- Remaining before delivery: verify quote detail renders (retake screenshot), mark todo items [x], checkpoint, deliver.

## Final verification (27 Jul)
- /quotes/1 renders fully: Finalised badge, New revision button, Supplier PDF, Quotation PDF, green Send-to-customer button, details + line items + regenerate PDF card. Note: finalized demo quote is id **1** (earlier note said 4 — wrong).
- Dashboard renders quote list (SF-Q-2026-00147, $83,618.63, Finalised) with stats cards.
- Supplier settings page lists all 5 suppliers with pricing model, distribution discount, default margin, notes, Add supplier button.
- Revision flow tested live via scripts/test-revision.mts: A→B clone, 2 line items copied, latest flag transfers correctly, cleanup OK.
- 22/22 vitest pass. SMTP intentionally skipped by user.
- Gap fixes: (1) SendQuoteDialog vite error confirmed stale — logged 23:38, file exists, server restarted 23:43, /quotes/1 renders with Send-to-customer button. (2) Dashboard now shows "Rev X" + "Superseded" badges on the quote # column for revisions beyond A. (3) Email send path code-verified: recipient defaults to first email parsed from customerContact, PDF fetched from S3 via generatedPdfKey and attached, success/failure logged to quoteEmailLog, lastSentAt/lastSentTo updated on quote. Real send untested pending SMTP secrets (user's choice).

## Visibility verification (user report: "exchange rate and revisions not there")
Findings from live screenshots (27 Jul):
- Wizard /quotes/new: step bar shows 5 steps incl. "3 Exchange Rate" — the confirmation gate IS there but only reachable mid-flow after uploading a PDF; user may not have seen it because they didn't run a new quote.
- Quote detail /quotes/1: "New revision" button IS present (top-left button row), exchange rate shown as "0.6142 (confirmed)" with rate source ECB/Frankfurter. Revision history card only renders when chain length > 1 (by design) — quote 1 currently sole Rev A (test Rev B was cleaned up), so no chain card shows.
- DB state: only quote id 1, Rev A, isLatest=1, finalized, SF-Q-2026-00147.
- Supplier settings page renders fine (5 suppliers, pricing models, Add supplier button).
Explanation doc gap: user also noted the doc DID mention these, possibly they looked at the diagrams only — all 3 diagrams DO include FX confirm + revisions, so the report is most likely about the APP UI visibility.
Planned improvements: (a) make revision history card always visible (even single Rev A) so feature is discoverable; (b) consider hint text on wizard upload step that rate confirmation comes at step 3.

Code-level proof of the Step 3 gate (NewQuote.tsx): step 3 UI at lines 542-636 — rate fetch enabled only when step===3; user must tick a checkbox ("I confirm the {pair} exchange rate of …", rateConfirmChecked) or handleConfirmRate errors with "Please tick the confirmation box"; the only path to step 4 is via handleConfirmRate → confirmRate mutation success → setStep(4) at line ~221. No other setStep(4) exists, so progression is hard-blocked until explicit confirmation. Revision card fix applied (always renders with guidance text when single Rev A) and verified via screenshot.

## Feature batch 3 (in progress): audit stamp + editable revision items + approval workflow
Checkpoint b43de8f6 = stable pre-batch-3 state.
Schema changes DONE in drizzle/schema.ts (need migration): quotes gains rateConfirmedBy(int), rateConfirmedByName(varchar255), rateConfirmedAt(ts), submittedForReviewAt(ts), submittedForReviewBy(int), approvedAt(ts), approvedBy(int), approvedByName(varchar255); status enum now includes "in_review" between awaiting_sf_number and finalized.
Migration approach used previously: `pnpm drizzle-kit generate` then read .sql and apply via webdev_execute_sql (db:push not used; TiDB). For enum change need ALTER TABLE quotes MODIFY status enum(...).
Key integration points:
- confirmRate mutation in server/routers/quotes.ts — set rateConfirmedBy/Name/At from ctx.user (id, name); already logs to exchangeRateLog (confirmedBy/confirmedAt exist there).
- QuoteDetail.tsx "Exchange rate" dl row — append stamp "confirmed by {name} at {time}".
- Revision creation: server/routers/revisions.ts `create` clones line items via getQuoteLineItems/replaceQuoteLineItems; extend input with optional items[] (id?, description, quantity, listUnitPrice, netUnitCost, sellUnitPrice) — recompute sellTotalPrice=qty*sellUnitPrice and quote totals (totalSellForeign=sum sellTotal, totalSellAud=totalSellForeign/rate? NOTE: existing convention — totalSellAud = totalSellForeign / exchangeRate (EUR→AUD divide), grandTotalAud = totalSellAud + freight+install+other). Check quotes.ts costing step for exact formula before implementing.
- Revision dialog in QuoteDetail.tsx (revisionDialogOpen) — add editable line-items table.
- Approval workflow: new mutations submitForReview (finalized? no — from costed/awaiting_sf/draft → in_review) and approve (in_review → finalized, sets approvedBy/Name/At; admin-gated approve). StatusBadge components: client Home.tsx + QuoteDetail.tsx have StatusBadge — add in_review (amber "In review"). Wizard finalize currently sets status finalized — keep direct finalize allowed, approval optional path.
- StatusBadge locations: client/src/pages/Home.tsx and QuoteDetail.tsx (both define or import one — check shared component).
- Vitest: add server/batch3.test.ts — status transitions, approve gating, revision item recompute.
Stale vite error in logs (SendQuoteDialog) is stale from 23:38 — file exists, page renders fine.

## Batch 3 progress (rate stamp, revision item editor, review workflow)
- Schema+migration 0004 APPLIED to DB: quotes gained rateConfirmedBy/rateConfirmedByName/rateConfirmedAt, submittedForReviewAt/By, approvedAt/approvedBy/approvedByName, status enum now includes `in_review`.
- Backend DONE: quotes.confirmRate stamps user id/name/time; revisions.create accepts optional items[] and recomputes totals; revisions.submitForReview; revisions.approve (admin only).
- Frontend DONE: QuoteDetail has emerald rate-confirmation stamp + sky approval stamp, revision dialog with editable line-items table, Review & approval card (Submit for review / Approve admin-only), Finalise hidden while in_review.
- Vite console errors about SendQuoteDialog are STALE (23:38; file exists; server restarted 00:28; tsc 0 errors).
- REMAINING: vitest additions for batch 3, screenshot verify, todo.md tick, checkpoint, deliver.

## Batch 3 verification (00:35)
- vitest: 29/29 pass across 5 files (features3.test.ts adds 7 tests).
- Screenshot /quotes/1: page renders fine, revision history card + Send to customer + all cards OK. Rate-confirmed stamp NOT shown for quote 1 because it was confirmed BEFORE the stamp columns existed (rateConfirmedByName null). Backfill for demo quote 1 is optional cosmetic.
- Dashboard renders (list mid-load in shot, stats cards mid-load; API healthy).
- in_review added to shared QUOTE_STATUSES/STATUS_LABELS + StatusBadge orange style.

## Batch 3 final verification (00:40)
- Integration test scripts/test-batch3-flow.mts PASSED against live DB: Rev B created with EDITED items (qty 1→2, 5% sell discount), persisted qty verified, recomputed grand total matched (143448.54), submitForReview→in_review verified, approve→awaiting_sf_number with approvedByName=Bamah + approvedAt stamp verified, cleanup restored base quote.
- Audit stamp verified in browser: green "Exchange rate confirmed by Bamah on 27 July 2026, 12:34 am" banner on /quotes/1.
- Orphan quote 90001 (from first failed test run before line-item insert) deleted; quote 1 restored isLatestRevision=1; clean single Rev A history confirmed via screenshot.
- Stale vite SendQuoteDialog errors in tool output are from 23:38 (pre-restart); page renders fine, tsc 0 errors.
- vitest 29/29 pass.
