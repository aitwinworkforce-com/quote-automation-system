/**
 * Oestergaard Quotation Template Constants
 * -----------------------------------------
 * Source: QuotationTEMPLATE.docx
 *
 * This file defines the exact structure, section order, and static content
 * that every customer quotation PDF must follow. The PDF generator reads
 * these constants to produce template-aligned output.
 *
 * Template structure (pages):
 * 1. Cover page: "Powering the Future of Protein Processing" + branding
 * 2. About Oestergaard Pty Ltd (company profile)
 * 3. Customer Support overview ("Here When You Need Us")
 * 4. Quote letter (date, customer address, object line, proposal text, signoff)
 * 5. Price for Equipment (pricing table + payment notes)
 * 6. Sales Conditions (placeholder for supplier-specific conditions)
 * 7. Terms of Trade of Oestergaard Pty Ltd ACN 629 325 837
 */

export const TEMPLATE_COVER_TITLE = "Powering the Future of Protein Processing";

export const TEMPLATE_ABOUT = `Oestergaard Australia is a proudly Australian-owned company specialising in the supply of high-quality food processing, packaging, and rendering equipment. With over 100 years of combined industry experience, our team brings extensive knowledge and dedication to every project, offering tailored solutions that meet the evolving needs of the food production sector.

We are the exclusive Australian representative of the renowned Danish brand Oestergaard, while also proudly supplying a wide portfolio of trusted global brands including Foodmate, Marelec, Henneken, Nothum, Unifortes, Colimatic, VN, Finova, Giordano, IFEC, MPS, and Advance Freezers. Our vast product range allows us to support operations of all sizes – from individual components to complete turnkey systems – across poultry, meat, seafood, ready meals, bakery, and rendering industries.

At Oestergaard Australia, we offer more than just machinery. We provide full-service support, including spare parts, on-site servicing, commissioning, and preventative maintenance, ensuring your equipment performs at its best from day one.

When you partner with us, it's not just a purchase – it's a long-term relationship built on trust, performance, and ongoing support.`;

export const TEMPLATE_SUPPORT_HEADING = "Here When You Need Us – Real People, Real Solutions";

export const TEMPLATE_SUPPORT_INTRO = `Whether you're facing an urgent issue, need technical advice, or simply want to speak to someone who understands your equipment, our Customer Support team is here to help — quickly, clearly, and with minimal disruption to your operations.`;

export const TEMPLATE_SUPPORT_SERVICES = [
  { title: "Phone & Email Support", description: "Whether you're facing an urgent issue, need technical advice, or simply want to speak to someone who understands your equipment, our Customer Support team is here to help — quickly, clearly, and with minimal disruption to your operations." },
  { title: "Remote Diagnostics", description: "For supported systems, we can remotely access PLCs, HMIs, and SCADA-based controls to diagnose issues fast and reduce downtime." },
  { title: "Process & Technical Advice", description: "Get guidance on equipment optimisation, configuration, and daily operation best practices." },
  { title: "Technician On-Demand", description: "If required, we'll arrange for a technician to attend your site quickly and efficiently." },
  { title: "Parts & Repairs Coordination", description: "Seamless collaboration with our Spare Parts and Service Departments to ensure timely sourcing and installation of components." },
];

export const TEMPLATE_SUPPORT_FOOTER = `We're Here to Keep You Running
If it matters to your production, it matters to us. From day-to-day questions to emergency response, our Customer Support team is just a call or email away.
Service@oestergaard.com.au | spareparts@oestergaard.com.au | +61 2 9834 3665`;

export const TEMPLATE_LETTER_INTRO = (supplierBrand: string, productDescription: string) =>
  `Following your request, we are pleased to send you our proposal for the best packaging solution according to your production needs:\n${supplierBrand} ${productDescription}`;

export const TEMPLATE_LETTER_CLOSING = `I trust that you find the quotation satisfactory, and I thank you for your interest in the {{SUPPLIER}} range of equipment. I look forward to any comments or questions that you have regarding this proposal and our continued discussions regarding the project.

Yours faithfully,
OESTERGAARD PTY LIMITED


Bill Hili
DIRECTOR.`;

export const TEMPLATE_PRICE_NOTES = [
  "Payment for Equipment is invoiced in Euro currency.",
  "Installation invoice in AUD after commissioning.",
  "Customs clearances, GST and local delivery invoiced directly by the local nominated forwarder.",
];

export const TEMPLATE_COMPANY_DETAILS = {
  name: "Oestergaard Pty Ltd",
  acn: "ACN 629 325 837",
  phone: "+61 2 9834 3665",
  serviceEmail: "Service@oestergaard.com.au",
  sparePartsEmail: "spareparts@oestergaard.com.au",
  director: "Bill Hili",
};

/**
 * Template section order for PDF generation.
 * Each section maps to a page or content block in the output.
 */
export const TEMPLATE_SECTIONS = [
  "cover",
  "about",
  "support",
  "letter",
  "pricing_table",
  "sales_conditions",
  "terms_of_trade",
] as const;

export type TemplateSection = typeof TEMPLATE_SECTIONS[number];
