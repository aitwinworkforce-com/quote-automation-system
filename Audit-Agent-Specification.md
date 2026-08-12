# Oestergaard Automated Audit Agent Specification

This document defines the recurring automated audit agent architecture for the Oestergaard Quote Agent, implementing the `webdev-periodic-updates` Heartbeat SDK pattern.

---

## 1. Audit Scope & Checks

The audit agent executes daily at 03:00 UTC (or on-demand via the admin dashboard) to perform 5 core verification checks across all active and finalized quotations:

1. **Calculation Integrity Check:**
   - Verifies that every line item's net purchase price and sell price match the active supplier pricing model (Foodmate, Henneken list-minus-distribution, Steen, etc.) without negative margins or calculation drift.
2. **Missing Document Check:**
   - Detects quotes in `finalized` or `awaiting_sf_number` status where the S3 PDF file URL is missing or inaccessible.
3. **Stale Workflow Check:**
   - Identifies quotes stuck in `in_review` or `draft` status for > 7 days without progress updates.
4. **Exchange Rate Audit Verification:**
   - Confirms that every costed quote has a valid `rateConfirmedByName` and `rateConfirmedAt` timestamp.
5. **SharePoint / Audit Log Readiness:**
   - Inspects the SharePoint audit queue to ensure all newly finalized quotes have been successfully queued for `AuditReviewLog.xlsx` synchronization.

---

## 2. Execution Route & Heartbeat Integration

- **Trigger:** Scheduled Heartbeat job (`0 0 3 * * *` daily) or manual admin trigger.
- **Endpoint:** POST `/api/scheduled/run-audit-agent`
- **Auth:** `sdk.authenticateRequest(req)` verifying `user.isCron === true`.
- **Idempotency:** Results are persisted to an `auditLogs` database table so duplicate or retried runs do not duplicate alerts.
