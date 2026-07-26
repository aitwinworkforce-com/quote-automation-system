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
