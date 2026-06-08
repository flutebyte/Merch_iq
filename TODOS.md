# TODOS

Deferred work captured during engineering reviews. Each item has context sufficient to pick up in 3+ months.

---

## TODO-1: GSTR-1 export endpoint for Meesho payment data

**What:** Add `GET /integrations/meesho/gst-export` that generates a GSTR-1-ready CSV from `PlatformOrder.metadata.gst` fields (gst_rate, tax_amount, hsn_code, end_customer_state_new) grouped by HSN code and GST rate.

**Why:** Indian sellers must file GSTR-1 monthly. The Meesho payment/tax report contains exactly the required data (HSN, GST rate, taxable value, state). After the payment import feature ships, this data sits in the DB but is inaccessible in a filing-ready format. Without this endpoint, sellers still manually compile from Meesho Seller Hub.

**Pros:** Turns a storage feature into a filing tool. Closes the loop on why the GST data is collected.

**Cons:** Indian GST rules are non-trivial — IGST applies for inter-state sales (end_customer_state_new ≠ supplier state), CGST+SGST for intra-state. The GSTIN from `eco_tcs_gstin` is Meesho's (TCS), not the seller's — must not be confused. GSTR-1 JSON schema (from GSTN portal) has specific aggregate structure by HSN.

**Context:** `PlatformOrder.metadata.gst` will contain `{ gstRate, taxAmount, hsnCode, endCustomerState, transactionType }` after the Meesho payment import feature ships. The GSTR-1 format is published at gstn.org.in. Seller's own GSTIN is in the `gstin` column of the payment CSV (stored per-row, should match across all rows for a given brand).

**Depends on:** Meesho payment import feature (this sprint) must ship first.

---

## TODO-2: SalesRecord ↔ PlatformOrder join for revenue dashboard

**What:** Build a join between `PlatformOrder` and `SalesRecord` so revenue analytics (currently reading from `SalesRecord.price`) can use `PlatformOrder.netRevenue` (actual net after GST and commissions) for the Meesho channel.

**Why:** `SalesRecord.price` is the selling price from the order CSV. `PlatformOrder.netRevenue` is `total_taxable_sale_value` from the payment report — the actual net revenue the seller keeps after GST. These are meaningfully different numbers. A seller seeing ₹10L revenue vs ₹7L net revenue is a completely different business picture. The revenue dashboard currently shows the wrong number for Meesho.

**Pros:** Makes Meesho revenue accurate. Dashboard shows net realized revenue, not gross. Enables margin calculation when `costPrice` is set on the Product.

**Cons:** `SalesRecord` and `PlatformOrder` have no foreign key today. The link goes through `SalesRecord.externalOrderId` matching `PlatformOrder.platformOrderId` for `platform='meesho'`. This requires a query-time join or a denormalization step. The analytics queries in `analyticsEngine.js` currently read from `SalesRecord` only.

**Context:** Pre-existing schema debt — `SalesRecord` was the original data model before `PlatformOrder` was added for multi-platform orders. The two tables have structural overlap (both store order data) but serve different purposes (SalesRecord = inventory movement tracking; PlatformOrder = financial/fulfillment record). Long-term these may need reconciliation.

**Depends on:** Meesho payment import (for netRevenue data) and a decision on the longer-term schema: keep both tables or migrate one into the other.
