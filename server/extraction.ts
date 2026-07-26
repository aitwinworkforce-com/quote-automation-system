/**
 * AI-powered supplier quote extraction.
 * Sends the uploaded supplier PDF to the built-in LLM and extracts the
 * structured data required for the Oestergaard quote, including supplier
 * detection so the correct pricing model can be applied.
 */
import { invokeLLM } from "./_core/llm";

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
}

export interface ExtractedQuoteData {
  supplier_name: string;
  supplier_quote_number: string;
  quote_date: string;
  currency: "EUR" | "USD" | "AUD";
  customer_name: string;
  customer_contact: string;
  customer_address: string;
  product_name: string;
  product_description: string;
  line_items: ExtractedLineItem[];
  distribution_discount_pct: number;
  footer_pricing_note: string;
  footer_indicates_net: boolean;
  payment_terms: string;
  delivery_terms: string;
  warranty_terms: string;
  supplier_terms_summary: string;
  technical_details: string;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    supplier_name: {
      type: "string",
      description:
        "The supplier company issuing this quote. Match to one of: Collimatic, Marlin / Duravant, Phenova, Foodmate, Nutri Soy / Tofu — or the literal company name if none match.",
    },
    supplier_quote_number: { type: "string", description: "The supplier's quotation/reference number, from the header or document body." },
    quote_date: { type: "string", description: "Quote date in DD/MM/YYYY format if available, else empty string." },
    currency: { type: "string", enum: ["EUR", "USD", "AUD"], description: "Currency the prices are quoted in." },
    customer_name: { type: "string", description: "End customer / addressee company name if shown, else empty string." },
    customer_contact: { type: "string", description: "Contact person name if shown, else empty string." },
    customer_address: { type: "string", description: "Customer address if shown, else empty string." },
    product_name: { type: "string", description: "Short product name, e.g. 'Super Cut Wing Cutter'." },
    product_description: { type: "string", description: "Full product description including purpose and key features." },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number", description: "Unit price exactly as printed on the quote (list or net)." },
          discount_pct: { type: "number", description: "Line-level discount percentage if stated, else 0." },
        },
        required: ["description", "quantity", "unit_price", "discount_pct"],
        additionalProperties: false,
      },
    },
    distribution_discount_pct: { type: "number", description: "Distribution/distributor discount percentage if shown separately on the quote (typical for Marlin/Duravant), else 0." },
    footer_pricing_note: { type: "string", description: "Any footer note about price type (net/gross/distributor pricing), verbatim. Important for Phenova quotes. Empty string if none." },
    footer_indicates_net: { type: "boolean", description: "True if a footer note indicates prices are NET; false if GROSS/list or no such note exists." },
    payment_terms: { type: "string", description: "Payment terms stated on the supplier quote, e.g. '50% by order / 50% before shipment'. Empty string if none." },
    delivery_terms: { type: "string", description: "Delivery terms / Incoterms, e.g. 'FCA Numansdorp, NL (Incoterms 2020)'. Empty string if none." },
    warranty_terms: { type: "string", description: "Warranty terms if stated, else empty string." },
    supplier_terms_summary: { type: "string", description: "The supplier's remarks and terms & conditions text relevant to the customer quote (sanctions clauses, exclusions, manuals, FAT charges, general conditions references), as flowing paragraphs. Empty string if none." },
    technical_details: { type: "string", description: "Technical specification lines, e.g. 'Length: 1593 mm\\nWidth: 1297 mm\\nHeight: 1507 mm\\nWeight: 285 kg\\nElectrical power (IP66): 2x 0,75 kW'. Empty string if none." },
  },
  required: [
    "supplier_name", "supplier_quote_number", "quote_date", "currency",
    "customer_name", "customer_contact", "customer_address",
    "product_name", "product_description", "line_items",
    "distribution_discount_pct", "footer_pricing_note", "footer_indicates_net",
    "payment_terms", "delivery_terms", "warranty_terms",
    "supplier_terms_summary", "technical_details",
  ],
  additionalProperties: false,
} as const;

/**
 * Extract structured quote data from a supplier PDF (given the raw file bytes).
 * The PDF is sent inline as a base64 data URL — signed storage URLs are
 * relative proxy paths that the LLM backend cannot fetch.
 */
export async function extractQuoteFromPdf(pdfBuffer: Buffer, fileName: string): Promise<ExtractedQuoteData> {
  const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  const response = await invokeLLM({
    model: "gemini-3.1-pro-preview",
    messages: [
      {
        role: "system",
        content:
          "You are a precise data extraction engine for Oestergaard Pty Ltd, an Australian food processing equipment distributor. " +
          "You read supplier quotation PDFs and extract structured data with absolute accuracy — never invent numbers. " +
          "Prices must be transcribed exactly as printed. The file name often contains the supplier quotation reference number. " +
          `File name: "${fileName}".`,
      },
      {
        role: "user",
        content: [
          {
            type: "file_url",
            file_url: { url: dataUrl, mime_type: "application/pdf" },
          },
          {
            type: "text",
            text:
              "Extract all quotation data from this supplier quote PDF following the JSON schema. " +
              "Pay special attention to: (1) the supplier quotation number, (2) every priced line item with exact quantities and unit prices, " +
              "(3) any discount structure — line discounts, distribution discounts, or footer notes indicating net vs gross pricing, " +
              "(4) payment/delivery/warranty terms, and (5) the supplier's remarks and terms & conditions.",
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "supplier_quote_extraction",
        strict: true,
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    max_tokens: 32768,
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    console.error("[Extraction] Unexpected LLM response:", JSON.stringify(response)?.slice(0, 2000));
    throw new Error("AI extraction returned no content");
  }
  try {
    return JSON.parse(content) as ExtractedQuoteData;
  } catch {
    const finishReason = response?.choices?.[0]?.finish_reason;
    console.error(
      `[Extraction] JSON parse failed (finish_reason=${finishReason}, length=${content.length}). Tail: ${content.slice(-200)}`,
    );
    throw new Error(
      "AI extraction returned malformed data — the document may be too long or complex. Please try again.",
    );
  }
}
