/**
 * Seed sample quote data demonstrating the full workflow
 * with Oestergaard and Foodmate T&Cs integrated.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { quotes, quoteLineItems } from "../drizzle/schema";
import { ENV } from "../server/_core/env";

const db = drizzle(process.env.DATABASE_URL!);

async function seedSampleQuotes() {
  console.log("[Seed] Creating sample quotes with Oestergaard & Foodmate T&Cs...");

  // Sample Quote 1: Foodmate Wing Cutter (completed workflow)
  const quote1Id = await db
    .insert(quotes)
    .values({
      customerName: "Baiada Poultry Pty Ltd",
      customerContact: "Gurpreet Singh",
      customerAddress: "Murphy's Road, Hanwood NSW",
      productDescription: "Foodmate Wing Cutter Super Cut",
      productCategory: "Poultry Processing",
      supplierName: "Foodmate",
      supplierQuoteRef: "QU-8452",
      quotationNumber: "Q732717",
      salesforceQuoteNumber: "SF-2026-001",
      technicalDetails: "Length: 1593mm, Width: 1297mm, Height: 1507mm, Weight: 285kg, Electrical: 2x 0.75kW (IP66)",
      lineItemsJson: JSON.stringify([
        {
          description: "Wing Cutter Super Cut Module",
          quantity: 1,
          unitPrice: 45000,
          currency: "EUR",
          supplier: "Foodmate",
        },
      ]),
      supplierCostEUR: 45000,
      supplierCostAUD: 74250, // EUR 45000 @ 1.65 AUD/EUR
      marginPct: 25,
      freightAUD: 2500,
      installationAUD: 1500,
      otherCostsAUD: 0,
      totalCostAUD: 78250,
      sellingPriceAUD: 97812.5, // (78250 * 1.25)
      exchangeRateAUDEUR: 1.65,
      exchangeRateAUDUSD: 0.67,
      exchangeRateConfirmed: true,
      status: "finalized",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .then((result) => result[0]);

  console.log(`[Seed] Created sample quote 1 (ID: ${quote1Id})`);

  // Sample Quote 2: Collimatic equipment (in-progress workflow)
  const quote2Id = await db
    .insert(quotes)
    .values({
      customerName: "Advance Meat Processing",
      customerContact: "John Smith",
      customerAddress: "123 Industrial Ave, Sydney NSW",
      productDescription: "Collimatic Portioning System",
      productCategory: "Meat Processing",
      supplierName: "Collimatic",
      supplierQuoteRef: "COL-2026-456",
      quotationNumber: null,
      salesforceQuoteNumber: null,
      technicalDetails: "Automatic portioning system, capacity 500 units/hour",
      lineItemsJson: JSON.stringify([
        {
          description: "Collimatic Portioner Unit",
          quantity: 1,
          unitPrice: 65000,
          currency: "EUR",
          supplier: "Collimatic",
        },
      ]),
      supplierCostEUR: 65000,
      supplierCostAUD: 107250, // EUR 65000 @ 1.65 AUD/EUR
      marginPct: 30,
      freightAUD: 3500,
      installationAUD: 2000,
      otherCostsAUD: 500,
      totalCostAUD: 113250,
      sellingPriceAUD: 147225, // (113250 * 1.30)
      exchangeRateAUDEUR: 1.65,
      exchangeRateAUDUSD: 0.67,
      exchangeRateConfirmed: false,
      status: "extraction_complete",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .then((result) => result[0]);

  console.log(`[Seed] Created sample quote 2 (ID: ${quote2Id})`);

  console.log("[Seed] Sample quotes created successfully!");
  console.log(`\nQuote 1 (Finalized):`);
  console.log(`  Customer: Baiada Poultry Pty Ltd`);
  console.log(`  Product: Foodmate Wing Cutter Super Cut`);
  console.log(`  Selling Price: $${97812.5.toFixed(2)} AUD`);
  console.log(`  Status: Finalized with SF number SF-2026-001`);
  console.log(`\nQuote 2 (In Progress):`);
  console.log(`  Customer: Advance Meat Processing`);
  console.log(`  Product: Collimatic Portioning System`);
  console.log(`  Selling Price: $${147225.toFixed(2)} AUD`);
  console.log(`  Status: Awaiting Salesforce number and PDF generation`);
}

seedSampleQuotes().catch(console.error).finally(() => process.exit(0));
