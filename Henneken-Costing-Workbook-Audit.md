# Henneken Costing Workbook (`Costing.xlsx`) Audit Report

This report documents the exact cell-by-cell calculation structure inspected across both worksheets (`30% dic` and `Sheet1` / `25% Dic`) of `Costing.xlsx` for **Henneken** equipment.

---

## 1. Worksheet Structure & Column Mapping

Each worksheet contains the following columns for calculating equipment line items:
- **Column A / B:** Item Description & Quantity (`Qty`)
- **Column C:** Henneken List Price (EUR unit price)
- **Column D (`=C * B`):** Total List Price (EUR)
- **Column E:** Henneken Discount Factor (e.g., `0.7` for 30% discount, or `0.75` for 25% discount)
- **Column F (`=D * E`):** Oestergaard Purchase Price / Net Cost (EUR)
- **Column G:** Oestergaard Margin Divisor factor (e.g., `0.75`, representing a gross margin markup divisor)
- **Column H (`=F / G`):** Sell Price (EUR)

---

## 2. Mathematical Logic Verified

1. **Net Purchase Price (EUR):**
   $$\text{Net EUR} = \text{List Price} \times \text{Qty} \times \text{Discount Factor}$$
   *(e.g., for HVM650 Mixer: $24,090 \times 2 \times 0.7 = \$33,726.00$)*

2. **Sell Price (EUR):**
   $$\text{Sell EUR} = \frac{\text{Net EUR}}{\text{Margin Divisor}}$$
   *(e.g., $\$33,726.00 / 0.75 = \$44,968.00$)*

3. **Subtotals (`=SUM(...)`):**
   - Row 21 sums the mixer accessories subtotal.
   - Subsequent rows calculate tumbler lines (e.g., Tumblers B6, 3000 ltr).

---

## 3. Vendor Isolation Rule
Because this calculation structure is specific to **Henneken**, the application maintains it as an isolated pricing model (`list_minus_distribution` with explicit discount factor and margin divisor), ensuring it does not interfere with Foodmate (`as_is`), Collimatic (`net_price`), or other vendor rules.
