# Standalone Customer Productization & SharePoint Integration Blueprint

This document defines how to package the Oestergaard Quote Agent into a **standalone, white-labeled quotation product** that industrial equipment companies and agencies can deploy for their own operations, integrate with their Microsoft 365 SharePoint tenants, and manage independently without modifying source code.

---

## 1. Productization Architecture (Multi-Tenant SaaS vs. Single-Tenant Instances)

To offer this app to other businesses, choose one of two packaging models:

| Packaging Model | How It Works | Best For |
|---|---|---|
| **Multi-Tenant SaaS (Centralized)** | Single hosted application instance where each customer logs in with their own Microsoft 365 tenant (OAuth / Entra ID) and their quotes/suppliers are logically isolated by `tenantId`. | Scale, recurring SaaS billing, centralized updates, rapid onboarding. |
| **Dedicated Single-Tenant Instance** | Each customer gets their own isolated Railway / Manus container deployment and database. | Enterprise clients with strict data residency, custom security reviews, or proprietary pricing engines. |

---

## 2. Customer-Facing Configuration & Self-Service Admin

Customers should never need to edit code. Instead, all customizations are handled through the admin UI:
1. **Vendor Pricing Profiles:** Add/edit suppliers (`Foodmate`, `Henneken`, `Steen`, etc.), select pricing models (`net_price`, `list_minus_distribution`, `as_is`, `list_minus_stated`, `footer_based`), and configure default discount/margin percentages.
2. **Global & Per-Vendor Adjustments:** Configure currency exchange markdowns (e.g., the 2% markdown) and default local freight/installation allowances.
3. **Template & Branding Settings:** Upload company logos, adjust header accent colors (`#29ABE2`, `#92D050`), and customize T&C boilerplate clauses.

---

## 3. Customer SharePoint & Microsoft 365 Integration

Rather than hardcoding Oestergaard's SharePoint site, the app provides a **SharePoint Connection Wizard**:
- **Microsoft Entra ID Multi-Tenant App Registration:** Customers authorize the quote agent application to access their SharePoint site via Microsoft Graph API.
- **Folder Mapping:** Administrators map their SharePoint site URL and select folders (`/Incoming/`, `/Finalized/`) and lists (`QuotesAuditMaster`).
- **Sync & Audit Sync:** The app handles bi-directional file retrieval, PDF filing, and audit record synchronization automatically.

---

## 4. Standalone Onboarding Checklist for New Customers

1. **Deploy Instance:** Provision tenant container & database.
2. **Connect Microsoft 365:** Complete OAuth consent for SharePoint document libraries.
3. **Configure Suppliers:** Input initial supplier discount tiers and markup percentages.
4. **Upload Test Quote:** Process a sample supplier PDF to verify AI extraction, currency conversion, 2% markdown, margin calculations, and PDF generation.
5. **Go Live:** Bind custom domain (e.g., `quotes.clientcompany.com`).
