# Oestergaard AI Quotation Agent — Multi-Vendor Scalability & Deployment Blueprint

As Oestergaard scales to handle quotes from multiple equipment suppliers (Foodmate, Henneken, Collimatic, Marlin/Duravant, Nutri Soy, Phenova, and future vendors), maintaining a single unified architecture prevents code duplication and enforces strict financial governance.

---

## 1. Core Architectural Principle: Single Engine, Modular Rules

Instead of building a separate application or workflow for each vendor, use a **Hub-and-Spoke Model**:
- **The Hub (Shared Engine):** Handles user auth, currency exchange rates (ECB), margin calculations, approval workflows, audit trails, and PDF generation.
- **The Spokes (Vendor Profiles & Parsers):** Each vendor has a dedicated entry in the database (`suppliers` table) and a specialized extraction schema, but feeds into the exact same pricing and costing engine.

---

## 2. Multi-Vendor Registry & Rule Versioning

To ensure 100% determinism and audit compliance as specified in Section 3 and 4 of the requirements:

1. **Vendor Registry (`suppliers` table in DB):**
   - `id`: unique supplier code (e.g., `foodmate`, `henneken`, `collimatic`)
   - `name`: display name
   - `pricingModel`: enum (`as_is`, `net_price`, `list_minus_distribution`, `list_minus_stated`, `footer_based`)
   - `defaultDiscountPct`: default distributor discount (e.g., `0.75` for 25% off list)
   - `defaultMarginPct`: default Oestergaard margin (e.g., `0.20` for 20%)
   - `ruleVersion`: version tag (e.g., `FOODMATE-2026-v1`, `HENNEKEN-2026-v1`)

2. **Per-Vendor Extraction Prompts:**
   - Because supplier PDF layouts vary wildly (Foodmate tables vs. Henneken quotation letters vs. Phenova footer schedules), the AI extraction layer uses a **vendor classifier** upon upload.
   - Once the vendor is identified (or manually selected by the user), the system applies the tailored JSON extraction schema for that vendor to capture line items, model numbers, list prices, and currencies accurately.

---

## 3. Recommended Deployment Setup for Your Team

### Option A: Web App on Railway (Recommended for Active Quotation Teams)
- **Host:** Railway (or Manus hosting).
- **Why:** Instant access for all sales reps via web browser, centralized database (`quotes`, `quoteLineItems`, `suppliers`), automated PDF generation, and built-in audit trails.
- **Multi-Vendor Expansion:** Add new vendors instantly via the admin settings page (`/settings/suppliers`) without modifying code.

### Option B: Power Automate + SharePoint + Azure (Microsoft 365 Native)
- **Host:** SharePoint Document Library (`/Oestergaard/Incoming/{VendorName}/`) + Power Automate.
- **Multi-Vendor Expansion:** 
  - Create a subfolder for each vendor.
  - Configure Power Automate child flows triggered by folder path.
  - Store supplier rules in a SharePoint list `SupplierRulesMaster` indexed by Vendor ID.

---

## 4. Best Practices for Onboarding a New Vendor

When adding a new supplier (e.g., a new European processing machinery vendor):
1. **Upload 3 historical sample quotes** to test the extraction model.
2. **Review their pricing structure** (Do they give net prices? List prices with distributor discount? Or footer discounts?).
3. **Configure the supplier profile** in the admin settings (set pricing model code and default discount/margin).
4. **Run a test quote** and compare the generated AUD grand total against your manual Excel costing sheet. Once matching to the cent, publish for team use.
