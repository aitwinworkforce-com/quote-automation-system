# Oestergaard AI Quotation Agent — Microsoft Power Automate & Azure Architecture Guide

This blueprint translates the Consolidated Requirements & Design Specification v1.0 into a native Microsoft 365 and Azure architecture, leveraging Power Automate, SharePoint lists/libraries, Azure AI Document Intelligence, Azure Functions (for deterministic pricing arithmetic), and native Microsoft Approvals.

---

## 1. Architecture Mapping

| Component | Microsoft 365 / Azure Service | Role in the Workflow |
| :--- | :--- | :--- |
| **Document Intake** | SharePoint Document Library (`/Oestergaard/Incoming/`) | Triggers the pipeline when a supplier PDF is uploaded. |
| **AI Extraction** | Azure AI Document Intelligence (Custom Models / GPT-4o via Azure OpenAI) | Extracts heterogeneous line items, quantities, and supplier metadata. |
| **Deterministic Pricing** | Azure Function (.NET 8 / Node.js) or Power Fx | Executes strict pricing models (net, list-less-distribution, as-is, list-less-stated, footer-based) and margin calculation (`sell = cost / (1 - marginPct)`). Never lets AI compute money. |
| **Control Gates** | Microsoft Approvals (Teams / Outlook adaptive cards) | Manages the three blocking gates: Review Gate, FX Gate, and T&Cs Gate. |
| **Audit & State Store** | SharePoint List or Dataverse Table (`QuotesAuditMaster`) | Stores immutable audit trails, FX snapshots, rule versions, and approval stamps. |
| **Review Interface** | Excel Online (Shared SharePoint Workbook) or Power Apps | Optional tabular review workspace for reps to inspect calculations. |
| **Document Assembly** | Word Online connector + PDF conversion | Injects structured quote data into Oestergaard's official template and renders final PDF. |
| **Final Archive** | SharePoint Document Library (`/Oestergaard/Finalized/`) | Stores issued quotation PDFs with secure versioning. |

---

## 2. Power Automate Flow Structure

### Flow: `Oestergaard-Quote-Orchestrator`

1. **Trigger:** When a new file is created in SharePoint folder `/Oestergaard/Incoming/`.
2. **Action (AI Extraction):** Call Azure OpenAI / Document Intelligence to extract supplier quote fields into JSON.
3. **Action (Rule Lookup):** Fetch supplier pricing rule version and parameters from SharePoint List `SupplierRules`.
4. **Action (Deterministic Pricing):** Send extracted cost data and FX rate to an Azure Function to compute sell prices and AUD grand totals.
5. **Approval 1 (Review Gate):** Send Microsoft Teams Adaptive Card to sales rep with extracted line items for approval.
6. **Approval 2 (FX Gate):** Retrieve live ECB exchange rate, display confirmation prompt to rep.
7. **Approval 3 (T&Cs Gate):** Confirm adherence to Oestergaard and supplier T&Cs.
8. **Action (Document Assembly):** Populate Oestergaard Word template, convert to PDF, and save to `/Oestergaard/Finalized/`.
9. **Action (Audit Commit):** Create immutable record in SharePoint List `QuotesAuditMaster` with approver identity, timestamps, FX snapshot, and rule version.

---

## 3. Parallel Transition Strategy

- **Live Web App:** Remains active at its current preview/published URL for immediate quote generation and user testing.
- **Power Automate Pilot:** Built in a dedicated dev/test SharePoint site and tested against historical supplier PDFs (such as the Foodmate Baiada Hanwood deal) alongside the web app.
- **Cutover:** Once Power Automate achieves 100% parity and verification against the deterministic rules engine, the SharePoint incoming trigger becomes primary.
