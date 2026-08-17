# Oestergaard AI Quote Agent — TODO

## Foundation
- [x] Database schema: quotes, quote line items, suppliers config, exchange rate log (file metadata — S3 keys/URLs — stored on the quotes table, no separate files table needed)
- [x] Design system: Oestergaard professional branding (navy/steel blue, clean industrial)
- [x] technicalDetails column added to quotes (migration 0002) and wired end-to-end

## Backend
- [x] File upload endpoint (supplier PDF) → S3 storage
- [x] AI extraction engine: parse supplier quote PDF → quotation number, line items, descriptions, quantities, prices, currency, supplier detection
- [x] Supplier pricing engine (exact rules, no generalisation):
  - [x] Collimatic: net price
  - [x] Marlin / Duravant: list price minus distribution discount
  - [x] Foodmate: as-is
  - [x] Nutri Soy: list price minus stated discount
  - [x] Phenova: footer-based pricing logic
- [x] Live exchange rate fetch (AUD/EUR, AUD/USD) with mandatory user confirmation before applying
- [x] Costing calculation: landed cost + configurable margin % → derived selling price
- [x] Quote CRUD + history queries with search/filter
- [x] Branded PDF generation matching Oestergaard Word template (header, specs, pricing table, payment & delivery conditions, full T&Cs)
- [x] Generated PDF stored to S3, organised by customer/product category

## Frontend
- [x] Auth-gated app (Manus OAuth), dashboard layout
- [x] Dashboard: quote history list with status, customer, supplier, date, quotation number + search/filter
- [x] New Quote wizard:
  - [x] Step 1: Upload supplier PDF → AI extraction with progress state
  - [x] Step 2: Review extracted data + supplier pricing model applied
  - [x] Step 3: Exchange rate fetch + explicit confirmation step (mandatory)
  - [x] Step 4: Costing: margin % input, local costs (freight, installation), derived selling price
  - [x] Step 5: Quote details: customer name, contact, product description, supplier quote ref, date
  - [x] Step 6: Salesforce quotation number manual entry with clear prompt before PDF generation
  - [x] Step 7: Generate + download branded PDF
- [x] Quote detail view with files (supplier PDF + generated PDF)

## Testing
- [x] Vitest: supplier pricing engine rules (13 tests)
- [x] Vitest: costing calculation
- [x] Vitest: exchange rate service (live fetch)
- [x] E2E script with real Foodmate PDF (extraction → FX → costing → SF number → PDF) verified
- [x] Browser verification: dashboard + wizard screenshots verified

## T&Cs integration (user request)
- [x] Extract Oestergaard T&Cs from Word template + Foodmate GTC from Appendix PDF into termsContent.ts
- [x] PDF generator renders combined Oestergaard + supplier T&Cs

## Demo run (user request)
- [x] Run real Q732717.pdf through the full live workflow so the dashboard shows a genuine quote (extraction → pricing → FX → SF number → PDF) — quote #1 finalized: Foodmate 732717-0, Baiada Poultry Hanwood, AUD $83,618.63, SF-Q-2026-00147, dashboard + detail page verified

## Feature batch 2 (user request)
- [x] Supplier settings admin panel: DB-backed supplier config (pricing model, distribution discount %, default margin %) editable in UI, pricing engine reads from DB with code defaults as fallback — /settings/suppliers, admin-gated, verified in browser
- [x] Quote versioning: revision tracking (Rev A/B/C), "Create revision" action clones a quote linked to the original, revision chain visible on quote detail + dashboard shows latest revision — live-tested A→B clone incl. line items + latest-flag transfer
- [x] Send to Customer: email button on quote detail page, customizable subject/message, finalized PDF attached, recipient defaults to customer contact, sent-status logged on quote — built; SMTP credentials intentionally skipped by user, dialog shows "not configured" notice until secrets added
- [x] Vitest coverage for batch 2 (revision labels, admin gating, email preconditions) — 22/22 pass

## Visibility verification (user report)
- [x] Verify exchange-rate confirmation step (wizard Step 3) renders and blocks progression until confirmed — verified in code (NewQuote.tsx L542-636): checkbox must be ticked, only setStep(4) path is via successful confirmRate mutation; UI step bar + confirmed rate on detail page verified via screenshot; also proven during the earlier live E2E run of Q732717.pdf
- [x] Verify revision controls (New revision button + revision chain card) render on quote detail — "New revision" button present; chain card previously hidden for single-revision quotes
- [x] Improve visibility: revision history card now always visible (shows Rev A with guidance text when no revisions exist yet)

## Feature batch 3 (user request: "add all 3")
- [x] Rate audit stamp: record who confirmed the exchange rate and when (rateConfirmedBy/Name/At, migration 0004); green "Exchange rate confirmed by [name] on [time]" banner on quote detail — verified via screenshot (demo quote backfilled)
- [x] Editable revision line items: revision dialog now includes qty/list/net/sell editors per line item; server recomputes foreign totals, AUD conversion, and grand total on create — mirrored in features3 tests
- [x] Approval workflow: in_review status added to enum/labels/StatusBadge (orange); submitForReview (costed/awaiting_sf_number → in_review) + admin-only approve (→ finalized or awaiting_sf_number based on SF#/PDF) with approvedByName/At stamp shown on detail
- [x] Vitest coverage for batch 3 (features3.test.ts: totals recompute, transition guards, enum completeness) — 29/29 pass

## Accuracy-First Engine
- [x] Deterministic accuracy scoring engine (server/accuracy.ts) — 10 weighted checks, 0-100% score
- [x] Accuracy unit tests (7 scenarios: perfect 100%, drift, missing FX, missing markdown, missing PDF, cumulative deductions, 0%)
- [x] tRPC endpoint audit.scoreQuote for per-quote accuracy retrieval — 37/37 tests pass
- [x] Supplier commission module (server/commission.ts) — 17 suppliers, 11 unit tests passing
- [x] Quotation template constants (server/quotationTemplate.ts) — exact structure from QuotationTEMPLATE.docx
- [x] AccuracyBadge component added to Home.tsx
- [x] Render AccuracyBadge in dashboard table rows — verified in browser (85% amber badge showing for demo quote)
- [x] Wire commission into live pricing workflow — getSupplierCommission called during calculateCosting, 2% currencyMarkdownPct applied
- [x] Wire quotationTemplate into PDF generator — TEMPLATE_PRICE_NOTES and full brand list from QuotationTEMPLATE.docx integrated
- [x] Opportunity-by-supplier reporting page — /reports/suppliers with KPI cards, supplier table, win rate badges, verified in browser

## End-to-End Validation & Data Import
- [x] Import 8 historical quotes (Foodmate, Henneken, Unifortes, MPS) from real supplier documents into database
- [x] Verify Opportunity by Supplier report — 9 quotes, $1.63M total, 4 suppliers, win rates visible
- [x] Verify dashboard — 9 quotes, 7 finalized, 2 in progress, all suppliers and customers correct

## Audit Dashboard & Product Images
- [x] Audit dashboard card-based redesign with Fix Now + AI suggestion modal
- [x] Product image library with bulk upload, gallery, web scraper fallback
- [x] Image preview step in quote wizard (Step 5)
- [x] Supplier reference auto-select with "Reference Applied" badge + override audit
- [x] Multi-file upload (PDF + DOCX + XLSX) in single drag-and-drop with auto-classification

## DOCX Output Generation (QuotationTEMPLATE.docx format)
- [x] Install docx npm package for Word document generation
- [x] Create server/docxGenerator.ts — full template structure (cover, about, support, letter, pricing table, sales conditions, T&Cs)
- [x] Add generatedDocxKey/Url columns to quotes table (migration 0008)
- [x] tRPC generateQuoteDocx procedure in pdf router
- [x] Finalize step generates DOCX as primary output (PDF generated as secondary)
- [x] QuoteDetail page: Quotation DOCX download button + companion file buttons (Supplier DOCX, Supplier XLS)
- [x] Vitest tests for DOCX generator (2 tests: valid ZIP buffer, different output per customer/supplier)

## Bug Fixes
- [x] Fix __dirname not defined error in supplierReference.ts (ESM compatibility) — was blocking all uploads from processing
- [x] Per-step accuracy indicator badge in quote wizard — shows running accuracy % at each stage (red/amber/green)
- [x] Regenerated demo quote (SF-Q-2026-00147) with DOCX output — Quotation DOCX button now visible on detail page
