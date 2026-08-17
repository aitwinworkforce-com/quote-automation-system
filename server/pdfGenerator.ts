/**
 * Oestergaard-branded quote PDF generator.
 * Replicates the layout and content structure of the Oestergaard Word
 * template (see template-notes.md): cover page, about page, customer
 * support page, cover letter, product specification, pricing table with
 * payment & delivery conditions, supplier remarks, and full Oestergaard
 * terms and conditions.
 */
import PDFDocument from "pdfkit";
import type { Quote, QuoteLineItem } from "../drizzle/schema";
import { OESTERGAARD_TERMS, getCombinedTerms } from "./termsContent";
import { TEMPLATE_PRICE_NOTES, TEMPLATE_COMPANY_DETAILS } from "./quotationTemplate";
import { getSupplierCommission } from "./commission";

// Brand palette (from the original template)
const BLUE = "#1F6FB2"; // steel blue headings / logo
const TABLE_BLUE = "#29ABE2"; // pricing table header + AUD total row
const GREEN = "#92D050"; // ex-works total row
const DARK = "#1a1a2e";
const GREY = "#555555";

const PAGE = { width: 595.28, height: 841.89, margin: 56 }; // A4 portrait
const CONTENT_W = PAGE.width - PAGE.margin * 2;

const COMPANY = {
  name: "Oestergaard Pty Ltd",
  address: "Unit 4/8 Hare Place, Rouse Hill NSW 2155",
  web: "www.oestergaard.com.au",
  abn: "ABN: 35 629 325 837",
  salesEmail: "sales@oestergaard.com.au",
  serviceEmail: "Service@oestergaard.com.au",
  sparesEmail: "spareparts@oestergaard.com.au",
  phone: "+61 (02) 9834 3665",
  director: "Bill Hili",
};

function money(n: number | string | null | undefined, symbol: string): string {
  const v = Number(n ?? 0);
  return `${symbol} ${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencySymbol(c: string | null | undefined): string {
  return c === "USD" ? "US$" : c === "AUD" ? "$" : c === "NZD" ? "NZ$" : "€";
}

/** Draw the OESTERGAARD wordmark header used on every page. */
function drawHeader(doc: PDFKit.PDFDocument) {
  const y = 30;
  const prevX = doc.x;
  const prevY = doc.y;
  doc.save();
  doc.moveTo(PAGE.margin, y + 10).lineTo(PAGE.width - 210, y + 10).lineWidth(0.8).strokeColor(BLUE).stroke();
  doc.font("Helvetica-Bold").fontSize(15).fillColor(BLUE);
  doc.text("OESTERGAARD", PAGE.width - 200, y + 2, { characterSpacing: 1.2, lineBreak: false });
  doc.restore();
  doc.x = prevX;
  doc.y = prevY;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNo: number) {
  const prevX = doc.x;
  const prevY = doc.y;
  doc.save();
  doc.font("Helvetica").fontSize(8).fillColor(GREY);
  doc.text(`${pageNo} | ${COMPANY.name}`, PAGE.margin, PAGE.height - 42, { lineBreak: false });
  doc.restore();
  doc.x = prevX;
  doc.y = prevY;
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string, y?: number) {
  if (y !== undefined) doc.y = y;
  doc.moveDown(0.5);
  doc.font("Helvetica-BoldOblique").fontSize(16).fillColor(BLUE).text(text, PAGE.margin, doc.y);
  doc.moveDown(0.6);
}

export async function generateQuotePdf(quote: Quote, lineItems: QuoteLineItem[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE.margin, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNo = 1;
    const sym = currencySymbol(quote.supplierCurrency);

    // ==================================================================
    // PAGE 1 — COVER
    // ==================================================================
    // Big centred logo
    doc.font("Helvetica-Bold").fontSize(34).fillColor(BLUE);
    doc.text("OESTERGAARD", PAGE.margin, 120, { width: CONTENT_W, align: "center", characterSpacing: 3 });
    doc.font("Helvetica").fontSize(13).fillColor(GREY);
    doc.text("Powering the Future of Protein Processing", PAGE.margin, 170, { width: CONTENT_W, align: "center" });

    // Decorative blue band
    doc.save();
    doc.rect(0, 230, PAGE.width, 6).fill(TABLE_BLUE);
    doc.rect(0, 240, PAGE.width, 2).fill(BLUE);
    doc.restore();

    // Quotation identity block
    doc.roundedRect(PAGE.margin, 300, CONTENT_W, 170, 4).lineWidth(1).strokeColor(BLUE).stroke();
    doc.font("Helvetica-Bold").fontSize(20).fillColor(DARK);
    doc.text("QUOTATION", PAGE.margin, 325, { width: CONTENT_W, align: "center" });
    doc.font("Helvetica").fontSize(12).fillColor(BLUE);
    doc.text(quote.salesforceQuoteNumber ?? "", PAGE.margin, 352, { width: CONTENT_W, align: "center" });
    doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK);
    doc.text(quote.productCategory ?? quote.productDescription ?? "", PAGE.margin + 40, 385, { width: CONTENT_W - 80, align: "center" });

    // Prepared-for block (bottom-left)
    const coverY = 560;
    doc.font("Helvetica").fontSize(10).fillColor(GREY).text("Prepared for:", PAGE.margin, coverY);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text(quote.customerName ?? "", PAGE.margin, coverY + 14);
    doc.font("Helvetica").fontSize(10).fillColor(GREY).text("Project:", PAGE.margin, coverY + 36);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(quote.productCategory ?? "", PAGE.margin, coverY + 50);
    doc.font("Helvetica").fontSize(10).fillColor(GREY).text(`Date: ${quote.quoteDate ?? new Date().toLocaleDateString("en-AU")}`, PAGE.margin, coverY + 72);
    doc.text("Director", PAGE.margin, coverY + 90);
    doc.font("Helvetica-Bold").text(COMPANY.director, PAGE.margin, coverY + 104);

    // Company box (bottom-right, blue)
    doc.save();
    doc.rect(PAGE.width - 250, coverY + 40, 250, 110).fill(BLUE);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text(COMPANY.name, PAGE.width - 235, coverY + 55);
    doc.font("Helvetica").fontSize(9);
    doc.text(COMPANY.address, PAGE.width - 235, coverY + 70, { width: 220 });
    doc.text(COMPANY.web, PAGE.width - 235, coverY + 96);
    doc.text(COMPANY.abn, PAGE.width - 235, coverY + 110);
    doc.restore();

    // ==================================================================
    // PAGE 2 — ABOUT OESTERGAARD
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    sectionHeading(doc, "About Oestergaard Pty Ltd", 90);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK);
    doc.text(
      "Oestergaard Pty Ltd is an Australian owned company with over 100 years of combined experience in the meat and protein processing industry. " +
        "We are the exclusive representative of Danish rendering equipment manufacturer Oestergaard A/S in Australia and New Zealand, and we partner " +
        "with world-leading food processing equipment brands to deliver complete solutions for the Australian and New Zealand markets.",
      PAGE.margin, doc.y, { width: CONTENT_W, align: "justify", lineGap: 3 },
    );
    doc.moveDown(1);
    doc.text(
      "Our portfolio spans primary and further processing, cut-up, deboning, rendering and by-product handling. We provide equipment supply, " +
        "project management, installation, commissioning and lifetime after-sales support — all backed by local engineers and a dedicated spare parts operation.",
      { width: CONTENT_W, align: "justify", lineGap: 3 },
    );
    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE).text("Our Partner Brands");
    doc.moveDown(0.4);
    const allBrands = ["Oestergaard A/S", "Foodmate", "Marelec", "Henneken", "Nothum", "Unifortes", "Colimatic", "VN", "Finova", "Giordano", "IFEC", "MPS", "Advance Freezers", "Marlen"];
    const colW = CONTENT_W / 3;
    const brands = allBrands;
    const startY = doc.y;
    brands.forEach((b, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = PAGE.margin + col * colW;
      const by = startY + row * 44;
      doc.roundedRect(bx + 4, by, colW - 8, 36, 3).lineWidth(0.8).strokeColor(BLUE).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(b, bx + 4, by + 13, { width: colW - 8, align: "center" });
    });
    doc.y = startY + Math.ceil(brands.length / 3) * 44 + 20;
    drawFooter(doc, pageNo);

    // ==================================================================
    // PAGE 3 — CUSTOMER SUPPORT
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    sectionHeading(doc, "Here When You Need Us — Real People, Real Solutions", 90);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK);
    doc.text(
      "When you buy equipment through Oestergaard, you are never on your own. Our local support team is here for the life of your machine:",
      PAGE.margin, doc.y, { width: CONTENT_W, lineGap: 3 },
    );
    doc.moveDown(1);
    const supports: Array<[string, string]> = [
      ["Phone & Email Support", "Direct access to our engineers for troubleshooting and technical questions."],
      ["Remote Diagnostics", "Many issues can be assessed and resolved remotely, minimising downtime."],
      ["Process & Technical Advice", "Guidance on throughput, yield and product quality from industry specialists."],
      ["Technician On-Demand", "Factory-trained technicians available for on-site service and repairs."],
      ["Parts & Repairs Coordination", "Genuine spare parts stocked locally, with fast dispatch Australia-wide."],
    ];
    supports.forEach(([title, body]) => {
      doc.circle(PAGE.margin + 6, doc.y + 6, 3).fill(TABLE_BLUE);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK).text(title, PAGE.margin + 18, doc.y - 2);
      doc.font("Helvetica").fontSize(10).fillColor(GREY).text(body, PAGE.margin + 18, doc.y + 1, { width: CONTENT_W - 18, lineGap: 2 });
      doc.moveDown(0.9);
    });
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE).text("We're Here to Keep You Running", PAGE.margin, doc.y);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor(DARK);
    doc.text(`Service: ${COMPANY.serviceEmail}`, PAGE.margin, doc.y);
    doc.text(`Spare parts: ${COMPANY.sparesEmail}`, PAGE.margin, doc.y + 2);
    doc.text(`Phone: ${COMPANY.phone}`, PAGE.margin, doc.y + 2);
    drawFooter(doc, pageNo);

    // ==================================================================
    // PAGE 4 — COVER LETTER
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    doc.y = 100;
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK).text(quote.quoteDate ?? new Date().toLocaleDateString("en-AU"), PAGE.margin, doc.y);
    // Quotation reference box (top-right)
    doc.roundedRect(PAGE.width - 240, 95, 185, 46, 3).lineWidth(0.8).strokeColor(BLUE).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(`Quotation ${quote.salesforceQuoteNumber ?? ""}`, PAGE.width - 230, 104);
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(`Ref: ${quote.supplierQuoteRef ?? ""}`, PAGE.width - 230, 120);
    // Addressee block
    doc.y = 160;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK);
    if (quote.customerContact) doc.text(quote.customerContact, PAGE.margin, doc.y);
    doc.text(quote.customerName ?? "", PAGE.margin, doc.y + 2);
    doc.font("Helvetica").fontSize(10);
    if (quote.customerAddress) doc.text(quote.customerAddress, PAGE.margin, doc.y + 2, { width: 280 });
    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(10.5).text(`Object: ${quote.productCategory ?? ""}`, PAGE.margin, doc.y);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK);
    doc.text(
      "Following your request, we are pleased to send you our proposal for the supply of the equipment described in the following pages. " +
        "We trust this proposal meets your expectations and remain at your disposal for any further information or clarification you may require.",
      { width: CONTENT_W, align: "justify", lineGap: 3 },
    );
    doc.moveDown(1);
    doc.text(
      "We thank you for the opportunity to quote and look forward to being of service to you.",
      { width: CONTENT_W, align: "justify", lineGap: 3 },
    );
    doc.moveDown(2);
    doc.text("Yours faithfully,", PAGE.margin, doc.y);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("OESTERGAARD PTY LIMITED", PAGE.margin, doc.y);
    doc.moveDown(2.2);
    doc.font("Helvetica-Bold").text(COMPANY.director, PAGE.margin, doc.y);
    doc.font("Helvetica").fillColor(GREY).text("DIRECTOR.", PAGE.margin, doc.y + 2);
    drawFooter(doc, pageNo);

    // ==================================================================
    // PAGE 5 — PRODUCT SPECIFICATION
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    sectionHeading(doc, "Equipment Specification", 90);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text((quote.productCategory ?? "").toUpperCase(), PAGE.margin, doc.y);
    doc.moveDown(0.6);
   doc.font("Helvetica").fontSize(10.5).fillColor(DARK);
   doc.text(quote.productDescription ?? "", { width: CONTENT_W, align: "justify", lineGap: 3 });
   doc.moveDown(1);
    if (quote.technicalDetails) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE).text("Technical Details", PAGE.margin, doc.y);
      doc.moveDown(0.4);
      const specLines = String(quote.technicalDetails).split(/\n+/).map(l => l.trim()).filter(Boolean);
      doc.font("Helvetica").fontSize(10.5).fillColor(DARK);
      for (const line of specLines) {
        doc.text(line, PAGE.margin + 10, doc.y, { width: CONTENT_W - 20, lineGap: 2 });
        doc.moveDown(0.15);
      }
      doc.moveDown(1);
    }
   drawFooter(doc, pageNo);

   // ==================================================================
   // PAGE 6 — PRICE FOR EQUIPMENT
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    sectionHeading(doc, "Price for Equipment", 90);

    // Pricing table
    const cols = [40, 255, 95, 95]; // Qty | Description | Price/Item | Net Price
    const colX = [PAGE.margin, PAGE.margin + cols[0], PAGE.margin + cols[0] + cols[1], PAGE.margin + cols[0] + cols[1] + cols[2]];
    const tableW = cols.reduce((a, b) => a + b, 0);
    let ty = doc.y + 4;

    // Header row
    doc.rect(PAGE.margin, ty, tableW, 22).fill(TABLE_BLUE);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#ffffff");
    doc.text("Qty", colX[0] + 4, ty + 7, { width: cols[0] - 8 });
    doc.text("Description", colX[1] + 4, ty + 7, { width: cols[1] - 8 });
    doc.text("Price Per Item", colX[2] + 4, ty + 7, { width: cols[2] - 8, align: "right" });
    doc.text("Net Price (Ex. GST)", colX[3] + 4, ty + 7, { width: cols[3] - 8, align: "right" });
    ty += 22;

    // Line items
    doc.font("Helvetica").fontSize(9.5).fillColor(DARK);
    for (const li of lineItems) {
      const descH = doc.heightOfString(li.description, { width: cols[1] - 8 });
      const rowH = Math.max(20, descH + 10);
      doc.rect(PAGE.margin, ty, tableW, rowH).lineWidth(0.5).strokeColor("#cccccc").stroke();
      doc.fillColor(DARK);
      doc.text(Number(li.quantity).toString(), colX[0] + 4, ty + 5, { width: cols[0] - 8 });
      doc.text(li.description, colX[1] + 4, ty + 5, { width: cols[1] - 8 });
      doc.text(money(li.sellUnitPrice, sym), colX[2] + 4, ty + 5, { width: cols[2] - 8, align: "right" });
      doc.text(money(li.sellTotalPrice, sym), colX[3] + 4, ty + 5, { width: cols[3] - 8, align: "right" });
      ty += rowH;
    }

    // Total ex-works row (green)
    doc.rect(PAGE.margin, ty, tableW, 22).fill(GREEN);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(DARK);
    doc.text("Total Ex-works Europe Ex. GST", colX[1] + 4, ty + 7, { width: cols[1] - 8 });
    doc.text(money(quote.totalSellForeign, sym), colX[3] + 4, ty + 7, { width: cols[3] - 8, align: "right" });
    ty += 22;

    // AUD conversion + local cost rows
    const audRows: Array<[string, string]> = [
      [`Total Estimated in AUD Dollars @ ${Number(quote.exchangeRate).toFixed(4)} to ${quote.supplierCurrency}`, money(quote.totalSellAud, "$")],
      ["Estimated sea freight from Europe to NSW", money(quote.freightCostAud, "$")],
      ["Estimated Installation", money(quote.installationCostAud, "$")],
    ];
    if (Number(quote.otherLocalCostAud ?? 0) > 0) {
      audRows.push(["Other estimated local costs", money(quote.otherLocalCostAud, "$")]);
    }
    doc.font("Helvetica").fontSize(9.5);
    for (const [label, value] of audRows) {
      doc.rect(PAGE.margin, ty, tableW, 20).lineWidth(0.5).strokeColor("#cccccc").stroke();
      doc.fillColor(DARK);
      doc.text(label, colX[1] + 4, ty + 6, { width: cols[1] - 8 });
      doc.text(value, colX[3] + 4, ty + 6, { width: cols[3] - 8, align: "right" });
      ty += 20;
    }

    // Grand total row (blue)
    doc.rect(PAGE.margin, ty, tableW, 22).fill(TABLE_BLUE);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text("Estimated total in AUD Excl. GST", colX[1] + 4, ty + 7, { width: cols[1] - 8 });
    doc.text(money(quote.grandTotalAud, "$"), colX[3] + 4, ty + 7, { width: cols[3] - 8, align: "right" });
    ty += 32;

    // Bullets
    doc.y = ty;
    doc.font("Helvetica").fontSize(9.5).fillColor(DARK);
    const bullets = [
      TEMPLATE_PRICE_NOTES[0].replace("Euro currency", `${quote.supplierCurrency === "USD" ? "US Dollar" : quote.supplierCurrency === "AUD" ? "Australian Dollar" : quote.supplierCurrency === "NZD" ? "New Zealand Dollar" : "Euro"} currency`),
      TEMPLATE_PRICE_NOTES[1],
      TEMPLATE_PRICE_NOTES[2],
    ];
    bullets.forEach(b => {
      doc.circle(PAGE.margin + 4, doc.y + 5, 1.5).fill(DARK);
      doc.fillColor(DARK).text(b, PAGE.margin + 14, doc.y, { width: CONTENT_W - 14, lineGap: 2 });
      doc.moveDown(0.5);
    });

    // Payment & Delivery conditions
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11.5).fillColor(BLUE).text("Payment & Delivery Conditions", PAGE.margin, doc.y);
    doc.moveDown(0.5);
    const conditions: Array<[string, string]> = [
      ["Validity", `${quote.validityDays ?? 30} days from the date of this quotation`],
      ["Delivery", quote.deliveryTerms ?? "To be confirmed at time of order"],
      ["Payment terms", quote.paymentTerms ?? "50% by order / 50% before shipment"],
      ["Warranty", quote.warrantyTerms ?? "15 months from delivery or 2,000 operating hours or 12 months after commissioning, whichever comes first"],
    ];
    conditions.forEach(([label, value]) => {
      const labelW = 110;
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(DARK).text(label, PAGE.margin, doc.y, { width: labelW });
      const yAfterLabel = doc.y;
      doc.font("Helvetica").fontSize(9.5).fillColor(DARK);
      doc.text(value, PAGE.margin + labelW, yAfterLabel - doc.currentLineHeight(), { width: CONTENT_W - labelW, lineGap: 2 });
      doc.moveDown(0.4);
    });
    drawFooter(doc, pageNo);

    // ==================================================================
    // PAGE 7 — SUPPLIER REMARKS (if any)
    // ==================================================================
    if (quote.supplierTerms) {
      doc.addPage();
      pageNo++;
      drawHeader(doc);
      sectionHeading(doc, "Remarks", 90);
      doc.font("Helvetica").fontSize(9.5).fillColor(DARK);
      doc.text(quote.supplierTerms, { width: CONTENT_W, align: "justify", lineGap: 3 });
      doc.moveDown(1.5);
      doc.font("Helvetica").fontSize(9).fillColor(GREY);
      doc.text(`${COMPANY.salesEmail}  |  ${COMPANY.phone}`, PAGE.margin, doc.y);
      drawFooter(doc, pageNo);
    }

    // ==================================================================
    // TERMS AND CONDITIONS PAGES
    // ==================================================================
    doc.addPage();
    pageNo++;
    drawHeader(doc);
    doc.y = 90;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(DARK);
    doc.text("TERMS AND CONDITIONS OF BUSINESS", PAGE.margin, doc.y, { width: CONTENT_W, align: "center" });
    doc.moveDown(1);

    // Render combined Oestergaard + supplier T&Cs as plain text
    const combinedTerms = getCombinedTerms(quote.supplierName ?? "Unknown");
    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    
    // Split into paragraphs and render with page breaks
    const paragraphs = combinedTerms.split("\n\n");
    for (const para of paragraphs) {
      if (doc.y > PAGE.height - 110) {
        drawFooter(doc, pageNo);
        doc.addPage();
        pageNo++;
        drawHeader(doc);
        doc.y = 90;
        doc.font("Helvetica").fontSize(8).fillColor(DARK);
      }
      doc.text(para, PAGE.margin, doc.y, { width: CONTENT_W, align: "justify", lineGap: 1.2 });
      doc.moveDown(0.5);
    }
    drawFooter(doc, pageNo);

    doc.end();
  });
}
import { getDb } from "./db";
import { productImages } from "../drizzle/schema";
import { like } from "drizzle-orm";

// Match a product image from the library for the PDF
async function findProductImage(supplierName: string, productDescription: string): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const allImages = await db.select().from(productImages)
      .where(like(productImages.supplierName, `%${supplierName}%`));
    if (allImages.length === 0) return null;

    // Simple keyword matching
    const keywords = productDescription.toLowerCase().split(/[\s,;]+/).filter(w => w.length > 3);
    let bestMatch: any = null;
    let bestScore = 0;
    for (const img of allImages) {
      let score = 0;
      const tags = (img.tags || "").toLowerCase();
      const model = (img.productModel || "").toLowerCase();
      const name = (img.productName || "").toLowerCase();
      for (const kw of keywords) {
        if (model.includes(kw)) score += 3;
        if (name.includes(kw)) score += 2;
        if (tags.includes(kw)) score += 1;
      }
      if (score > bestScore) { bestScore = score; bestMatch = img; }
    }
    return bestMatch?.imageUrl || null;
  } catch { return null; }
}
