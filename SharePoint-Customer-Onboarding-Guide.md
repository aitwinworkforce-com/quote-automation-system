# SharePoint Integration & Customer Onboarding Guide

This guide details how to connect the Oestergaard Quote Agent (or any standalone customer instance) to Microsoft 365 SharePoint sites (`aitwinworkforce.sharepoint.com` or any future customer tenant), and provides a repeatable onboarding checklist for deploying this solution to new clients.

---

## Part 1: Connecting Your `aitwinworkforce` SharePoint Site

To link your application to `https://aitwinworkforce.sharepoint.com/sites/aitwinworkforce`:

### Step 1: Create the Required Folders & Lists in SharePoint
1. Open your SharePoint site at `https://aitwinworkforce.sharepoint.com/sites/aitwinworkforce`.
2. Go to **Documents** (Shared Documents library).
3. Create a folder named `Oestergaard`.
4. Inside `Oestergaard`, create two subfolders:
   - `Incoming` (where supplier quote PDFs are dropped).
   - `Finalized` (where completed, branded quotation PDFs are automatically saved).
5. (Optional) Create an Excel workbook named `AuditReviewLog.xlsx` inside `/Oestergaard/` with columns matching our audit schema.

### Step 2: Register an Entra ID App (Azure Portal) for Microsoft Graph Access
1. Go to [Azure Portal (Entra ID)](https://entra.microsoft.com/).
2. Navigate to **App registrations** → **New registration**.
3. Name it `Oestergaard Quote Agent - SharePoint Connector`.
4. Set supported account types to **Accounts in this organizational directory only (Single tenant)** or multi-tenant if onboarding other organizations.
5. Under **API permissions**, add **Microsoft Graph** delegated or application permissions:
   - `Files.ReadWrite.All` (to read incoming PDFs and save finalized quotations).
   - `Sites.Read.All` (to resolve the SharePoint site URL).
6. Generate a **Client Secret** under *Certificates & secrets* and save the `Client ID`, `Tenant ID`, and `Client Secret`.

### Step 3: Configure Environment Secrets in the App
Use the secure secrets tool to inject the credentials into your deployment:
- `SHAREPOINT_SITE_URL` = `https://aitwinworkforce.sharepoint.com/sites/aitwinworkforce`
- `AZURE_TENANT_ID` = `your-tenant-id`
- `AZURE_CLIENT_ID` = `your-client-id`
- `AZURE_CLIENT_SECRET` = `your-client-secret`

---

## Part 2: Repeatable Onboarding Guide for Future Customers

When selling or deploying this quotation agent to a new industrial equipment client, use this checklist to set up their isolated tenant:

### Onboarding Checklist for New Customers
1. **Tenant Provisioning:** Deploy a dedicated instance or isolated organization space for the client.
2. **Microsoft 365 Consent (OAuth):** Have the client's IT administrator sign in via the app's Microsoft 365 Onboarding screen to grant Graph API consent (`Files.ReadWrite.All`).
3. **Site & Library Mapping:** Enter the customer's SharePoint site URL (e.g., `https://clientco.sharepoint.com/sites/sales`) in the app admin settings.
4. **Folder Setup:** Automatically provision or instruct the client to create `/Oestergaard/Incoming` and `/Oestergaard/Finalized` folders.
5. **Supplier Pricing Rules Import:** Configure the client's specific suppliers (`Foodmate`, `Henneken`, `Steen`, etc.), discount tiers, and default margins.
6. **Branding & Templates:** Upload the client's company logo and configure their PDF accent colors.
7. **Test Run:** Upload a sample supplier PDF to verify end-to-end extraction, deterministic pricing, 2% currency markdown, approval workflow, and SharePoint PDF filing.
