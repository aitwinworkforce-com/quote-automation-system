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
