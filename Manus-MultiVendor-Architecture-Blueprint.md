# Oestergaard AI Quotation Agent — Complete Manus-Only Architecture Blueprint

This document defines the complete end-to-end multi-vendor quotation architecture implemented entirely within the Manus platform (React frontend, Express/tRPC backend, MySQL/TiDB database, Amazon S3 storage, and built-in AI/LLM extraction), without requiring external orchestrators like n8n or Power Automate.

---

## 1. End-to-End Workflow Diagram (Manus-Only)

```
[Sales Rep / Admin Logs In via Manus OAuth]
                   │
                   ▼
[Step 1: Quote Wizard - Upload Supplier PDF]
  - Drag and drop PDF (Foodmate, Henneken, Collimatic, Marlin, Nutri Soy, Phenova)
  - System auto-detects or user selects Supplier Vendor Profile
                   │
                   ▼
[Step 2: AI-Powered Extraction]
  - Built-in LLM parses unstructured PDF text and tables into structured JSON
  - Extracts line items, quantities, unit list prices, and supplier currency (EUR/USD/AUD)
                   │
                   ▼
[Step 3: Live FX Rate & Confirmation Gate]
  - Fetches live ECB exchange rate (e.g. AUD/EUR)
  - Displays rate to user with mandatory confirmation gate
  - Stamps rateConfirmedByName and timestamp on quote
                   │
                   ▼
[Step 4: Deterministic Costing & Margin Engine]
  - Applies vendor-specific pricing model (as-is, net, list-minus-distribution, footer-based)
  - Computes Net Supplier Cost in Foreign Currency
  - Converts to AUD using confirmed exchange rate
  - Applies Oestergaard Gross Margin divisor (e.g. Sell = AUD Cost / (1 - Margin %))
  - Computes freight, installation, and grand total
                   │
                   ▼
[Step 5: Salesforce Quote Number Entry]
  - User enters manual Salesforce quote reference (e.g. SF-Q-2026-00147)
                   │
                   ▼
[Step 6: Review, Edit & Approval Workflow]
  - Rep reviews extracted items and edited quantities/prices if needed
  - Submits quote for review (Status: In Review)
  - Admin/Manager reviews and clicks Approve (Stamps approvedByName and timestamp)
                   │
                   ▼
[Step 7: Branded PDF Generation & Storage]
  - Generates professional Oestergaard PDF with dual-currency costing table and combined T&Cs
  - Saves file bytes to Amazon S3 and metadata to database
  - Ready for customer delivery or archival
```

---

## 2. Core Subsystems in Manus

| Subsystem | Technology | Responsibility |
| :--- | :--- | :--- |
| **Authentication** | Manus OAuth + RBAC (`admin` vs `user`) | Secures access; restricts supplier config and quote approval to admin roles. |
| **Document Storage** | Amazon S3 via Manus storage helpers | Stores original supplier PDFs and generated quotation PDFs securely without database bloat. |
| **Database** | MySQL / TiDB via Drizzle ORM | Stores quotes, revision chains (Rev A/B/C), line items, supplier rules, and email logs. |
| **Extraction Engine** | Built-in LLM API + Zod schemas | Parses heterogeneous supplier documents into reliable JSON objects. |
| **Pricing Engine** | TypeScript / tRPC backend | Deterministic math for distributor discounts, currency conversion, gross margins, and rounding. |
| **Document Generator** | Server-side PDF kit / HTML-to-PDF | Renders Oestergaard branded quotes with company colors (`#29ABE2`, `#92D050`) and dual terms. |

---

## 3. Multi-Vendor Support Table

| Vendor | Pricing Model | Discount Formula | Margin Method |
| :--- | :--- | :--- | :--- |
| **Foodmate** | As-Is | Direct list pricing | Gross Margin on Sell Price |
| **Collimatic** | Net Price | Net cost provided | Gross Margin on Sell Price |
| **Henneken** | List Minus Distribution | `List × (1 − Discount %)` (e.g. 25% or 30%) | Gross Margin on Sell Price |
| **Marlin / Duravant** | List Minus Distribution | `List × (1 − Distribution Discount %)` | Gross Margin on Sell Price |
| **Nutri Soy** | List Minus Stated | `List × (1 − Stated Discount %)` | Gross Margin on Sell Price |
| **Phenova** | Footer Based | Footer discount rules | Gross Margin on Sell Price |

---

## 4. Operational Advantages of Manus-Only

1. **Zero Integration Overhead:** No third-party API credentials, tenant permissions, or webhook subscriptions to maintain.
2. **Instant Team Onboarding:** Team members simply log in via the web URL.
3. **Guaranteed Determinism:** Business logic resides entirely in version-controlled backend code, eliminating spreadsheet or workflow tool formula errors.
4. **Complete Auditability:** Every action, revision, exchange rate lock, and approval is immutably stamped in the database.
