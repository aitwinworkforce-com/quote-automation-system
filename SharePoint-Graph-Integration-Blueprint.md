# Oestergaard AI Quotation Agent — SharePoint & Microsoft Graph Integration Blueprint

This blueprint outlines how the Oestergaard Quote Agent integrates directly with Microsoft SharePoint and Microsoft Graph API (Option A architecture):
1. **SharePoint Document Library (`/Oestergaard/Incoming/`)**: Used for browsing, selecting, or uploading supplier quotation PDFs.
2. **SharePoint Document Library (`/Oestergaard/Finalized/`)**: Receives the generated Oestergaard quotation PDFs automatically upon quote finalization.
3. **SharePoint List (`QuotesAuditMaster`)**: Acts as the authoritative, concurrent-safe database of record for all audit trails, approval stamps, FX confirmations, and pricing versions.
4. **Excel Workbook (`AuditReviewLog.xlsx`)**: Synchronized periodically or on-demand as a human-friendly reporting view.

---

## 1. Microsoft Graph API Authentication & Permissions

To connect the Manus-hosted app to `aitwinworkforce.sharepoint.com`, set up an **Azure Entra ID App Registration**:
- **Authentication:** OAuth 2.0 Client Credentials or Authorization Code flow.
- **Required Microsoft Graph Application/Delegated Permissions:**
  - `Sites.ReadWrite.All`: Allows reading and writing files in SharePoint document libraries.
  - `Files.ReadWrite.All`: Allows uploading finalized quotation PDFs.
  - `List.ReadWrite.All`: Allows creating and updating items in the `QuotesAuditMaster` SharePoint List.

---

## 2. API Endpoints & Operations

### A. Browse / Read Supplier PDFs from SharePoint
- **Endpoint:** `GET /sites/{site-id}/ドライブ/items/{item-id}/children` or Microsoft Picker SDK.
- **Usage:** Rep selects an incoming supplier PDF from `/Oestergaard/Incoming/` directly inside the Manus quote wizard.

### B. Upload Finalized PDF to SharePoint
- **Endpoint:** `PUT /sites/{site-id}/drives/{drive-id}/root:/Oestergaard/Finalized/{filename}:/content`
- **Usage:** When a quote is approved and finalized, the server pushes the generated PDF bytes directly into SharePoint with permanent link retention.

### C. Write Immutable Audit Record to SharePoint List
- **Endpoint:** `POST /sites/{site-id}/lists/{list-id}/items`
- **Payload Schema:**
  ```json
  {
    "fields": {
      "Title": "SF-Q-2026-00147",
      "CustomerName": "Baiada Poultry Pty Ltd",
      "SupplierName": "Foodmate",
      "Currency": "EUR",
      "ExchangeRate": 0.6142,
      "RateConfirmedBy": "Bamah",
      "RateConfirmedAt": "2026-07-27T12:34:00Z",
      "GrandTotalAud": 83618.63,
      "PricingVersion": "FOODMATE-2026-01",
      "ApprovalStatus": "Finalized",
      "ApprovedBy": "Bamah",
      "ApprovedAt": "2026-07-27T12:40:00Z",
      "SharePointPdfUrl": "https://aitwinworkforce.sharepoint.com/..."
    }
  }
  ```

---

## 3. Concurrency & Safety (Option A)
Writing directly to Excel files via API on every quote creation causes file-locking errors when multiple reps generate quotes simultaneously. By storing audit records in a **SharePoint List**, Microsoft handles concurrent writes safely. The Excel tracker (`AuditReviewLog.xlsx`) can be viewed or exported directly from the SharePoint list whenever management requires a spreadsheet view.
