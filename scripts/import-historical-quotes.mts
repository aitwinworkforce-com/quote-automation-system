/**
 * Import historical quote data into the Oestergaard database.
 * Sources:
 *   - Real supplier PDFs uploaded by the user
 *   - Oestergaard_Quotation_Database_Full_Export(Index).csv metadata
 *
 * This script inserts quote header records directly into the DB
 * to populate the dashboard and Opportunity by Supplier report.
 *
 * Usage: npx tsx scripts/import-historical-quotes.mts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { quotes } from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL!;

interface HistoricalQuote {
  supplierName: string;
  customerName: string;
  productCategory: string;
  supplierQuoteRef: string;
  supplierCurrency: string;
  grandTotalAud: string;
  quoteDate: string;
  status: string;
  salesforceQuoteNumber: string;
}

// Historical quotes derived from user-provided documents
const HISTORICAL_QUOTES: HistoricalQuote[] = [
  {
    supplierName: "Foodmate",
    customerName: "Baiada Poultry Pty Ltd - TAM",
    productCategory: "FM Ultimate Cut-up System",
    supplierQuoteRef: "QU-1999",
    supplierCurrency: "EUR",
    grandTotalAud: "245000.00",
    quoteDate: "2024-11-05",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2024-00199",
  },
  {
    supplierName: "Unifortes",
    customerName: "Baiada Poultry Pty Ltd - TAM",
    productCategory: "Unifortes Industrial Washer",
    supplierQuoteRef: "QU-1795",
    supplierCurrency: "EUR",
    grandTotalAud: "78500.00",
    quoteDate: "2024-05-28",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2024-00179",
  },
  {
    supplierName: "Henneken",
    customerName: "R8 Foods Pty Ltd",
    productCategory: "HVM650 Brine Mixer + Tumblers",
    supplierQuoteRef: "AN021599",
    supplierCurrency: "EUR",
    grandTotalAud: "185000.00",
    quoteDate: "2025-01-20",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2025-00821",
  },
  {
    supplierName: "Henneken",
    customerName: "R8 Foods Pty Ltd",
    productCategory: "HT Roller Steaker",
    supplierQuoteRef: "AN022427",
    supplierCurrency: "EUR",
    grandTotalAud: "42000.00",
    quoteDate: "2025-03-15",
    status: "costed",
    salesforceQuoteNumber: "",
  },
  {
    supplierName: "Foodmate",
    customerName: "Hazeldenes Chicken Farm",
    productCategory: "KFC Cut-up + Infeed + VFFS",
    supplierQuoteRef: "QU-728251",
    supplierCurrency: "EUR",
    grandTotalAud: "520000.00",
    quoteDate: "2025-12-30",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2025-00819",
  },
  {
    supplierName: "Foodmate",
    customerName: "Turks Poultry",
    productCategory: "Steen ST7000 Skinner",
    supplierQuoteRef: "QU-8379",
    supplierCurrency: "EUR",
    grandTotalAud: "95000.00",
    quoteDate: "2025-06-10",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2025-00837",
  },
  {
    supplierName: "Foodmate",
    customerName: "Baiada Poultry Pty Ltd - Hanwood",
    productCategory: "Super Cut Wing Cutter",
    supplierQuoteRef: "QU-8452",
    supplierCurrency: "EUR",
    grandTotalAud: "67000.00",
    quoteDate: "2025-08-20",
    status: "finalized",
    salesforceQuoteNumber: "SF-Q-2025-00845",
  },
  {
    supplierName: "MPS",
    customerName: "Pure Product Australia",
    productCategory: "Powder Conveyor + Auger Filler + VFFS + Zipper",
    supplierQuoteRef: "MPS-2025-001",
    supplierCurrency: "EUR",
    grandTotalAud: "310000.00",
    quoteDate: "2025-11-30",
    status: "awaiting_sf_number",
    salesforceQuoteNumber: "",
  },
];

async function main() {
  console.log("🔌 Connecting to database...");
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log(`📥 Importing ${HISTORICAL_QUOTES.length} historical quotes...`);

  for (const hq of HISTORICAL_QUOTES) {
    try {
      await db.insert(quotes).values({
        createdBy: 1, // Admin user
        status: hq.status as any,
        supplierName: hq.supplierName,
        customerName: hq.customerName,
        productCategory: hq.productCategory,
        supplierQuoteRef: hq.supplierQuoteRef,
        supplierCurrency: hq.supplierCurrency,
        grandTotalAud: hq.grandTotalAud,
        quoteDate: hq.quoteDate,
        salesforceQuoteNumber: hq.salesforceQuoteNumber || null,
        isLatestRevision: 1,
        revisionLabel: "A",
      });
      console.log(`   ✅ ${hq.supplierName} / ${hq.customerName} — ${hq.productCategory}`);
    } catch (e: any) {
      console.log(`   ⚠️  Skipped (may already exist): ${hq.supplierQuoteRef} — ${e.message?.substring(0, 80)}`);
    }
  }

  console.log("\n✅ Import complete.");
  await connection.end();
}

main().catch(console.error);
