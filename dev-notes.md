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
