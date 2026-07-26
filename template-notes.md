# Oestergaard Quote Template — Layout Reference (from QU-8452 PDF, 13 pages)

Brand: "OESTERGAARD" wordmark logo in steel blue (#2E75B6-ish), top of every page with a thin horizontal rule to its left.

## Page structure
1. **Cover page**: Big logo, headline "Powering the Future of Protein Processing", large image collage in the shape of the logo "G" glyph, blue curved footer band. Bottom-left: "Prepared for: {Customer}", "Project: {Product}", "Date: DD.MM.YYYY", "Director", "Bill Hili". Bottom-right blue box: "Oestergaard Pty Ltd / Unit 4/8 Hare Place, Rouse Hill NSW 2155 / www.oestergaard.com.au / ABN: 35 629 325 837".
2. **About Oestergaard Pty Ltd**: two columns — left text (Australian-owned, 100 yrs combined experience, exclusive Danish Oestergaard rep, brands list), right = blue-bordered grid of partner brand logos. Footer "2 | Oestergaard Pty Ltd".
3. **Here When You Need Us — Real People, Real Solutions**: customer support page, 5 icon rows (Phone & Email Support, Remote Diagnostics, Process & Technical Advice, Technician On-Demand, Parts & Repairs Coordination), then "We're Here to Keep You Running" + Service@oestergaard.com.au, spareparts@oestergaard.com.au, +61 2 9834 3665.
4. **Cover letter**: Date (e.g. "1st June 2026"), addressee block (Contact / Company / Street / CITY underlined), top-right box: "Quotation {SF number} / Ref: {supplier quote ref}". "Object: {Product}". Intro paragraph "Following your request, we are pleased to send you our proposal...". Closing "Yours faithfully, OESTERGAARD PTY LIMITED", signature image, "Bill Hili", "DIRECTOR."
5. **Product spec page(s)**: Section header (e.g. "Cut-Up Area"), product name bold (WING CUTTER SUPER CUT), description, "Remark:" italic, "Technical details" table (Length/Width/Height/Weight/Electrical power), product image with caption.
6. **Price for Equipment** (page 6): heading italic blue "Price for Equipment". Table columns: Qty | Description | Price Per Item | Net Price (Ex. GST). Header row blue (#29ABE2-like) with white text. Line items with € symbol. Green highlighted row: "Total Ex-works Europe Ex. GST | € 33,717.00". Then rows: "Total Estimtimated in AUD Dollars @ 0.61 to Euro | $ 55,273.77", "Estimated sea fright from Europe to NSW | $ 5,000.00", "Estimated Installation | $ 10,000.00". Blue highlighted row: "Estimated total in AUD Ecl.GST | $ 70,273.77".
   Bullets under table: Payment for Equipment is invoiced in Euro currency; Installation invoice in AUD after commissioning; Customs clearances, GST and local delivery invoiced directly by the local nominated forwarder.
   **Payment & Delivery Conditions** label/value list: Factory ready date, Validity (30 days), Delivery (FCA Numansdorp, NL (Incoterms 2020)), Payment terms (50% by order / 50% before shipment), Warranty (15 months/2000 hrs/12 months whichever first).
7. **Remarks page**: supplier remarks (sanctions, exclusions, manuals €2,500, FAT €2,500/day, liability, Foodmate General Conditions Oct 2023, privacy). Footer: sales@oestergaard.com.au, +61 (02) 9834 3665, "Oestergaard Pty Ltd | 7".
8-13. **Oestergaard T&Cs**: "OESTERGAARD PTY LTD – ABN 35 629 325 837 / TERMS AND CONDITIONS OF BUSINESS", numbered clauses 1. Definitions, 2. Interpretation, 3. Application of Terms, 4. Price, 5. Payment, 6. Acceptance and delivery of Goods, ... (full legal text, small font, ~6 pages).

## Colors
- Steel blue headings: ~#2E75B6 / #1F6FB2
- Table header blue: ~#29ABE2 (cyan-blue)
- Green total row: ~#92D050
- Blue total row: ~#29ABE2

## Costing math (from demo)
- Cost EUR total ex-works 33,717.00; AUD rate 0.61 → 33,717/0.61 = 55,273.77 AUD
- + freight 5,000 + installation 10,000 = 70,273.77 AUD est. total ex GST
- Margin demo: cost AUD 26,132.84 + 20% margin → ~33,717 selling (margin applied as cost/(1-m) or cost*1.29? Actually 26,132.84 * 1.29 = 33,711 — treated as cost + 20% margin on sell: 26,132.84 / 0.775? Note: 26,132.84 / 0.775 = 33,720. Standard: selling = cost / (1 - margin%) gives 32,666 at 20%. 26,132.84*1.2=31,359. The demo says "+20% margin = 33,717 approx" — actual per costing sheet uses divide by (1-0.225)? We'll implement selling = cost / (1 - margin/100) [true margin] and show derivation transparently.

## Supplier pricing rules (implement exactly)
- Collimatic: net price → apply margin directly
- Marlin / Duravant: list price minus distribution discount → then margin
- Phenova: check quote footer note whether net or gross
- Foodmate: use price as-is
- Nutri Soy / Tofu: list minus stated % discount → then margin
