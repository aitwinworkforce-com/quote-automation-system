/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";
// ===== Oestergaard Quote Agent shared types =====

export const QUOTE_STATUSES = ["draft", "extracted", "costed", "awaiting_sf_number", "finalized"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  extracted: "Extracted",
  costed: "Costed",
  awaiting_sf_number: "Awaiting SF Number",
  finalized: "Finalised",
};

export const PRODUCT_CATEGORIES = [
  "Poultry Processing",
  "Rendering",
  "Packaging",
  "Further Processing",
  "Spare Parts",
  "Other",
] as const;
