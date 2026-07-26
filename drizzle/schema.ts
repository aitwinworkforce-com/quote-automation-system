import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Supplier configuration — one entry per supplier, defining how incoming
 * prices must be interpreted before margin is applied.
 * pricingModel values:
 *  - net_price            (Collimatic): price is already Oestergaard net cost
 *  - list_minus_distribution (Marlin / Duravant): list price minus distribution discount
 *  - as_is                (Foodmate): use price exactly as provided
 *  - list_minus_stated_discount (Nutri Soy): list price minus discount stated on quote
 *  - footer_based         (Phenova): read quote footer to determine net vs gross
 */
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  pricingModel: mysqlEnum("pricingModel", [
    "net_price",
    "list_minus_distribution",
    "as_is",
    "list_minus_stated_discount",
    "footer_based",
  ]).notNull(),
  defaultDiscountPct: decimal("defaultDiscountPct", { precision: 6, scale: 3 }),
  defaultMarginPct: decimal("defaultMarginPct", { precision: 6, scale: 3 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(),
  status: mysqlEnum("status", ["draft", "extracted", "costed", "awaiting_sf_number", "finalized"])
    .default("draft")
    .notNull(),
  // Header / customer fields
  customerName: varchar("customerName", { length: 255 }),
  customerContact: varchar("customerContact", { length: 255 }),
  customerAddress: text("customerAddress"),
  productCategory: varchar("productCategory", { length: 255 }),
 productDescription: text("productDescription"),
  technicalDetails: text("technicalDetails"),
  quoteDate: varchar("quoteDate", { length: 32 }),
  // Supplier side
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 128 }),
  supplierQuoteRef: varchar("supplierQuoteRef", { length: 128 }),
  supplierCurrency: mysqlEnum("supplierCurrency", ["EUR", "USD", "AUD"]).default("EUR"),
  supplierTerms: text("supplierTerms"),
  footerPricingNote: text("footerPricingNote"),
  // Costing
  exchangeRate: decimal("exchangeRate", { precision: 12, scale: 6 }),
  exchangeRateConfirmed: int("exchangeRateConfirmed").default(0).notNull(),
  exchangeRateSource: varchar("exchangeRateSource", { length: 128 }),
  marginPct: decimal("marginPct", { precision: 6, scale: 3 }),
  distributionDiscountPct: decimal("distributionDiscountPct", { precision: 6, scale: 3 }),
  freightCostAud: decimal("freightCostAud", { precision: 14, scale: 2 }),
  installationCostAud: decimal("installationCostAud", { precision: 14, scale: 2 }),
  otherLocalCostAud: decimal("otherLocalCostAud", { precision: 14, scale: 2 }),
  totalCostForeign: decimal("totalCostForeign", { precision: 14, scale: 2 }),
  totalSellForeign: decimal("totalSellForeign", { precision: 14, scale: 2 }),
  totalSellAud: decimal("totalSellAud", { precision: 14, scale: 2 }),
  grandTotalAud: decimal("grandTotalAud", { precision: 14, scale: 2 }),
  // Terms
  paymentTerms: text("paymentTerms"),
  deliveryTerms: text("deliveryTerms"),
  validityDays: int("validityDays").default(30),
  warrantyTerms: text("warrantyTerms"),
  // Salesforce
  salesforceQuoteNumber: varchar("salesforceQuoteNumber", { length: 64 }),
  // Versioning / revisions
  parentQuoteId: int("parentQuoteId"),
  rootQuoteId: int("rootQuoteId"),
  revisionLabel: varchar("revisionLabel", { length: 8 }).default("A").notNull(),
  isLatestRevision: int("isLatestRevision").default(1).notNull(),
  revisionNote: text("revisionNote"),
  // Email tracking
  lastSentAt: timestamp("lastSentAt"),
  lastSentTo: varchar("lastSentTo", { length: 320 }),
  // Files
  supplierPdfKey: varchar("supplierPdfKey", { length: 512 }),
  supplierPdfUrl: varchar("supplierPdfUrl", { length: 1024 }),
  supplierPdfName: varchar("supplierPdfName", { length: 255 }),
  generatedPdfKey: varchar("generatedPdfKey", { length: 512 }),
  generatedPdfUrl: varchar("generatedPdfUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

export const quoteLineItems = mysqlTable("quoteLineItems", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  position: int("position").default(0).notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).default("1").notNull(),
  // Prices as extracted from the supplier quote (in supplier currency)
  listUnitPrice: decimal("listUnitPrice", { precision: 14, scale: 2 }),
  discountPct: decimal("discountPct", { precision: 6, scale: 3 }),
  // Net cost to Oestergaard after supplier pricing model applied
  netUnitCost: decimal("netUnitCost", { precision: 14, scale: 2 }),
  // Selling price after margin
  sellUnitPrice: decimal("sellUnitPrice", { precision: 14, scale: 2 }),
  sellTotalPrice: decimal("sellTotalPrice", { precision: 14, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type InsertQuoteLineItem = typeof quoteLineItems.$inferInsert;

export const exchangeRateLog = mysqlTable("exchangeRateLog", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId"),
  pair: varchar("pair", { length: 16 }).notNull(),
  rate: decimal("rate", { precision: 12, scale: 6 }).notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  confirmedBy: int("confirmedBy"),
  confirmedAt: timestamp("confirmedAt"),
});

export type ExchangeRateLogEntry = typeof exchangeRateLog.$inferSelect;

/**
 * Audit log of quotation emails sent to customers.
 */
export const quoteEmailLog = mysqlTable("quoteEmailLog", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  sentBy: int("sentBy").notNull(),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  ccEmail: varchar("ccEmail", { length: 320 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message"),
  status: mysqlEnum("status", ["sent", "failed"]).notNull(),
  errorDetail: text("errorDetail"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type QuoteEmailLogEntry = typeof quoteEmailLog.$inferSelect;
export type InsertQuoteEmailLogEntry = typeof quoteEmailLog.$inferInsert;
