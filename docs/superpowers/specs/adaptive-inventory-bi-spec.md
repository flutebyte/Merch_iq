# Adaptive Inventory BI — MVP Implementation Specification

**Version:** 1.0  
**Date:** 2026-06-06  
**Status:** Implementation-ready  
**Source documents:**  
- Design: `superpowers/specs/2026-06-04-adaptive-inventory-bi-design.md`  
- Engineering review: `superpowers/reviews/adaptive-inventory-bi-plan-eng-review.md`  

All engineering review decisions (D2–D10) are incorporated. All critical concerns (E1–E5) are resolved.

---

## 1. Product Overview

Adaptive Inventory BI is a responsive web application for small apparel brands that starts with imperfect, incomplete, or missing data and improves confidence over time.

The product accepts businesses as they are — messy spreadsheets, no spreadsheets, partial SKU lists, approximate quantities — and creates value immediately from partial data. As users take daily actions (verifying counts, recording sales, adding prices), Business Confidence rises and the dashboard becomes more accurate.

The core insight: a family-run apparel brand does not fail because they lack good software. They fail because good software refuses to work until they clean up their data first. This product inverts that requirement.

**Target deployment:** Responsive web app (desktop + mobile web). No native app in MVP.

**Technology decisions (locked):**
- Database: PostgreSQL
- Photo storage: S3 or Cloudflare R2, presigned URL direct upload
- Job queue: pg-boss (Postgres-backed, no Redis dependency for MVP)
- Confidence score: computed by background job, cached on Brand record

---

## 2. Product Goals

**G1 — Zero-friction start for messy businesses**  
A brand with no organized inventory file can start capturing stock in under 5 minutes using only a phone camera. No spreadsheet preparation required.

**G2 — Immediate value for organized businesses**  
A brand with a clean CSV or Excel export can import, see their full inventory, and read their Business Confidence score within 10 minutes of signup.

**G3 — Business Confidence is always honest**  
The dashboard never shows a number without context. Every insight declares whether it comes from verified, unverified, imported, or partial data.

**G4 — Daily activity improves the data**  
Every time a user verifies a count, records a sale, or adds a missing price, the system reflects that improvement. Business Confidence goes up visibly.

**G5 — Foundation for future accountability**  
The MVP records enough event history to support partner accountability and leakage detection as post-MVP features. No separate migration needed.

---

## 3. Non-Goals

The following are explicitly out of scope for MVP. Implementation must not build toward them.

| Item | Deferred Until |
|------|---------------|
| ERP direct API integrations | Post-MVP (CSV/Excel covers MVP segment) |
| AI photo recognition or quantity counting | Post-MVP |
| Rack, shelf, bin warehouse mapping | Post-MVP (multi-warehouse brands) |
| Native iOS or Android app | Post-MVP (validate mobile web camera UX first) |
| Barcode or QR label generation | Post-MVP |
| Full partner settlement and reconciliation UI | Post-MVP (event model prepares for this) |
| Advanced ML-based sales forecasting | Post-MVP |
| Multi-company franchise controls | Post-MVP |
| Accounting system integrations | Post-MVP |
| Insight storage as DB records | Never — insights are computed queries, not stored |

---

## 4. User Roles

### Brand Owner (primary)

The first experience is designed for this role. Often a single person managing inventory, sales, warehouse activity, and partner relationships.

Permissions: full read/write on all brand data. Sees Business Confidence, Action Queue, Business Feed, Sales Intelligence, and all inventory.

### Warehouse Staff

Executes physical counts and inventory movements. Can add stock, update quantities, and capture photos. Cannot edit prices or access sales intelligence.

Permissions: create/edit StockLots, capture photos, update inventory status. Read-only on SalesRecord. No access to Business Confidence breakdown detail.

### Sales User

Records sales. Can add SalesRecords. Cannot edit inventory quantities or access cost prices.

Permissions: create SalesRecord, read Product and StockLot (quantity + status only). No access to cost prices or Business Confidence breakdown.

### Finance User

Reads financial data. Can see cost prices, selling prices, stock value, sales records. Cannot edit inventory.

Permissions: read-only on all data. No write access.

---

## 5. Information Architecture

```
Brand
  └── Products
        └── StockLots (one or more per Product)
              └── InventoryEvents (append-only audit log per StockLot)

Brand
  └── SalesRecords (linked to Product + optional StockLot)
  └── ImportJobs (one per file upload)
  └── Business Confidence (cached on Brand, computed async)
```

**Key relationships:**
- One Product → many StockLots (multiple batches, confidence states, or sources)
- One StockLot → many InventoryEvents (full audit trail)
- One SalesRecord → one Product + optional StockLot FK
- One Brand → one cached confidence score + breakdown JSON

**Navigation hierarchy:**
```
App root
  ├── Dashboard (home)
  │     ├── Business Confidence widget
  │     ├── Action Queue (top 3)
  │     ├── Business Feed
  │     └── Sales Intelligence summary
  ├── Inventory
  │     ├── All Stock (filterable by status, confidence, product)
  │     ├── Inventory Health (gaps view)
  │     └── Conflict List
  ├── Products
  │     ├── Product list (filterable, searchable)
  │     └── Product detail → linked StockLots
  ├── Sales
  │     ├── Sales records list
  │     └── Add sale form
  ├── Action Queue (full)
  ├── Import (CSV/Excel upload)
  └── Settings
        ├── Brand profile
        └── User management
```

---

## 6. Core Screens

### S1 — Onboarding: Inventory Readiness Selection

Single question with 5 answer labels. Routes to 2 engineering paths.

**Labels (shown to user):**
1. Already organized in Excel or CSV
2. Already organized in ERP or inventory software
3. Partly organized, partly messy
4. Mostly unorganized, no clean file
5. Starting from scratch, no existing inventory

**Engineering routing (2 paths only):**
- **Has-file path:** Labels 1, 2, 3 → CSV/Excel import flow
- **No-file path:** Labels 4, 5 → Photo-first capture flow

No other code paths. The 5 labels are UX distinctions only.

### S2 — Dashboard (Desktop)

Priority order top-to-bottom:
1. Business Confidence score + weekly delta + top 3 drivers (positive and negative)
2. Action Queue (next 5 items, with quick-complete buttons)
3. Business Feed (last 10 events)
4. Inventory Health summary (count of gaps by category)
5. Sales Intelligence (revenue this month, best sellers, dead stock alert count)

### S3 — Dashboard (Mobile)

Priority order top-to-bottom:
1. Action Queue (next 3 items, full-width tap targets)
2. Quick capture button (opens photo flow)
3. Business Confidence (compact: score + one-sentence status)
4. Business Feed (last 5 events)
5. Sales Intelligence (collapsed summary)

### S4 — Photo Capture Flow

Sequence:
1. Camera opens (or file picker fallback if getUserMedia unavailable)
2. User takes or selects photo
3. Client-side validation runs before upload (see Business Rules §16)
4. Presigned URL fetched; photo uploaded directly to S3/R2
5. StockLot created with `confidence_state = photo_only`
6. Optional quick-entry: product name (text) and rough quantity (number)
7. If name added → `confidence_state = draft_photo`
8. Draft appears in inventory immediately with "Incomplete" label
9. Action Queue tasks generated for all missing fields

One tap to continue capturing. Minimal friction. No required fields beyond the photo.

### S5 — CSV/Excel Import

Sequence:
1. File upload (client-side validation: type + size)
2. First 5 rows previewed in a column mapper
3. User maps columns to fields (product name, SKU, quantity, price, category, size, color)
4. Unmapped columns ignored
5. Submit triggers async ImportJob
6. Progress indicator shown (polling `/api/import-jobs/:id/status`)
7. On complete: summary shown (rows imported, rows skipped, errors)
8. All imported StockLots start at `confidence_state = imported_unverified`

### S6 — Inventory List

Filterable by:
- Confidence state (multi-select)
- Inventory status
- Category, size, color
- Has/missing: price, quantity, photo, SKU

Sortable by: product name, confidence state, quantity, last updated.

Shows per-row: product name, SKU (if known), quantity (or "Unknown"), confidence state badge, inventory status, photo thumbnail (if exists).

### S7 — Inventory Health

Aggregate view of data gaps:

- Products missing selling price: count + "Add prices" CTA
- Stock lots with unknown quantity: count + "Verify counts" CTA
- Products missing category: count + "Add categories" CTA
- Products missing photos: count + "Add photos" CTA
- Lots in conflict_detected state: count + "Resolve conflicts" CTA
- Lots in imported_unverified state: count + "Verify imports" CTA
- Aging stock (>90 days, no sales): value estimate + "Review dead stock" CTA

### S8 — Action Queue (Full)

Sorted by priority (system-assigned). Each item:
- Task description (plain language: "Add price to Black T-Shirt")
- Product photo thumbnail if available
- Impact on Business Confidence if resolved ("+1.2%")
- One-tap action (opens edit form or navigates to correct screen)
- "Skip for now" option (snoozes task 7 days)

### S9 — Sales Record Entry

Form fields:
- Product (searchable dropdown)
- Stock Lot (optional — shown only if product has multiple lots; defaults to "unspecified")
- Quantity sold
- Selling price (pre-filled from product if set)
- Sale channel (dropdown: direct, partner, retail_store, online, other)
- Sale date
- Partner or customer (optional free text)
- Source (pre-filled: manual_entry)
- Notes (optional)

### S10 — Sales Intelligence

Views:
- Best sellers (by quantity sold, last 30/90 days)
- Slow sellers (low velocity, sortable by units and value)
- Revenue trend (weekly bar chart, last 12 weeks)
- Category performance (revenue by category)
- Size distribution (units sold by size)
- Dead stock alerts (lots with zero sales > 90 days)

Every insight includes a confidence label: "Based on verified data," "Based on imported, unverified data," or "Based on partial data — {N} products missing."

### S11 — Conflict Resolution

Shown when `confidence_state = conflict_detected`:
- Side-by-side view of the two conflicting values (source A says X, source B says Y)
- Both InventoryEvents shown with timestamps and sources
- User selects which value to keep or enters a corrected value
- Resolution creates a `conflict_resolution` InventoryEvent
- Confidence state returns to pre-conflict state (or `count_verified` if user counts during resolution)

### S12 — Business Feed

Chronological stream of brand activity. Each entry:
- Timestamp
- Event description (plain language)
- Confidence delta if applicable ("+1.2%")
- Link to affected record

---

## 7. Navigation

### Desktop navigation (sidebar)

```
[Brand logo / name]
─────────────────
Dashboard          (home icon)
Inventory          (box icon)
  All Stock
  Inventory Health
  Conflicts
Products           (tag icon)
Sales              (chart icon)
─────────────────
Action Queue       (checkmark icon, count badge)
Import             (upload icon)
─────────────────
Settings           (gear icon)
```

### Mobile navigation (bottom tab bar)

```
[Dashboard] [Inventory] [+ Capture] [Sales] [Queue]
```

The center "+" button opens the photo capture flow directly. This is the primary mobile action.

### Mobile-specific behaviors

- Action Queue items are full-width swipeable cards
- Photo capture opens with camera by default; file picker fallback on first failure
- Inventory list uses infinite scroll, not pagination
- Sales entry uses a simplified bottom-sheet form

---

## 8. User Flows

### Flow A: No-file brand onboarding

```
Signup
  → Inventory Readiness: "Mostly unorganized" or "Starting from scratch"
  → Photo capture opens
  → User takes photo of first product
  → Optional: adds product name + rough quantity
  → Draft appears in inventory
  → Dashboard shown: "1 item captured. 0% Business Confidence. Here's what to do next."
  → Action Queue shows first tasks
```

### Flow B: Organized brand onboarding

```
Signup
  → Inventory Readiness: "Organized in Excel/CSV"
  → Upload file (with type/size validation)
  → Column mapping screen
  → Import job queued
  → Progress indicator
  → Import complete: "247 products imported. Business Confidence: 52%. Next: verify quantities."
  → Dashboard shown with inventory visible
```

### Flow C: Quantity verification

```
Action Queue item: "Verify quantity for Black Kurta (imported: 100 units)"
  → User opens item
  → User counts physically, enters: 84 units
  → System creates InventoryEvent: count
  → StockLot.confidence_state → count_verified
  → StockLot.quantity_certainty → exact
  → Business Confidence recalculated async
  → Business Feed: "Quantity verified for Black Kurta (+1.4%)"
```

### Flow D: Recording a conflict

```
User imports updated CSV: "Black Kurta = 72 units"
  → Import compares against existing count_verified lot (84 units)
  → Values disagree → StockLot.confidence_state → conflict_detected
  → Conflict appears in Inventory Health and Conflict List
  → Business Confidence drops (conflict_detected weight = 0.0)
  → Action Queue: "Resolve conflict: Black Kurta (imported says 72, counted says 84)"
  → User opens conflict resolution screen
  → User selects the counted value (84) as correct
  → InventoryEvent: conflict_resolution created
  → StockLot returns to count_verified
```

### Flow E: Recording a sale

```
User opens Sales → Add Sale
  → Selects product: "Blue Linen Shirt"
  → If product has multiple StockLots: selects which lot (optional)
  → Enters quantity: 3
  → Enters price: ₹1,200
  → Saves
  → SalesRecord created
  → InventoryEvent: sale created
  → Lot quantity decremented
  → If lot had count_verified state, transitions to sales_reconciled
  → Sales Intelligence updates on next read
```

### Flow F: Photo draft promotion

```
Draft StockLot (confidence_state = photo_only):
  → Action Queue: "Add name to photo item"
  → User opens draft, adds product name
  → confidence_state → draft_photo

  → Action Queue: "Add quantity to [product name]"
  → User opens draft, adds quantity (exact or approximate)
  → confidence_state → manually_entered (promotion triggered: name + quantity both present)

At this point the item is a real inventory record. Action Queue now shows remaining gaps (price, category, etc.) as enrichment tasks, not promotion tasks.
```

### Flow G: Dead stock detection

```
Weekly background process (or on-read):
  → Query: StockLots where last_sale_date is null OR last_sale_date > 90 days ago
  → AND current inventory_status = main_stock
  → AND quantity > 0 (or quantity_certainty != unknown)
  → Result: list with quantity and value estimate (selling_price × quantity if price known)
  → Dashboard: "₹2.1L of stock has not moved in 90+ days"
  → Sales Intelligence: Dead Stock tab shows items sorted by value
  → Confidence label: "Based on imported, unverified data" if lots are imported_unverified
```

---

## 9. Dashboard Requirements

### Business Confidence widget

**Displayed value:** A percentage (0–100%) with one decimal place. Example: `72.4%`.

**Weekly delta:** Shows change since 7 days ago. Example: `+3.2% this week`.

**Driver breakdown (top 3 positive + top 3 negative):**
```
Improving your score:
  +4.1%  from 12 quantities verified this week
  +1.8%  from 3 prices added

Dragging your score down:
  -6.2%  from 47 products missing price
  -3.1%  from 2 lots in conflict
  -2.0%  from 18 imported lots not yet verified
```

Drivers use plain language, not field names. "Products missing price" not "null selling_price count."

**Update cadence:** Score is recomputed by background job within 30 seconds of any write event (import, photo, count, sale, conflict resolution). Cached on Brand record. Dashboard reads from cache, not on-demand query.

**Score range guidance (shown contextually, not always visible):**
- 0–40%: "Your business data is mostly unverified. Start with Action Queue."
- 41–65%: "Good progress. Verify quantities and add missing prices to improve."
- 66–85%: "Your data is largely reliable. Focus on resolving any conflicts."
- 86–100%: "High confidence. Maintain by recording sales and verifying counts regularly."

### Action Queue widget (dashboard truncated view)

Shows top 5 items by priority. Each has:
- Task description
- Product name
- "Do it now" button (navigates to correct edit screen)
- "Full Queue" link at bottom

### Business Feed widget

Last 10 events, newest first. Plain language. Examples:
- "5 products added via import"
- "2 quantities verified — Business Confidence increased to 74.1%"
- "15 units sold across 3 products"
- "1 conflict detected: Blue Kurta (imported vs. counted)"
- "Business Confidence dropped 2.1% — 3 new conflicts detected"

### Mobile dashboard

The mobile dashboard shows:
1. Business Confidence score (compact: score + one-line status)
2. Action Queue (top 3 items, swipeable cards)
3. Quick Capture button (full-width, prominent)
4. Business Feed (last 5 items)

Sales Intelligence and Inventory Health are accessible via tab, not on the primary mobile dashboard.

---

## 10. Action Center Requirements

The Action Queue generates tasks automatically from data gaps. Tasks are prioritized by business impact.

### Priority rules

**Priority 1 (show first):** Conflicts requiring resolution — these actively depress Business Confidence to zero and must be resolved before confidence can improve.

**Priority 2:** High-value gaps — missing prices on products with known stock quantities (prevents stock value estimation).

**Priority 3:** Verification gaps — imported or approximate quantities that can be confirmed with a count.

**Priority 4:** Enrichment gaps — missing category, size, or photo on products with otherwise complete records.

**Priority 5:** Draft completion — photo-only or draft_photo items missing name or quantity.

### Task types

| Task type | Trigger condition | One-tap action |
|-----------|-------------------|----------------|
| Resolve conflict | confidence_state = conflict_detected | Opens conflict resolution screen |
| Add price | selling_price is null AND quantity is not null | Opens product edit form, price field focused |
| Verify quantity | quantity_certainty = approximate OR confidence_state = imported_unverified | Opens count entry form |
| Add name to photo | confidence_state = photo_only | Opens draft edit, name field focused |
| Add quantity | quantity is null AND name is not null | Opens count entry form |
| Add category | category is null | Opens product edit, category field focused |
| Add size | size is null | Opens product edit, size field focused |
| Add photo | photos array is empty AND product exists | Opens photo capture for existing product |
| Review dead stock | no sales in 90+ days AND main_stock status | Opens dead stock detail screen |

### Task deduplication

The Action Queue generator is idempotent. Running it twice for the same StockLot in the same state produces one task, not two. Tasks are generated by querying the data state, not by firing events.

### Task snooze

Users can snooze any task for 7 days. Snoozed tasks do not appear in the queue during that period but reappear after. Snooze does not affect Business Confidence.

### Task completion

When the underlying data gap is resolved (price added, quantity verified, etc.), the task disappears automatically on the next queue refresh. No manual "mark complete" needed.

---

## 11. Photo Draft Inventory Requirements

### What a photo draft is

A StockLot record where the primary anchor is a photo, and all other fields may be unknown. Photo drafts are real inventory records, not temporary placeholders. They appear in inventory lists, contribute to Business Confidence calculation (at low weight), and generate Action Queue tasks.

### Capture flow

1. User taps "Capture" (mobile) or "Add via Photo" (desktop)
2. Camera opens via getUserMedia API
3. **Fallback:** If getUserMedia is unavailable or denied, show file picker (`<input type="file" accept="image/*">`) without error messaging. The user should see a file picker, not a failure state.
4. Client validates the selected file before requesting upload URL (see Business Rules §16.2)
5. App fetches a presigned S3/R2 upload URL from server
6. Photo uploaded directly from browser to S3/R2 (server never handles file bytes)
7. On upload success: server creates StockLot with `confidence_state = photo_only`, `source = photo`, all fields nullable except `photo_keys`
8. Optional name prompt: "What is this product?" (single text field, dismissible)
9. Optional quantity prompt: "Roughly how many?" (number field with "Don't know" option, dismissible)
10. Draft saved. User continues to next capture or goes to inventory

### Draft promotion lifecycle

Promotion is triggered automatically when conditions are met. No user action required beyond filling in the fields.

| Condition | Confidence state after |
|-----------|----------------------|
| Photo only (no name, no quantity) | photo_only |
| Photo + name added | draft_photo |
| Photo + name + quantity added (any certainty) | manually_entered |
| Photo + name + quantity + verified count | count_verified |

A draft_photo with both name and quantity becomes `manually_entered` immediately when the second field (name or quantity, whichever comes second) is saved. This is the promotion trigger.

`manually_entered` is a real inventory record. Once promoted, the item no longer shows "Incomplete" labeling. Remaining gaps (price, category, size) become standard enrichment tasks, not promotion blockers.

### Draft display rules

- Drafts appear in the inventory list with an "Incomplete" badge
- Drafts appear in the dashboard gap summary: "3 photo items need names", "5 photo items need quantities"
- Framing in all owner-facing copy: "inventory risk and recovery opportunity" — never "invalid records," "failed capture," or "missing data"
- Dashboard values exclude drafts from stock value totals unless quantity_certainty is known (never show "₹0 stock value" due to drafts)

### Client-side photo validation (required before upload)

Implemented in the browser before the presigned URL is requested:

```
Max file size: 15MB
Accepted MIME types: image/jpeg, image/png, image/webp, image/heic, image/heif
On rejection: show inline error, do not create draft, do not fetch presigned URL
```

Client-side compression: use browser-image-compression library to compress images > 2MB to 2MB before upload. Keep originals ≤ 2MB as-is.

Generate and store a 400px thumbnail at upload time. List views use the thumbnail; detail views use the original. This prevents serving 8MB originals in inventory lists.

### Mobile-specific photo requirements

The photo capture UX must be tested on at least 3 target devices before Phase 2 ships:
- Android Chrome (Redmi or similar mid-range device)
- iOS Safari (iPhone SE or similar entry-level)
- One additional Android device with a different browser if possible

Test cases:
- Single photo capture via camera
- Photo selection from gallery
- Multi-photo batch session (5+ photos)
- Upload on a slow (3G) connection

---

## 12. CSV/XLSX Import Requirements

### File acceptance

Accepted formats: `.csv`, `.xlsx`, `.xls`

Client-side validation before upload:
```
Max file size: 25MB
Accepted MIME types: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel
On rejection: inline error shown, no upload initiated
```

### Column mapping

The system attempts auto-detection of common column names (case-insensitive):
- `sku`, `style code`, `product code` → SKU
- `name`, `product name`, `item name`, `description` → Product name
- `qty`, `quantity`, `stock` → Quantity
- `price`, `selling price`, `mrp`, `rate` → Selling price
- `cost`, `cost price`, `purchase price` → Cost price
- `category`, `type`, `product type` → Category
- `size`, `size name` → Size
- `color`, `colour` → Color

Unmapped columns are ignored. The user can manually override any auto-detected mapping on the mapping screen.

At least one column must be mapped before import can proceed. Recommended minimum: product name or SKU.

### Deduplication

Deduplication runs after mapping, before import.

**Match strategy (in order):**

1. **Exact SKU match:** If imported row has a SKU and an existing StockLot has the same SKU and same brand_id, treat as an update to that lot (update quantity, price, etc. with a new InventoryEvent). Do not create a duplicate.

2. **Fuzzy name match:** If no SKU match, compare product name using case-insensitive normalized string match (strip punctuation, lowercase). If match confidence > 85%, surface to user as "possible duplicate" with side-by-side comparison. User confirms merge or proceeds as new record.

3. **No match:** Create new Product and StockLot.

All imported rows start at `confidence_state = imported_unverified` regardless of their source confidence. Import is not a verification step.

### Async import pipeline

Imports are processed as background jobs (pg-boss queue).

**Import flow:**
1. File uploaded to S3/R2 (presigned URL, same pattern as photos)
2. ImportJob record created with `status = queued`
3. Background job processes file row by row
4. `processed_count` and `row_count` updated as job runs
5. Client polls `/api/import-jobs/:id/status` every 3 seconds
6. Progress bar shown: "Importing... 143 of 247 rows"
7. On complete: ImportJob `status = complete`, summary returned
8. On error rows: `error_rows` JSON records row number, content, and reason

**Import summary (shown after complete):**
- X products imported (new)
- Y products updated (matched existing)
- Z rows skipped (duplicate detected, user saw warning)
- W rows failed (show error table: row #, content, reason)

**Manual retry:** User can restart a failed import. The system does not auto-retry.

**Stuck import detection:** If an ImportJob has `status = processing` for more than 10 minutes, the dashboard shows a warning: "Import seems stuck. [Retry] [Contact support]." The retry button cancels the stuck job and allows re-upload.

### Imported record behavior

All imported StockLots start at `confidence_state = imported_unverified`. They:
- Appear in the inventory list immediately
- Contribute to Business Confidence at 50% weight (imported_unverified)
- Generate Action Queue tasks for verification
- Can be linked to SalesRecords

---

## 13. Dead Stock Opportunity Requirements

### Definition

A StockLot is considered dead stock if:
- `inventory_status = main_stock` AND
- `quantity > 0` OR `quantity_certainty != unknown` AND
- Either: no SalesRecord linked to this lot in the past 90 days, OR: no SalesRecord for this product in the past 90 days (for lots without `stock_lot_id` on sales)

The 90-day threshold is configurable per brand (default: 90 days).

### Dead stock value estimate

For each dead stock lot:
- If `selling_price` is known: estimated value = `quantity × selling_price`
- If selling_price is null: no value estimate shown for that lot
- Aggregate shown: "₹2.1L in dead stock (across 23 products). Note: 8 products are missing prices — actual value may be higher."

### Dead stock display

**Dashboard:** Total dead stock value as a risk alert card. One-line: "₹2.1L of stock has not moved in 90 days." Links to dead stock detail.

**Sales Intelligence — Dead Stock tab:**

Table columns: Product name, SKU, Category, Size, Quantity, Estimated value, Days since last sale, Confidence level.

Sort by: value (default), days idle, quantity.

Filter by: category, confidence level.

**Confidence label:** Every dead stock item shows its data confidence level. A dead stock alert based on imported_unverified inventory is labeled "Medium confidence — quantities not yet verified." This prevents the system from hiding uncertainty in high-stakes recommendations.

### Dead stock computation

Computed on read, not stored. Cached 1 hour per brand alongside the Business Confidence score refresh. Not a separate DB table.

---

## 14. Partner Inventory Foundation Requirements

Partner accountability and leakage detection are not MVP workflows. However, the MVP data model and event log must record enough to enable them post-MVP without a migration.

### What must be recorded now

**StockLot:**
- `inventory_status` includes `partner_inventory` as a valid value
- When stock is assigned to a partner, an InventoryEvent of type `partner_assign` is created with the partner name in the payload JSON

**SalesRecord:**
- `partner` field (optional free text) should be recorded for partner sales
- `channel` field captures the sales origin (direct, partner, retail_store, online, other)

**InventoryEvent:**
- Events of type `return` and `adjustment` are recorded with enough payload data to reconstruct what happened (who returned what, from which partner, at what count)

### What is NOT built in MVP

- No partner management screen (partner list, partner profiles, partner performance dashboards)
- No automated partner reconciliation or settlement UI
- No leakage detection alerts or reports
- No partner-scoped login or access control

### Why this matters

When partner accountability is built post-MVP, it reads from InventoryEvents filtered by `partner_assign`, `return`, and `adjustment` events. If those events are not recorded now, the post-MVP feature cannot reconstruct history. Recording them now costs no additional engineering work; it is a constraint on what must go into each event payload.

---

## 15. Data Model

All fields are nullable unless marked required.

### Brand

```sql
brands
  id              uuid PRIMARY KEY
  name            text NOT NULL
  slug            text UNIQUE NOT NULL
  confidence_score              float           -- cached, updated async
  confidence_breakdown          jsonb           -- driver detail for dashboard
  confidence_last_computed_at   timestamptz
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

### Product

```sql
products
  id              uuid PRIMARY KEY
  brand_id        uuid NOT NULL REFERENCES brands(id)
  sku             text                           -- nullable; not required
  name            text                           -- nullable at draft time
  category        text
  color           text
  size            text
  images          text[]          DEFAULT '{}'
  cost_price      numeric(12,2)
  selling_price   numeric(12,2)
  tags            text[]          DEFAULT '{}'
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

### StockLot

```sql
stock_lots
  id              uuid PRIMARY KEY
  brand_id        uuid NOT NULL REFERENCES brands(id)
  product_id      uuid NOT NULL REFERENCES products(id)
  quantity        integer                        -- null = unknown
  quantity_certainty  text NOT NULL              -- exact | approximate | unknown
  inventory_status    text NOT NULL DEFAULT 'main_stock'
                  -- main_stock | partner_inventory | retail_store |
                  -- in_transit | sold | returned | unknown
  confidence_state    text NOT NULL DEFAULT 'photo_only'
                  -- photo_only | draft_photo | imported_unverified |
                  -- manually_entered | count_verified |
                  -- sales_reconciled | conflict_detected
  source          text NOT NULL
                  -- photo | import | manual_entry | sales_sync | erp_import
  photos          text[]          DEFAULT '{}'   -- S3/R2 object keys
  notes           text
  version         integer NOT NULL DEFAULT 0    -- for optimistic locking
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

### InventoryEvent

```sql
inventory_events
  id              uuid PRIMARY KEY
  brand_id        uuid NOT NULL REFERENCES brands(id)
  stock_lot_id    uuid NOT NULL REFERENCES stock_lots(id)
  event_type      text NOT NULL
                  -- import | photo_capture | photo_draft | manual_entry |
                  -- count | sale | return | adjustment | partner_assign |
                  -- verification | conflict_detection | conflict_resolution
  payload         jsonb NOT NULL DEFAULT '{}'
  created_by_user_id  uuid REFERENCES users(id)   -- nullable for system events
  created_at      timestamptz NOT NULL DEFAULT now()
```

### SalesRecord

```sql
sales_records
  id              uuid PRIMARY KEY
  brand_id        uuid NOT NULL REFERENCES brands(id)
  product_id      uuid NOT NULL REFERENCES products(id)
  stock_lot_id    uuid REFERENCES stock_lots(id)  -- nullable FK (ADDED: E2 resolution)
  size            text
  quantity        integer NOT NULL
  price           numeric(12,2)
  channel         text NOT NULL DEFAULT 'direct'
                  -- direct | partner | retail_store | online | other
  date            date NOT NULL
  partner         text                           -- free text, optional
  source          text NOT NULL
                  -- manual_entry | import | sales_sync
  confidence      text NOT NULL DEFAULT 'medium'
                  -- high | medium | low
  notes           text
  created_at      timestamptz NOT NULL DEFAULT now()
```

### ImportJob

```sql
import_jobs
  id              uuid PRIMARY KEY
  brand_id        uuid NOT NULL REFERENCES brands(id)
  file_url        text NOT NULL                  -- S3/R2 object key
  status          text NOT NULL DEFAULT 'queued'
                  -- queued | processing | complete | failed
  row_count       integer
  processed_count integer         DEFAULT 0
  error_rows      jsonb           DEFAULT '[]'
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

### Required indexes

```sql
-- Inventory visibility queries
CREATE INDEX ON stock_lots(brand_id, inventory_status, confidence_state);
CREATE INDEX ON stock_lots(brand_id, confidence_state);
CREATE INDEX ON stock_lots(brand_id, product_id);

-- Audit log queries
CREATE INDEX ON inventory_events(stock_lot_id, event_type, created_at);
CREATE INDEX ON inventory_events(brand_id, created_at DESC);   -- business feed

-- Sales intelligence
CREATE INDEX ON sales_records(brand_id, product_id, date);
CREATE INDEX ON sales_records(brand_id, date DESC);

-- Product search
CREATE INDEX ON products(brand_id, sku);
CREATE INDEX ON products(brand_id, category);
```

---

## 16. Business Rules

### 16.1 — Confidence State Transitions

State transitions are determined by the Confidence State Machine. Only the state machine may set or change `confidence_state`. No direct field writes bypass the machine.

| Trigger event | Resulting state | Pre-conditions |
|---------------|----------------|----------------|
| Photo captured, no other fields | photo_only | — |
| Name added to photo_only | draft_photo | confidence_state = photo_only |
| Name + quantity both present (either order) | manually_entered | confidence_state = draft_photo |
| CSV or ERP import | imported_unverified | — |
| Manual entry (direct form, all required fields) | manually_entered | — |
| Physical count recorded and saved | count_verified | — |
| Sale recorded against lot | sales_reconciled | confidence_state = count_verified |
| Two sources disagree on quantity | conflict_detected | any state |
| Conflict resolved by user | pre-conflict state restored | confidence_state = conflict_detected |

**Conflict restoration rule:** When a conflict is resolved, the lot returns to the highest-confidence state it held before the conflict was detected. If it was `count_verified` before conflict, it returns to `count_verified` after resolution.

### 16.2 — Photo Upload Validation (Client-Side)

Before requesting a presigned upload URL, the browser must validate:

```
Max file size:     15 MB
Accepted types:    image/jpeg, image/png, image/webp, image/heic, image/heif
On failure:        Inline error message. No presigned URL requested. No StockLot created.
Compression:       Files > 2MB compressed to ≤ 2MB using browser-image-compression before upload.
Thumbnail:         400px thumbnail generated server-side and stored alongside original.
```

### 16.3 — Optimistic Locking

`stock_lots.version` is an integer that increments on every update.

Any write to a StockLot must include the current `version` value. If the `version` in the write request does not match the `version` in the database, the write is rejected with a 409 Conflict response.

The client shows: "This item was updated by another user while you were editing. Please reload and try again."

This applies to: quantity edits, confidence state changes, inventory status changes, notes edits.

### 16.4 — Business Confidence Formula

The confidence score is a weighted average over all StockLots for a brand, plus penalties.

**Step 1: State weight table**

| Confidence state | Weight |
|-----------------|--------|
| count_verified | 1.00 |
| sales_reconciled | 0.95 |
| manually_entered | 0.70 |
| imported_unverified | 0.50 |
| draft_photo | 0.20 |
| photo_only | 0.10 |
| conflict_detected | 0.00 |

**Step 2: Quantity certainty factor**

| Quantity certainty | Factor |
|-------------------|--------|
| exact | 1.0 |
| approximate | 0.7 |
| unknown | 0.0 (excluded from denominator) |

Lots with `quantity_certainty = unknown` are excluded from the weighted average denominator entirely. They are counted as a separate gap metric.

**Step 3: Weighted base score**

```
base_score = sum(state_weight[i] × quantity_certainty_factor[i])
             ────────────────────────────────────────────────────
             sum(quantity_certainty_factor[i])   for all i where certainty != unknown
```

**Step 4: Apply penalties**

```
penalty_missing_price    = -3% × (count of products with null selling_price)
                                  capped at -20%

penalty_conflicts        = -2% × (count of conflict_detected lots / total lots × 10)
                                  capped at -15%
```

**Step 5: Apply bonus**

```
bonus_clean_streak = +2% if zero new conflicts in the past 7 days AND total conflicts = 0
                     (encourages maintenance behavior)
```

**Step 6: Final score**

```
confidence_score = clamp(base_score + penalty_missing_price + penalty_conflicts + bonus_clean_streak, 0, 100)
```

**Breakdown format (stored in `confidence_breakdown` JSON):**

```json
{
  "base_score": 78.2,
  "drivers": [
    { "label": "12 quantities verified this week", "delta": +4.1, "type": "positive" },
    { "label": "47 products missing price", "delta": -6.2, "type": "negative" },
    { "label": "2 lots in conflict", "delta": -3.1, "type": "negative" },
    { "label": "18 imported lots not yet verified", "delta": -2.0, "type": "negative" }
  ],
  "final_score": 72.4,
  "computed_at": "2026-06-06T08:32:00Z"
}
```

The breakdown exposes at most 3 positive and 3 negative drivers, sorted by absolute delta.

### 16.5 — Duplicate Product Detection (Import)

1. **Exact SKU match:** If a row's SKU exactly matches an existing `products.sku` within the same brand, it is treated as an update to that product's most recent StockLot.

2. **Fuzzy name match:** If no SKU match and product name normalizes (lowercase, strip punctuation) to > 85% similarity to an existing product, surface a merge prompt. User confirms or declines.

3. **Duplicate suggestion:** Suggested merge is non-destructive. User can dismiss and create as a new product.

4. **Auto-merge:** Never. The system suggests; the user decides.

### 16.6 — Negative or Impossible Stock

If a sale is recorded that would bring a lot's quantity below zero:
- Do not block the sale
- Record the SalesRecord normally
- Create an InventoryEvent of type `sale`
- Decrement quantity (allowing negative values)
- Surface a warning in the Business Feed: "Sale recorded for Blue Linen Shirt (lot quantity now -3). You may need to verify this lot's actual stock."
- The warning does not prevent the sale

Small brands often record sales before the system has accurate counts. The system accommodates this.

### 16.7 — Import Job Failure Handling

**Stuck detection:** An ImportJob with `status = processing` and `updated_at` more than 10 minutes in the past is considered stuck.

**User notification:** Dashboard and import status screen show: "Your import appears stuck. [Retry Import] [Contact Support]"

**Retry behavior:** Retry cancels the stuck job (status → failed), marks it, and allows the user to re-upload the same file. It does not auto-retry.

**Error rows:** Failed rows are stored in `import_jobs.error_rows` as:
```json
[{ "row": 42, "content": { "name": "Red Shirt", "qty": "lots" }, "reason": "Quantity must be a number" }]
```

Error rows are shown in a table after import. User can correct the file and re-import.

### 16.8 — Action Queue Idempotency

Action Queue tasks are generated by querying the current state of the data, not by events. Running the generator twice produces the same result. No task table is maintained — the queue is computed on read (same pattern as insights) with a short cache (5 minutes).

### 16.9 — Insights Are Computed, Not Stored

There is no Insight database table. Sales intelligence queries (best sellers, dead stock, slow sellers, etc.) run against SalesRecord and StockLot tables on demand.

Insights are cached 1 hour per brand. Cache is invalidated when a SalesRecord or StockLot is written for that brand.

### 16.10 — Multi-Tenant Isolation

Every database query that touches brand data must include `brand_id` as the leading filter clause. All indexes are brand-scoped (first column = brand_id). Cross-brand data is never accessible.

---

## 17. Permissions

### Permission matrix

| Action | Owner | Warehouse | Sales | Finance |
|--------|-------|-----------|-------|---------|
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| View inventory list | ✓ | ✓ | ✓ (qty + status only) | ✓ |
| View cost prices | ✓ | — | — | ✓ |
| Capture photo draft | ✓ | ✓ | — | — |
| Edit StockLot (qty, status) | ✓ | ✓ | — | — |
| Edit Product (price, details) | ✓ | — | — | — |
| View Action Queue | ✓ | ✓ | — | — |
| Complete Action Queue tasks | ✓ | ✓ | — | — |
| Import CSV/Excel | ✓ | — | — | — |
| Record sale | ✓ | — | ✓ | — |
| View sales records | ✓ | — | ✓ | ✓ |
| View sales intelligence | ✓ | — | — | ✓ |
| View Business Confidence score | ✓ | ✓ (score only) | — | ✓ |
| View confidence breakdown detail | ✓ | — | — | ✓ |
| Resolve conflicts | ✓ | ✓ | — | — |
| Manage users | ✓ | — | — | — |
| View brand settings | ✓ | — | — | — |

### Permission enforcement

Permissions are enforced server-side on every API request. Client-side role-based rendering is UI only — it does not substitute for server enforcement.

### User invitation

Brand Owners invite users by email and assign a role at invite time. Invited users receive an email with a signup link scoped to the brand. Users cannot self-register into a brand they were not invited to.

---

## 18. Edge Cases

### EC1 — Import file with no recognizable columns

If the user uploads a file and no columns auto-map, the column mapper shows all columns as "Unmapped." The user must manually map at least one column. If they proceed without mapping any, the import is blocked with a clear message: "Map at least one column to import."

### EC2 — Photo upload with camera permission denied

If the user denies camera permission, the app immediately shows the file picker. No error message. No instruction to "grant permission" — just silently falls back.

### EC3 — Same SKU appears twice in one import file

If a CSV has two rows with the same SKU, the second row overwrites the first row's values (last row wins within a single import). A warning is shown: "2 duplicate SKUs found in file — only the last row was used for each."

### EC4 — Import file with 0 data rows

If the uploaded file has a header row but no data, the import reports: "No products found in file. Check that your file has data below the header row." No ImportJob is created.

### EC5 — Business Confidence background job fails

If the confidence BG job fails (exception thrown, worker crashes), the `confidence_score` is not updated. The dashboard shows the last computed score with a staleness indicator if `confidence_last_computed_at` is more than 1 hour old: "Score last updated 2h ago."

The job queue retries failed jobs up to 3 times with exponential backoff. After 3 failures, the job is moved to a dead-letter state and an alert is logged.

### EC6 — StockLot conflict on version mismatch (optimistic locking)

Client sends a write with version=4. Database has version=5 (another write happened). Server returns 409. Client shows: "This item was updated while you were editing. Reload to see the latest version." The user's changes are not silently discarded — they remain visible on screen for manual comparison.

### EC7 — Product with no photos in photo-first capture

If a user somehow reaches the post-capture draft screen without a photo (upload failure), the draft is not created. The system does not create StockLots without at least one confirmed photo key. The user sees: "Photo upload failed. Please try again." with a retry option.

### EC8 — Sale recorded with no matching StockLot

The `stock_lot_id` on SalesRecord is nullable. If a sale is recorded for a product with no existing StockLot (e.g., the brand sold something before importing their inventory), the SalesRecord is created with `stock_lot_id = null`. This is valid. Sales intelligence uses the product_id to attribute the sale to the product regardless.

### EC9 — Confidence state machine receives an invalid transition

If an event would attempt an undefined transition (e.g., photo_only → sales_reconciled, skipping intermediate states), the state machine raises an error and blocks the write. The attempted state change is logged for debugging. The StockLot remains in its current state.

### EC10 — Large import (> 5,000 rows) on a slow connection

The file upload itself uses a presigned URL and uploads directly to S3/R2. Server receives no file bytes. The upload progress is tracked client-side. After upload, the ImportJob is queued and processed async. The user can close the tab — the job continues in the background. Next session: the completed import is visible in the import history.

### EC11 — Fuzzy name match with ambiguous result

If fuzzy name matching finds two possible existing products with similar match scores (both > 85%), the system shows the top match only (highest score). The user can decline the merge and create a new product.

### EC12 — Dead stock threshold date changes

If the brand owner changes the dead stock threshold (e.g., from 90 days to 60 days), the dead stock query uses the new threshold immediately on the next read. No recalculation needed — it is a query parameter.

---

## 19. Success Metrics

### Week 1 (first user sessions)

| Metric | Target |
|--------|--------|
| Time to first inventory item captured | < 5 minutes from signup |
| Time to first Business Confidence score | < 10 minutes from signup (import path) |
| No-file users: at least 1 draft item created in session 1 | > 80% of no-file users |
| Photo upload success rate (no silent failures) | > 95% |

### Month 1 (early cohort)

| Metric | Target |
|--------|--------|
| Business Confidence score increases week-over-week | > 60% of active brands |
| Action Queue tasks completed per active brand per week | > 5 |
| Import success rate (no stuck/failed jobs) | > 98% |
| Session 2 retention | > 50% |

### MVP success definition

The MVP succeeds if:

1. A user can start without clean inventory — at least one photo draft created in under 5 minutes.
2. A user with organized inventory can import and begin immediately — full import in under 10 minutes.
3. The dashboard shows useful information with partial data — Business Confidence displayed after any first action.
4. Business Confidence provides a clear sense of progress — score visibly increases when users take verified actions.
5. The system never hides uncertainty — every insight declares its data confidence level.
6. The event history is sufficient for future partner accountability features — `partner_assign`, `return`, and `adjustment` events are recorded in MVP.

---

## 20. MVP Release Scope

### In scope for MVP release

| Feature | Notes |
|---------|-------|
| Adaptive onboarding (5 labels → 2 paths) | has-file and no-file paths only |
| Photo-first draft inventory | presigned S3/R2 upload, draft promotion lifecycle |
| CSV/Excel import | async job queue, deduplication, column mapping, error rows |
| Manual product and stock entry | all fields nullable |
| Confidence State Machine (7 states) | with full transition rules as specified |
| Business Confidence score | background job, formula as specified, cached on Brand |
| Inventory Health screen | gap counts by category |
| Action Queue | computed on read, 9 task types, idempotent |
| Business Feed | activity stream, last 100 events |
| Sales record entry | with optional stock_lot_id FK |
| Sales intelligence | best sellers, slow sellers, revenue trends, dead stock |
| Conflict detection and resolution | manual resolution UI |
| Mismatch detection (sources disagree) | surfaces via Action Queue |
| Dashboard (desktop priority order) | as specified in §9 |
| Dashboard (mobile priority order) | as specified in §9 |
| 4 user roles with permission enforcement | Owner, Warehouse, Sales, Finance |
| Optimistic locking on StockLot | version column |
| Import job failure handling | stuck detection, manual retry |
| Partner inventory status tracking | event recording only; no partner management UI |
| Photo thumbnail generation | 400px at upload time |
| Mobile web camera with file picker fallback | getUserMedia + `<input type="file">` fallback |

### Not in MVP (confirmed deferred)

| Feature | Reason |
|---------|--------|
| ERP direct integrations | CSV/Excel covers MVP segment |
| AI photo recognition | not in original spec; post-MVP |
| Rack/shelf/bin warehouse mapping | not needed at MVP scale |
| Native iOS or Android app | validate mobile web camera UX first |
| Barcode/QR label generation | post-MVP |
| Partner settlement and reconciliation UI | events recorded; UI is post-MVP |
| Advanced ML forecasting | basic sales intelligence covers MVP |
| Multi-company franchise controls | single-brand MVP |
| Insight database table | eliminated; insights are computed queries |
| Full event sourcing (pure) | mutable StockLot + audit log is sufficient |

### Phase-by-phase delivery schedule

| Phase | Weeks | Milestone |
|-------|-------|-----------|
| Phase 1: Data Foundation | 1–2 | Schema, state machine code, auth, S3 integration |
| Phase 2: Capture (parallel lanes) | 3–4 | Photo capture + CSV import both working |
| Phase 3: Intelligence (parallel lanes) | 5–6 | Business Confidence BG job + Action Queue live |
| Phase 4: Sales + Dashboard | 7–8 | Sales entry, intelligence, full dashboard |
| Phase 5: Hardening | 9–10 | Optimistic locking, conflict UI, mobile polish |

### Pre-build blockers (must resolve before Phase 1 ends)

1. Confidence State Machine transition rules → resolved in this spec (§16.1)
2. Business Confidence formula → resolved in this spec (§16.4)
3. Job queue technology → pg-boss (Postgres-backed, no Redis for MVP)
4. Photo draft promotion lifecycle → resolved in this spec (§11, §16.1)
5. Deduplication key strategy → resolved in this spec (§16.5)

All 5 blockers are resolved in this document. No decisions remain open.
