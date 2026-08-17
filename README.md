# Oestergaard AI Quote Agent

Automated quotation generation system for Oestergaard Pty Ltd — an Australian industrial equipment company specialising in poultry processing machinery.

**Live:** [oestquote-uiu63ydd.manus.space](https://oestquote-uiu63ydd.manus.space)
**Repo:** [github.com/aitwinworkforce-com/quote-automation-system](https://github.com/aitwinworkforce-com/quote-automation-system)

---

## What It Does

Transforms supplier quote PDFs into branded Oestergaard customer quotations in minutes:

1. **Upload** — Drag-and-drop supplier PDF, DOCX, and XLSX files (auto-classified)
2. **AI Extraction** — GPT-4o reads the supplier PDF and extracts line items, pricing, customer details
3. **Exchange Rate** — Live AUD/EUR/USD/NZD/GBP rates from ECB with mandatory 2% markdown
4. **Costing** — Supplier-specific pricing engine applies correct margins, discounts, and commissions
5. **Draft Preview** — Generate a preview DOCX to verify output before finalising
6. **Finalise** — Enter Salesforce number → generate branded Word document matching QuotationTEMPLATE.docx

---

## Key Features

| Feature | Description |
|---------|-------------|
| **25 Supplier Pricing Engine** | Verified formulas for Foodmate, Collimatic, Henneken, Steen, MPS, Unifortes, Marlin/Duravant, and 18 more |
| **Multi-Currency** | EUR, USD, NZD, GBP, AUD with live ECB rates + 2% markdown |
| **Branded DOCX Output** | Word document matching QuotationTEMPLATE.docx (cover, about, support, pricing table, T&Cs) |
| **Accuracy Scoring** | 10 weighted checks (0–100%) with per-step badge in wizard |
| **Audit Agent** | Real-time health checks with one-click fix buttons |
| **Supplier Commission** | 17 suppliers with verified commission rates |
| **Product Image Library** | Bulk upload, fuzzy matching, web scraper fallback |
| **Quote Versioning** | Rev A/B/C with approval workflow (submit → review → approve) |
| **Multi-File Upload** | Drag-and-drop PDF + DOCX + XLSX with auto-classification |
| **CSV Export** | Download filtered quote results for reporting |
| **Date Range Filter** | Search by client name, supplier, status, and date range |
| **Opportunity Reports** | KPI cards with win-rate badges by supplier |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| API | tRPC 11 (end-to-end type safety) |
| Backend | Express 4, Node.js 22 |
| Database | MySQL / TiDB (Drizzle ORM) |
| AI | OpenAI-compatible (GPT-4o for extraction) |
| Storage | S3 (Manus or AWS) |
| Auth | Manus OAuth or standalone email/password |
| Documents | `docx` npm package (Word), `pdfkit` (PDF) |
| Exchange Rates | ECB via Frankfurter API |

---

## Project Structure

```
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx              # Dashboard with search, filters, CSV export
│   │   ├── NewQuote.tsx          # 6-step quote wizard
│   │   ├── QuoteDetail.tsx       # Quote detail with downloads & regenerate
│   │   ├── AuditDashboard.tsx    # Audit agent with fix buttons
│   │   ├── OpportunityBySupplier.tsx  # Reporting page
│   │   └── SupplierSettings.tsx  # Admin: pricing config, image upload
│   └── components/
├── server/
│   ├── routers/
│   │   ├── quotes.ts            # Upload, extract, confirm rate, costing
│   │   ├── pdf.ts               # PDF + DOCX generation (draft & final)
│   │   ├── audit.ts             # Accuracy checks, AI suggestions
│   │   ├── revisions.ts         # Versioning & approval workflow
│   │   └── productImages.ts     # Image library CRUD
│   ├── docxGenerator.ts         # Branded Word document builder
│   ├── pdfGenerator.ts          # Branded PDF builder
│   ├── pricing.ts               # 25-supplier pricing engine
│   ├── commission.ts            # Supplier commission lookup
│   ├── accuracy.ts              # 10-check scoring engine
│   ├── exchangeRate.ts          # Live ECB rate fetcher
│   ├── extraction.ts            # AI-powered PDF data extraction
│   ├── supplierReference.ts     # Verified supplier reference index
│   ├── auth-standalone.ts       # Email/password auth (Railway)
│   └── storage-standalone.ts    # AWS S3 adapter (Railway)
├── drizzle/
│   ├── schema.ts                # Database schema (quotes, users, suppliers, etc.)
│   └── 0000-0011*.sql           # Migrations
├── data/
│   └── supplier-master-reference.json  # 17 suppliers, verified formulas
├── railway.toml                  # Railway deployment config
├── RAILWAY-DEPLOY.md            # Railway setup guide
└── ENV-TEMPLATE.txt             # Required environment variables
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL 8+ (or TiDB)
- OpenAI API key (for AI extraction)

### Setup

```bash
# Clone the repo
git clone https://github.com/aitwinworkforce-com/quote-automation-system.git
cd quote-automation-system

# Install dependencies
pnpm install

# Set environment variables (see ENV-TEMPLATE.txt)
# Required: DATABASE_URL, JWT_SECRET, BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY

# Run database migrations
# Apply each SQL file in drizzle/ folder in order (0000 → 0011)

# Start dev server
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Deployment Options

### Option 1: Manus Hosting (Current)

- Auto-deployed at [oestquote-uiu63ydd.manus.space](https://oestquote-uiu63ydd.manus.space)
- Zero config — auth, database, storage, and AI are all built-in
- Custom domain support via Management UI → Settings → Domains

### Option 2: Railway

See [RAILWAY-DEPLOY.md](./RAILWAY-DEPLOY.md) for full instructions.

Quick summary:
1. Connect GitHub repo to Railway
2. Add MySQL plugin
3. Set environment variables (OpenAI key, S3 credentials, JWT secret)
4. Deploy — first user to register becomes admin

---

## Supplier Pricing Models

The system supports 25 suppliers with verified pricing formulas:

| Supplier | Pricing Model | Margin | Discount |
|----------|--------------|--------|----------|
| Foodmate | Cost-plus | 20–30% | Varies |
| Henneken | Tiered | 25–30% | Volume-based |
| Steen | Cost-plus | 25% | Standard |
| MPS | Variable | Project-based | Negotiated |
| Collimatic | Net pricing | 20% | None |
| Unifortes | Cost-plus | 25% | Standard |
| Marlin/Duravant | Cost-plus | 25% | Standard |
| + 18 more | Various | Configured per supplier | — |

All formulas cross-validated against real costing workbooks to the cent.

---

## Currency & Exchange Rates

- **Base currency:** AUD (Australian Dollar)
- **Supported:** EUR, USD, NZD, GBP
- **Source:** European Central Bank via Frankfurter API
- **Markdown:** Mandatory 2% applied before AUD conversion
- **Confirmation gate:** Rates are NEVER applied without explicit user confirmation

---

## Accuracy Scoring

Each quote is scored 0–100% across 10 weighted checks:

1. Customer name present (5 pts)
2. Supplier identified (5 pts)
3. Line items extracted (15 pts)
4. Exchange rate confirmed (10 pts)
5. Costing calculated (15 pts)
6. Margin within expected range (10 pts)
7. Commission applied (10 pts)
8. SF number assigned (10 pts)
9. Document generated (10 pts)
10. All fields complete (10 pts)

Badges: 🟢 90%+ | 🟡 70–89% | 🔴 <70%

---

## API Architecture

All API calls use tRPC with end-to-end TypeScript type safety:

```
quotes.uploadAndExtract    → Upload PDF, AI extraction
quotes.confirmRate         → Lock exchange rate
quotes.calculateCosting    → Apply pricing engine
quotes.setSalesforceNumber → Assign SF quote number
pdf.generateQuoteDocx      → Generate final DOCX
pdf.generateDraftDocx      → Generate draft preview
pdf.generateQuote          → Generate PDF (secondary)
audit.runChecks            → Run accuracy checks
audit.scoreQuote           → Get accuracy score
revisions.createRevision   → Create Rev B/C
revisions.submitForReview  → Submit for approval
revisions.approve          → Approve quote
```

---

## Testing

```bash
pnpm test          # Run all 50 vitest tests
pnpm test:watch    # Watch mode
```

Test coverage includes:
- Exchange rate fetching (EUR, USD, NZD, GBP)
- Pricing engine calculations
- Commission lookups
- Accuracy scoring
- DOCX generation (valid ZIP, correct size)
- Supplier reference loading

---

## Contributing

1. Create a feature branch from `main`
2. Make changes and add tests
3. Run `pnpm test` to verify all 50 tests pass
4. Push and create a PR

---

## License

Private — AI Twin Workforce Pty Ltd. All rights reserved.

---

## Support

- **Built by:** AI Twin Workforce ([aitwinworkforce.com](https://aitwinworkforce.com))
- **Contact:** Jay Maniam — jay@aitwinworkforce.com
- **GitHub:** [aitwinworkforce-com](https://github.com/aitwinworkforce-com)
