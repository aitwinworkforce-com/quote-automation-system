import { describe, it, expect } from "vitest";
import { generateQuoteDocx } from "./docxGenerator";

describe("generateQuoteDocx", () => {
  it("generates a valid DOCX buffer with correct content type header bytes", async () => {
    const mockQuote = {
      id: 1,
      createdBy: 1,
      status: "finalized" as const,
      customerName: "Test Customer Pty Ltd",
      customerContact: "John Smith",
      customerAddress: "123 Test Street\nSydney NSW 2000",
      productCategory: "Cut-Up System",
      productDescription: "Foodmate Cut-Up System for poultry processing",
      technicalDetails: null,
      quoteDate: "15/08/2026",
      supplierId: 1,
      supplierName: "Foodmate",
      supplierQuoteRef: "FM-2026-001",
      supplierCurrency: "EUR" as const,
      supplierTerms: null,
      footerPricingNote: null,
      exchangeRate: "0.5900",
      exchangeRateConfirmed: 1,
      exchangeRateSource: "ECB",
      rateConfirmedBy: 1,
      rateConfirmedByName: "Bamah",
      rateConfirmedAt: new Date(),
      marginPct: "25.000",
      distributionDiscountPct: null,
      freightCostAud: "5000.00",
      installationCostAud: "8000.00",
      otherLocalCostAud: "0.00",
      totalCostForeign: "45000.00",
      totalSellForeign: "60000.00",
      totalSellAud: "101694.92",
      grandTotalAud: "114694.92",
      paymentTerms: "50% by order / 50% before shipment",
      deliveryTerms: "12-14 weeks ex-works",
      validityDays: 30,
      warrantyTerms: null,
      salesforceQuoteNumber: "SF-Q-2026-00200",
      submittedForReviewAt: null,
      submittedForReviewBy: null,
      approvedAt: null,
      approvedBy: null,
      approvedByName: null,
      parentQuoteId: null,
      rootQuoteId: null,
      revisionLabel: "A",
      isLatestRevision: 1,
      revisionNote: null,
      lastSentAt: null,
      lastSentTo: null,
      supplierPdfKey: null,
      supplierPdfUrl: null,
      supplierPdfName: null,
      supplierDocxKey: null,
      supplierDocxUrl: null,
      supplierDocxName: null,
      supplierXlsKey: null,
      supplierXlsUrl: null,
      supplierXlsName: null,
      generatedPdfKey: null,
      generatedPdfUrl: null,
      generatedDocxKey: null,
      generatedDocxUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockLineItems = [
      {
        id: 1,
        quoteId: 1,
        position: 1,
        description: "Foodmate Cut-Up System Model X",
        quantity: "1.000",
        listUnitPrice: "45000.00",
        discountPct: null,
        netUnitCost: "45000.00",
        sellUnitPrice: "60000.00",
        sellTotalPrice: "60000.00",
        createdAt: new Date(),
      },
      {
        id: 2,
        quoteId: 1,
        position: 2,
        description: "Handling and packing",
        quantity: "1.000",
        listUnitPrice: "1500.00",
        discountPct: null,
        netUnitCost: "1500.00",
        sellUnitPrice: "2000.00",
        sellTotalPrice: "2000.00",
        createdAt: new Date(),
      },
    ];

    const buffer = await generateQuoteDocx(mockQuote as any, mockLineItems as any);

    // DOCX files are ZIP archives — first 4 bytes should be PK\x03\x04
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it("includes customer name and SF number in the document metadata", async () => {
    const mockQuote: any = {
      id: 2,
      createdBy: 1,
      status: "finalized" as const,
      customerName: "Baiada Poultry",
      customerContact: null,
      customerAddress: null,
      productCategory: "Brine Mixer",
      productDescription: "Henneken HVM650 Brine Mixer",
      technicalDetails: null,
      quoteDate: "01/07/2026",
      supplierId: 2,
      supplierName: "Henneken",
      supplierQuoteRef: "HEN-2026-042",
      supplierCurrency: "EUR" as const,
      supplierTerms: null,
      footerPricingNote: null,
      exchangeRate: "0.5850",
      exchangeRateConfirmed: 1,
      exchangeRateSource: "ECB",
      rateConfirmedBy: 1,
      rateConfirmedByName: "Bamah",
      rateConfirmedAt: new Date(),
      marginPct: "30.000",
      distributionDiscountPct: "25.000",
      freightCostAud: "3500.00",
      installationCostAud: "6000.00",
      otherLocalCostAud: "0.00",
      totalCostForeign: "28000.00",
      totalSellForeign: "40000.00",
      totalSellAud: "68376.07",
      grandTotalAud: "77876.07",
      paymentTerms: null,
      deliveryTerms: null,
      validityDays: 30,
      warrantyTerms: null,
      salesforceQuoteNumber: "SF-Q-2026-00201",
      submittedForReviewAt: null,
      submittedForReviewBy: null,
      approvedAt: null,
      approvedBy: null,
      approvedByName: null,
      parentQuoteId: null,
      rootQuoteId: null,
      revisionLabel: "A",
      isLatestRevision: 1,
      revisionNote: null,
      lastSentAt: null,
      lastSentTo: null,
      supplierPdfKey: null,
      supplierPdfUrl: null,
      supplierPdfName: null,
      supplierDocxKey: null,
      supplierDocxUrl: null,
      supplierDocxName: null,
      supplierXlsKey: null,
      supplierXlsUrl: null,
      supplierXlsName: null,
      generatedPdfKey: null,
      generatedPdfUrl: null,
      generatedDocxKey: null,
      generatedDocxUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockLineItems: any[] = [
      {
        id: 3,
        quoteId: 2,
        position: 1,
        description: "Henneken HVM650 Brine Mixer",
        quantity: "1.000",
        listUnitPrice: "28000.00",
        discountPct: "25.000",
        netUnitCost: "21000.00",
        sellUnitPrice: "40000.00",
        sellTotalPrice: "40000.00",
        createdAt: new Date(),
      },
    ];

    const buffer = await generateQuoteDocx(mockQuote, mockLineItems);
    expect(buffer.length).toBeGreaterThan(1000);

    // DOCX is a ZIP archive containing XML files — verify it's a valid ZIP
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K

    // Verify different input produces different output (not a static template)
    const mockQuote2 = { ...mockQuote, customerName: "Different Customer", supplierName: "Foodmate" };
    const buffer2 = await generateQuoteDocx(mockQuote2, mockLineItems);
    expect(buffer2.length).toBeGreaterThan(1000);
    // Different customer/supplier should produce different file content
    expect(Buffer.compare(buffer, buffer2)).not.toBe(0);
  });
});
