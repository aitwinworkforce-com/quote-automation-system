# Oestergaard AI Quotation Agent — Excel Audit Review Log Template

This document defines the schema for `AuditReviewLog.xlsx` hosted in your SharePoint folder (`/Oestergaard/AuditReviewLog.xlsx`). Every quote processed through the hybrid n8n workflow appends an immutable row to this sheet to satisfy the audit trail requirements in Section 5.1 of the Consolidated Requirements & Design Specification.

## Column Schema

| Column Header | Data Type | Description | Source / Gate |
| :--- | :--- | :--- | :--- |
| **Quote ID** | Number | Internal database identifier | Web App Engine |
| **Salesforce #** | Text | SF quote number (e.g. `SF-Q-2026-00147`) | SetSalesforceNumber Step |
| **Customer Name** | Text | Client entity (e.g. `Baiada Poultry Pty Ltd`) | AI Extraction |
| **Supplier Name** | Text | Equipment vendor (e.g. `Foodmate`) | AI Extraction |
| **Currency** | Text | Base currency (`EUR` / `USD` / `AUD`) | AI Extraction |
| **Total Foreign** | Currency | Total cost in foreign currency | Pricing Engine |
| **Exchange Rate** | Number | FX rate applied (e.g. `0.6142`) | ECB via FX Gate |
| **FX Confirmed By** | Text | Name of user who confirmed the rate | FX Gate Form |
| **FX Confirmed At** | ISO Timestamp | Exact time rate was locked | FX Gate Form |
| **Grand Total (AUD)** | Currency | Final sell price in AUD (ex GST) | Deterministic Code |
| **Pricing Rule Version**| Text | Version tag of supplier pricing logic | Supplier Rule Store |
| **Review Status** | Text | Current status (`Draft` / `In Review` / `Finalized`) | Workflow State |
| **Approver Name** | Text | Manager/Rep who completed T&Cs gate | T&Cs Gate Form |
| **Approved At** | ISO Timestamp | Exact timestamp of final approval | T&Cs Gate Form |
| **SharePoint PDF Link**| URL | Direct link to finalized PDF in `/Oestergaard/Finalized/` | SharePoint Upload Node |
| **Audit Notes** | Text | Optional comments or revision notes | Reviewer Input |

## Usage
1. Upload this structure as an Excel workbook named `AuditReviewLog.xlsx` to your SharePoint folder `/Oestergaard/`.
2. The n8n Excel node will append new rows automatically as each quote clears the T&Cs approval gate.
