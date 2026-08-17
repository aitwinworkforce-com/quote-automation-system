/**
 * Oestergaard-branded quote DOCX generator.
 * Replicates the layout and content structure of QuotationTEMPLATE.docx:
 *  1. Cover page (title, customer, project, date, director)
 *  2. About Oestergaard Pty Ltd (company profile + brand list)
 *  3. Customer Support ("Here When You Need Us")
 *  4. Quote letter (date, address, object, proposal, signoff)
 *  5. Price for Equipment (pricing table + payment notes)
 *  6. Sales Conditions
 *  7. Terms of Trade
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  PageBreak,
  ShadingType,
  VerticalAlign,
  Header,
  Footer,
  TabStopPosition,
  TabStopType,
  TableLayoutType,
} from "docx";
import type { Quote, QuoteLineItem } from "../drizzle/schema";
import {
  TEMPLATE_ABOUT,
  TEMPLATE_SUPPORT_HEADING,
  TEMPLATE_SUPPORT_INTRO,
  TEMPLATE_SUPPORT_SERVICES,
  TEMPLATE_SUPPORT_FOOTER,
  TEMPLATE_LETTER_INTRO,
  TEMPLATE_LETTER_CLOSING,
  TEMPLATE_PRICE_NOTES,
  TEMPLATE_COMPANY_DETAILS,
} from "./quotationTemplate";
import { OESTERGAARD_TERMS, getCombinedTerms } from "./termsContent";

// Brand palette
const BLUE = "1F6FB2";
const TABLE_BLUE = "29ABE2";
const GREEN = "92D050";
const WHITE = "FFFFFF";
const DARK = "1A1A2E";

const COMPANY = {
  name: "Oestergaard Pty Ltd",
  acn: "ACN 629 325 837",
  address: "Unit 4/8 Hare Place, Rouse Hill NSW 2155",
  web: "www.oestergaard.com.au",
  abn: "ABN: 35 629 325 837",
  salesEmail: "sales@oestergaard.com.au",
  serviceEmail: "Service@oestergaard.com.au",
  sparesEmail: "spareparts@oestergaard.com.au",
  phone: "+61 (02) 9834 3665",
  director: "Bill Hili",
};

const ALL_BRANDS = [
  "Oestergaard", "Foodmate", "Marelec", "Henneken", "Marlen", "Colimatic",
  "Tecnovac", "MPS", "Finova", "Unifortes", "VN", "Nothum",
  "BMB", "Rodon", "Heinen", "PSS", "Steen", "Beritech",
  "Salimco", "Giordano", "IFEC", "Advance Freezers",
];

function money(n: number | string | null | undefined, symbol: string): string {
  const v = Number(n ?? 0);
  return `${symbol} ${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencySymbol(c: string | null | undefined): string {
  return c === "USD" ? "US$" : c === "AUD" ? "$" : "€";
}

function noBorder() {
  return {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.NONE, size: 0 },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
  };
}

function thinBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };
}

/** Build the default header with Oestergaard wordmark */
function makeHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "OESTERGAARD",
            bold: true,
            size: 28,
            color: BLUE,
            font: "Calibri",
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 100 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: TABLE_BLUE },
        },
      }),
    ],
  });
}

/** Build the default footer */
function makeFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: `${COMPANY.salesEmail}     ${COMPANY.phone}     ${COMPANY.name}`, size: 16, color: "555555", font: "Calibri" }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

// ============================================================
// SECTION BUILDERS
// ============================================================

function buildCoverPage(quote: Quote): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 } }),
    new Paragraph({
      children: [new TextRun({ text: "OESTERGAARD", bold: true, size: 60, color: BLUE, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Powering the Future of Protein Processing", size: 32, color: "555555", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({ spacing: { before: 1200 } }),
    new Paragraph({
      children: [new TextRun({ text: "Prepared for:", italics: true, size: 20, color: "555555", font: "Calibri" })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: quote.customerName ?? "", bold: true, size: 28, color: TABLE_BLUE, font: "Calibri" })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Project: ${quote.productCategory ?? quote.productDescription ?? ""}`, size: 20, font: "Calibri" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${quote.quoteDate ?? new Date().toLocaleDateString("en-AU")}`, size: 20, font: "Calibri" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Director", size: 20, font: "Calibri" })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: COMPANY.director, bold: true, size: 20, font: "Calibri" })],
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildAboutPage(): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "About Oestergaard Pty Ltd", bold: true, size: 36, color: TABLE_BLUE, font: "Calibri" })],
      spacing: { after: 300 },
    }),
  ];

  // Split the about text into paragraphs
  const aboutParts = TEMPLATE_ABOUT.split("\n\n");
  for (const part of aboutParts) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: part, size: 21, font: "Calibri" })],
        spacing: { after: 200 },
      }),
    );
  }

  // Brand list
  paragraphs.push(
    new Paragraph({ spacing: { before: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "Our Partner Brands:", bold: true, size: 22, color: BLUE, font: "Calibri" })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: ALL_BRANDS.join("  •  "), size: 20, font: "Calibri" })],
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  return paragraphs;
}

function buildSupportPage(): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: TEMPLATE_SUPPORT_HEADING, bold: true, size: 32, color: TABLE_BLUE, font: "Calibri" })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: TEMPLATE_SUPPORT_INTRO, size: 21, font: "Calibri" })],
      spacing: { after: 300 },
    }),
  ];

  for (const svc of TEMPLATE_SUPPORT_SERVICES) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: svc.title, bold: true, size: 22, color: TABLE_BLUE, font: "Calibri" })],
        spacing: { before: 200, after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: svc.description, size: 20, font: "Calibri" })],
        spacing: { after: 120 },
      }),
    );
  }

  // Footer contact info
  const footerLines = TEMPLATE_SUPPORT_FOOTER.split("\n");
  for (const line of footerLines) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 20, color: BLUE, font: "Calibri" })],
        spacing: { after: 40 },
      }),
    );
  }

  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  return paragraphs;
}

function buildLetterPage(quote: Quote): Paragraph[] {
  const supplierBrand = quote.supplierName ?? "the supplier";
  const productDesc = quote.productCategory ?? quote.productDescription ?? "";
  const closingText = TEMPLATE_LETTER_CLOSING.replace("{{SUPPLIER}}", supplierBrand);

  const paragraphs: Paragraph[] = [
    // Date
    new Paragraph({
      children: [new TextRun({ text: quote.quoteDate ?? new Date().toLocaleDateString("en-AU"), size: 21, font: "Calibri" })],
      spacing: { after: 300 },
    }),
  ];

  // Customer address block
  if (quote.customerContact) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: quote.customerContact, bold: true, size: 21, font: "Calibri" })],
    }));
  }
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: quote.customerName ?? "", bold: true, size: 21, font: "Calibri" })],
  }));
  if (quote.customerAddress) {
    const addrLines = quote.customerAddress.split("\n");
    for (const line of addrLines) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line, size: 21, font: "Calibri" })],
      }));
    }
  }
  // Last line bold (suburb/state)
  paragraphs.push(new Paragraph({ spacing: { after: 200 } }));

  // Quotation reference box (right-aligned text)
  paragraphs.push(new Paragraph({
    children: [
      new TextRun({ text: `Quotation ${quote.salesforceQuoteNumber ?? ""}`, bold: true, size: 21, font: "Calibri" }),
    ],
    spacing: { after: 40 },
  }));
  if (quote.supplierQuoteRef) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `Ref.: ${quote.supplierQuoteRef}`, size: 20, font: "Calibri" })],
      spacing: { after: 200 },
    }));
  }

  // Object line
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: `Object: ${supplierBrand}: ${productDesc}`, bold: true, size: 21, font: "Calibri" })],
    spacing: { before: 200, after: 300 },
  }));

  // Intro text
  const introText = TEMPLATE_LETTER_INTRO(supplierBrand, productDesc);
  const introParts = introText.split("\n");
  for (const part of introParts) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: part, size: 21, font: "Calibri", bold: part.includes(supplierBrand) && part.includes(productDesc) })],
      spacing: { after: 100 },
    }));
  }

  paragraphs.push(new Paragraph({ spacing: { before: 300 } }));

  // Closing text
  const closingParts = closingText.split("\n\n");
  for (const part of closingParts) {
    const lines = part.split("\n");
    for (const line of lines) {
      const isBold = line.includes("OESTERGAARD PTY LIMITED") || line.includes("DIRECTOR");
      const isUnderline = line.includes("DIRECTOR");
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line, size: 21, font: "Calibri", bold: isBold, underline: isUnderline ? {} : undefined })],
        spacing: { after: 60 },
      }));
    }
    paragraphs.push(new Paragraph({ spacing: { after: 100 } }));
  }

  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  return paragraphs;
}

function buildPricingPage(quote: Quote, lineItems: QuoteLineItem[]): Paragraph[] {
  const sym = currencySymbol(quote.supplierCurrency);
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Price for Equipment", bold: true, italics: true, size: 28, color: DARK, font: "Calibri" })],
      spacing: { after: 300 },
    }),
  ];

  // Build pricing table
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Qty", bold: true, size: 19, color: WHITE, font: "Calibri" })], alignment: AlignmentType.CENTER })],
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true, size: 19, color: WHITE, font: "Calibri" })] })],
        width: { size: 50, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Price Per Item", bold: true, size: 19, color: WHITE, font: "Calibri" })], alignment: AlignmentType.RIGHT })],
        width: { size: 21, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Disc", bold: true, size: 19, color: WHITE, font: "Calibri" })], alignment: AlignmentType.CENTER })],
        width: { size: 11, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  });

  const dataRows = lineItems.map(li => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: Number(li.quantity).toString(), size: 19, font: "Calibri" })], alignment: AlignmentType.CENTER })],
        borders: thinBorder(),
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: li.description, size: 19, font: "Calibri" })] })],
        borders: thinBorder(),
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: money(li.sellUnitPrice, sym), size: 19, font: "Calibri" })], alignment: AlignmentType.RIGHT })],
        borders: thinBorder(),
        verticalAlign: VerticalAlign.CENTER,
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: li.discountPct ? `${Number(li.discountPct)}%` : "", size: 19, font: "Calibri" })], alignment: AlignmentType.CENTER })],
        borders: thinBorder(),
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  }));

  // Total Ex-works row (green)
  const totalExWorksRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [] })],
        shading: { type: ShadingType.SOLID, color: GREEN },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Total Ex-works Europe Ex. GST", bold: true, size: 19, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: GREEN },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: money(quote.totalSellForeign, sym), bold: true, size: 19, font: "Calibri" })], alignment: AlignmentType.RIGHT })],
        shading: { type: ShadingType.SOLID, color: GREEN },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [] })],
        shading: { type: ShadingType.SOLID, color: GREEN },
        borders: thinBorder(),
      }),
    ],
  });

  // AUD conversion rows
  const audRows: Array<[string, string]> = [
    [`Total Estimated in AUD Dollars @ ${Number(quote.exchangeRate).toFixed(4)} to Euro`, money(quote.totalSellAud, "$")],
    ["Estimated sea freight from Europe to NSW", money(quote.freightCostAud, "$")],
    ["Estimated Installation", money(quote.installationCostAud, "$")],
  ];
  if (Number(quote.otherLocalCostAud ?? 0) > 0) {
    audRows.push(["Other estimated local costs", money(quote.otherLocalCostAud, "$")]);
  }

  const audDataRows = audRows.map(([label, value]) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [] })], borders: thinBorder() }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, size: 19, font: "Calibri" })] })], borders: thinBorder() }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, size: 19, font: "Calibri" })], alignment: AlignmentType.RIGHT })], borders: thinBorder() }),
      new TableCell({ children: [new Paragraph({ children: [] })], borders: thinBorder() }),
    ],
  }));

  // Grand total row (blue)
  const grandTotalRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [] })],
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Estimated total in AUD Excl. GST", bold: true, size: 19, color: WHITE, font: "Calibri" })] })],
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: money(quote.grandTotalAud, "$"), bold: true, size: 19, color: WHITE, font: "Calibri" })], alignment: AlignmentType.RIGHT })],
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        borders: thinBorder(),
      }),
      new TableCell({
        children: [new Paragraph({ children: [] })],
        shading: { type: ShadingType.SOLID, color: TABLE_BLUE },
        borders: thinBorder(),
      }),
    ],
  });

  const pricingTable = new Table({
    rows: [headerRow, ...dataRows, totalExWorksRow, ...audDataRows, grandTotalRow],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });

  paragraphs.push(pricingTable as any);

  // Payment notes (bullets)
  paragraphs.push(new Paragraph({ spacing: { before: 300 } }));
  const currencyLabel = quote.supplierCurrency === "USD" ? "US Dollar" : quote.supplierCurrency === "AUD" ? "Australian Dollar" : "Euro";
  const notes = [
    TEMPLATE_PRICE_NOTES[0].replace("Euro currency", `${currencyLabel} currency`),
    TEMPLATE_PRICE_NOTES[1],
    TEMPLATE_PRICE_NOTES[2],
  ];
  for (const note of notes) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `• ${note}`, size: 19, font: "Calibri" })],
      spacing: { after: 60 },
    }));
  }

  // Sales Conditions heading
  paragraphs.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "SALES CONDITIONS", bold: true, size: 22, font: "Calibri" })],
      spacing: { after: 200 },
    }),
  );

  // Payment & Delivery conditions
  const conditions: Array<[string, string]> = [
    ["Validity:", `${quote.validityDays ?? 30} days from the date of this quotation`],
    ["Delivery:", quote.deliveryTerms ?? "To be confirmed at time of order"],
    ["Payment terms:", quote.paymentTerms ?? "50% by order / 50% before shipment"],
    ["Warranty:", quote.warrantyTerms ?? "15 months from delivery or 2,000 operating hours or 12 months after commissioning, whichever comes first"],
  ];
  for (const [label, value] of conditions) {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: label + " ", bold: true, size: 19, font: "Calibri" }),
        new TextRun({ text: value, size: 19, font: "Calibri" }),
      ],
      spacing: { after: 80 },
    }));
  }

  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  return paragraphs;
}

function buildTermsPages(supplierName: string): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "TERMS OF TRADE OF OESTERGAARD PTY LTD ACN 629 325 837", bold: true, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];

  const combinedTerms = getCombinedTerms(supplierName);
  const termsParagraphs = combinedTerms.split("\n\n");
  for (const para of termsParagraphs) {
    if (para.trim().length === 0) continue;
    // Detect section headings (numbered items like "1. DEFINITIONS")
    const isHeading = /^\d+\.\s+[A-Z]/.test(para.trim());
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: para.trim(),
        size: isHeading ? 18 : 16,
        bold: isHeading,
        font: "Calibri",
      })],
      spacing: { after: isHeading ? 120 : 80 },
    }));
  }

  return paragraphs;
}

// ============================================================
// MAIN EXPORT
// ============================================================

export async function generateQuoteDocx(quote: Quote, lineItems: QuoteLineItem[]): Promise<Buffer> {
  const children: any[] = [
    ...buildCoverPage(quote),
    ...buildAboutPage(),
    ...buildSupportPage(),
    ...buildLetterPage(quote),
    ...buildPricingPage(quote, lineItems),
    ...buildTermsPages(quote.supplierName ?? "Unknown"),
  ];

  const doc = new Document({
    sections: [
      {
        headers: { default: makeHeader() },
        footers: { default: makeFooter() },
        children,
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
      },
    ],
    creator: "Oestergaard AI Quote Agent",
    title: `Quotation ${quote.salesforceQuoteNumber ?? ""}`,
    description: `Quote for ${quote.customerName ?? ""} - ${quote.productCategory ?? ""}`,
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
