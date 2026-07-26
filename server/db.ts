import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  exchangeRateLog,
  InsertQuoteEmailLogEntry,
  InsertQuote,
  InsertQuoteLineItem,
  InsertUser,
  quoteEmailLog,
  quoteLineItems,
  quotes,
  InsertSupplier,
  suppliers,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplierByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(suppliers).where(eq(suppliers.name, name)).limit(1);
  return rows[0];
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return rows[0];
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function createSupplier(data: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(data);
  return result[0].insertId;
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export async function createQuote(data: InsertQuote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(quotes).values(data);
  return result[0].insertId;
}

export async function updateQuote(id: number, data: Partial<InsertQuote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotes).set(data).where(eq(quotes.id, id));
}

export async function getQuoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return rows[0];
}

export async function deleteQuote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id));
  await db.delete(quotes).where(eq(quotes.id, id));
}

// ---------------------------------------------------------------------------
// Quote revisions
// ---------------------------------------------------------------------------

/** All revisions in a quote family (same rootQuoteId), oldest first. */
export async function getQuoteRevisions(rootQuoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(quotes)
    .where(eq(quotes.rootQuoteId, rootQuoteId))
    .orderBy(quotes.id);
}

/** Mark every revision in a family as not-latest (before inserting a new one). */
export async function clearLatestRevisionFlag(rootQuoteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotes).set({ isLatestRevision: 0 }).where(eq(quotes.rootQuoteId, rootQuoteId));
}

// ---------------------------------------------------------------------------
// Quote email log
// ---------------------------------------------------------------------------

export async function logQuoteEmail(entry: InsertQuoteEmailLogEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(quoteEmailLog).values(entry);
  return result[0].insertId;
}

export async function getQuoteEmailLog(quoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(quoteEmailLog)
    .where(eq(quoteEmailLog.quoteId, quoteId))
    .orderBy(desc(quoteEmailLog.sentAt));
}

export interface QuoteFilter {
  search?: string;
  status?: string;
  supplierName?: string;
}

export async function listQuotes(filter: QuoteFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.search) {
    const term = `%${filter.search}%`;
    conditions.push(
      or(
        like(quotes.customerName, term),
        like(quotes.productDescription, term),
        like(quotes.supplierQuoteRef, term),
        like(quotes.salesforceQuoteNumber, term),
        like(quotes.supplierName, term),
      ),
    );
  }
  if (filter.status) {
    conditions.push(eq(quotes.status, filter.status as "draft"));
  }
  if (filter.supplierName) {
    conditions.push(eq(quotes.supplierName, filter.supplierName));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(quotes).where(where).orderBy(desc(quotes.createdAt));
}

// ---------------------------------------------------------------------------
// Quote line items
// ---------------------------------------------------------------------------

export async function replaceQuoteLineItems(quoteId: number, items: InsertQuoteLineItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  if (items.length > 0) {
    await db.insert(quoteLineItems).values(items);
  }
}

export async function getQuoteLineItems(quoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, quoteId))
    .orderBy(quoteLineItems.position);
}

// ---------------------------------------------------------------------------
// Exchange rate log (audit trail of fetched + confirmed rates)
// ---------------------------------------------------------------------------

export async function logExchangeRate(entry: {
  quoteId?: number;
  pair: string;
  rate: string;
  source: string;
  confirmedBy?: number;
  confirmedAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(exchangeRateLog).values(entry);
}
