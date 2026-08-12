# Oestergaard AI Quotation Agent — n8n Hybrid Orchestration Deployment Guide

This guide covers setting up and running the hybrid n8n workflow for Oestergaard, integrating SharePoint document drops, n8n Form approval gates, and the deterministic web app pricing engine.

---

## 1. Architecture Overview

```
[Supplier PDF dropped in SharePoint /Oestergaard/Incoming/]
                    │
                    ▼ (Poll every minute)
      [n8n Workflow: SharePoint Trigger]
                    │
                    ▼ (POST /api/trpc/quotes.uploadAndExtract)
     [Web App AI Extraction & Pricing Engine]
                    │
                    ▼
          [n8n Form: Review Gate]
                    │
                    ▼ (POST /api/trpc/quotes.confirmRate)
          [n8n Form: FX & T&Cs Gate]
                    │
                    ▼ (POST /api/trpc/pdf.generateQuote)
          [Branded PDF Generated]
                    │
                    ├──────────────────────────────┐
                    ▼                              ▼
      [Upload to SharePoint Finalized]   [Append Row to Audit Log Excel]
```

---

## 2. Step-by-Step Setup

### Step A: Import Workflow in n8n
1. Log in to your n8n instance at `https://jusclickz.pixelautomation.cloud/`.
2. Go to **Workflows** → **Import from File**.
3. Upload `n8n-workflow-oestergaard.json` from your project folder.
4. Update the HTTP Request node credentials to point to your live Web App API key or Manus OAuth bearer token.

### Step B: Configure SharePoint Folder Structure
In your SharePoint site (`aitwinworkforce` under `Oestergaard`), ensure these three folders exist:
- `/Oestergaard/Incoming/` (Drop supplier PDFs here)
- `/Oestergaard/Finalized/` (Completed Oestergaard quotes land here)
- `/Oestergaard/AuditReviewLog.xlsx` (Excel tracking sheet based on `AuditReviewLog-Template.md`)

### Step C: Configure n8n Form Nodes
1. Open the **n8n Form - Review Gate** and **n8n Form - T&Cs Gate** nodes.
2. Publish the form webhook URLs so reps can access the interactive review screens to check line items and confirm terms.

---

## 3. Key Rotation & Security Note
- The n8n API key used during provisioning should be rotated periodically within your n8n instance settings.
- All pricing calculations and margin computations continue to be executed deterministically by the Web App backend to ensure 100% compliance with Oestergaard's financial rules.
