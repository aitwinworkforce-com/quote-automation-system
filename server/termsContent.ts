/**
 * Oestergaard Pty Ltd — standard Terms and Conditions of Business.
 * Reproduced from the Oestergaard quotation template (Terms & Conditions
 * section, pages 8–13 of the reference document).
 */

export interface TcSection {
  title: string;
  paragraphs: string[];
}

export const OESTERGAARD_TCS: TcSection[] = [
  {
    title: "1. DEFINITIONS",
    paragraphs: [
      "In these terms and conditions, unless the context otherwise requires: \"Company\" means Oestergaard Pty Ltd (ABN 35 629 325 837) and its successors and assigns; \"Customer\" means the person, firm or company purchasing the Goods and/or Services from the Company; \"Goods\" means all equipment, machinery, spare parts and other goods supplied by the Company to the Customer; \"Services\" means all services (including installation, commissioning, maintenance and repair services) supplied by the Company to the Customer; \"Order\" means any order placed by the Customer for Goods and/or Services; \"Price\" means the price for the Goods and/or Services as stated in the Company's quotation or, where no quotation has been issued, the Company's current price list; \"Terms\" means these terms and conditions of business.",
    ],
  },
  {
    title: "2. INTERPRETATION",
    paragraphs: [
      "In these Terms, unless the context otherwise requires: words importing the singular include the plural and vice versa; words importing any gender include every gender; references to persons include corporations and other legal entities; headings are for convenience only and do not affect interpretation; references to any statute or regulation include all amendments, replacements and re-enactments; and where a word or phrase is defined, its other grammatical forms have a corresponding meaning.",
    ],
  },
  {
    title: "3. APPLICATION OF TERMS",
    paragraphs: [
      "These Terms apply to all quotations issued by the Company and to all Orders accepted by the Company, and supersede all prior negotiations, representations and agreements. Any terms and conditions contained in the Customer's Order or other documents which are inconsistent with these Terms are expressly rejected unless agreed to in writing by the Company. No variation of these Terms is binding on the Company unless agreed in writing by an authorised representative of the Company.",
      "A quotation issued by the Company is not an offer capable of acceptance and is subject to withdrawal or variation at any time before the Company accepts an Order. An Order becomes binding only when accepted by the Company in writing.",
    ],
  },
  {
    title: "4. PRICE",
    paragraphs: [
      "Unless otherwise stated, all Prices are quoted exclusive of GST and any other applicable taxes, duties or charges, which are payable by the Customer in addition to the Price. Prices quoted in foreign currency are subject to exchange rate fluctuation and the Company reserves the right to adjust the Price to reflect movements in the applicable exchange rate between the date of quotation and the date of payment, except to the extent the Price has been fixed by written agreement.",
      "Quotations are valid for the period stated on the quotation (or 30 days where no period is stated). The Company reserves the right to vary the Price to reflect any increase in the cost of supply including, without limitation, foreign exchange movements, freight, insurance, duties and supplier price increases occurring after acceptance of an Order.",
    ],
  },
  {
    title: "5. PAYMENT",
    paragraphs: [
      "Unless otherwise agreed in writing, payment terms are as stated on the quotation (typically 50% deposit upon order and 50% prior to shipment). Time for payment is of the essence. The Company may charge interest on overdue amounts at the rate of 2% per annum above the rate fixed under the Penalty Interest Rates Act, calculated daily from the due date until payment in full.",
      "The Customer must pay all amounts due without set-off, deduction or counterclaim. The Company may suspend delivery of Goods or performance of Services while any amount remains overdue, and may recover from the Customer all costs (including legal costs on an indemnity basis) incurred in recovering overdue amounts.",
    ],
  },
  {
    title: "6. ACCEPTANCE AND DELIVERY OF GOODS",
    paragraphs: [
      "Delivery terms are as stated on the quotation and are interpreted in accordance with Incoterms 2020. Delivery dates are estimates only; the Company is not liable for any loss or damage arising from delay in delivery. The Customer must accept delivery of the Goods when tendered. If the Customer fails to accept delivery, the Company may store the Goods at the Customer's risk and expense, and the Customer must reimburse the Company for all storage, insurance and handling costs.",
      "The Customer must inspect the Goods immediately upon delivery and must notify the Company in writing of any alleged shortage, defect or damage within seven (7) days of delivery, failing which the Goods are deemed accepted in good order and condition.",
    ],
  },
  {
    title: "7. RISK AND TITLE",
    paragraphs: [
      "Risk in the Goods passes to the Customer upon delivery in accordance with the applicable Incoterm. Title in the Goods does not pass to the Customer until the Company has received payment in full of all amounts owing by the Customer to the Company on any account. Until title passes, the Customer holds the Goods as bailee for the Company, must store the Goods so that they are identifiable as the property of the Company, and must not encumber the Goods.",
      "The Customer grants the Company a security interest in the Goods and their proceeds to secure payment of all amounts owing, and acknowledges that the Company may register that interest under the Personal Property Securities Act 2009 (Cth). The Customer waives its right to receive any notice under that Act to the extent permitted by law.",
    ],
  },
  {
    title: "8. INSTALLATION AND COMMISSIONING",
    paragraphs: [
      "Where the Company agrees to install and/or commission the Goods, the Customer must at its cost provide safe and unobstructed access to the site, all necessary services (including power, water, compressed air and drainage), suitable foundations and any lifting equipment required. Installation charges are estimates only and additional time and materials will be charged at the Company's then-current rates. Installation is invoiced in Australian dollars after commissioning of the equipment.",
    ],
  },
  {
    title: "9. WARRANTY",
    paragraphs: [
      "The Company warrants the Goods against defects in materials and workmanship for the period stated on the quotation or, where no period is stated, fifteen (15) months from delivery, two thousand (2,000) operating hours, or twelve (12) months after commissioning, whichever occurs first. The warranty does not cover wear parts, consumables, or defects arising from misuse, neglect, inadequate maintenance, unauthorised modification, or operation outside the manufacturer's specifications.",
      "The Company's liability under this warranty is limited, at the Company's option, to repair or replacement of the defective Goods or components. Warranty claims must be notified to the Company in writing promptly upon discovery of the alleged defect. Goods supplied by third-party manufacturers carry the manufacturer's warranty, and the Company will pass on the benefit of that warranty to the extent it is able.",
    ],
  },
  {
    title: "10. LIMITATION OF LIABILITY",
    paragraphs: [
      "To the maximum extent permitted by law, the Company excludes all conditions, warranties and guarantees implied by law (other than those which cannot be excluded), and is not liable for any indirect or consequential loss, loss of profit, loss of production, loss of revenue or business interruption however arising. The Company's total aggregate liability in connection with the supply of the Goods and Services is limited to the Price paid by the Customer for the Goods and Services giving rise to the claim.",
      "Where legislation implies any condition, warranty or guarantee which cannot be excluded, the Company's liability for breach is limited, at the Company's option, to replacement or repair of the Goods, resupply of the Services, or payment of the cost of replacement, repair or resupply.",
    ],
  },
  {
    title: "11. FORCE MAJEURE",
    paragraphs: [
      "The Company is not liable for any failure or delay in performing its obligations caused by circumstances beyond its reasonable control, including without limitation acts of God, war, sanctions, terrorism, strikes, lockouts, industrial disputes, fire, flood, epidemic, pandemic, shortage of materials, delays by suppliers or carriers, and government action. If such circumstances continue for more than ninety (90) days, either party may terminate the affected Order by written notice without liability, save that the Customer must pay for all Goods delivered and Services performed up to the date of termination.",
    ],
  },
  {
    title: "12. CANCELLATION",
    paragraphs: [
      "The Customer may not cancel an accepted Order without the Company's prior written consent. Where the Company consents to cancellation, the Customer must pay all costs and expenses incurred by the Company up to the date of cancellation, including cancellation charges imposed by the Company's suppliers, plus a reasonable allowance for overheads and profit.",
    ],
  },
  {
    title: "13. INTELLECTUAL PROPERTY AND CONFIDENTIALITY",
    paragraphs: [
      "All intellectual property rights in drawings, specifications, designs, software and technical information supplied by the Company remain the property of the Company or its suppliers. Such materials are supplied in confidence for the Customer's use in connection with the Goods only, and must not be disclosed to any third party or used to manufacture or procure similar goods.",
    ],
  },
  {
    title: "14. GENERAL",
    paragraphs: [
      "These Terms are governed by the laws of New South Wales, Australia, and the parties submit to the non-exclusive jurisdiction of the courts of that State. If any provision of these Terms is held invalid or unenforceable, it is severed and the remaining provisions continue in force. The Company may subcontract the performance of any of its obligations. A failure by the Company to enforce any provision does not constitute a waiver. Notices must be given in writing to the address stated on the quotation or invoice.",
      "The Customer acknowledges that the supply of Goods may be subject to the general terms and conditions of the Company's suppliers (including, where applicable, the Foodmate General Terms and Conditions, October 2023 edition), copies of which are available on request and which apply to the extent stated on the quotation.",
    ],
  },
];
