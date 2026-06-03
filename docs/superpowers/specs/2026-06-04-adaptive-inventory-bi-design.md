# Adaptive Inventory BI Design

## Product Principle

Build an adaptive inventory and business intelligence system for apparel brands that starts with imperfect data and becomes more accurate over time.

The product must not force brands to clean their business before they can use the software. It should create value from partial data immediately, then help users improve accuracy through daily activity.

## Target User

The primary user is a family-run apparel brand operator who may personally handle inventory, sales, warehouse activity, and partner follow-ups. The product should also support warehouse staff, sales users, and finance users, but the first experience is optimized for one or two people doing many roles.

## Product Scope

The first product is a responsive web app. It should work well on desktop for dashboards and imports, and on mobile for quick capture and verification.

The MVP combines:

- Adaptive onboarding
- Photo-first and product-first inventory capture
- Excel/CSV import
- Inventory visibility
- Business Confidence and Inventory Health
- Business Feed
- Action Queue
- Basic sales intelligence
- Data foundations for future partner accountability and leakage detection

Partner accountability and leakage detection are not full MVP workflows, but the MVP must record enough inventory and sales events to support them later.

## Adaptive Onboarding

The first onboarding step asks how inventory is managed today:

- Already organized in Excel/CSV
- Already organized in ERP or inventory software
- Partly organized and partly messy
- Mostly unorganized
- Starting from scratch

The system routes users based on that answer:

- Organized users import data and begin immediately.
- ERP users upload exports first; direct integrations can come later.
- Partly organized users import what exists and capture missing stock over time.
- Unorganized users begin with photo-first and product-first capture.
- New brands create products and stock records as activity happens.

Imported stock is usable immediately, but starts as `imported_unverified`. Imported inventory should not become fully trusted automatically.

## Core Modules

### Onboarding and Import

Handles inventory readiness selection, Excel/CSV import, ERP export upload, column mapping, duplicate checks, and initial confidence labeling.

### Inventory Capture

Allows users to add stock quickly from imperfect information:

- Product photos
- Product name or SKU, if known
- Category
- Color
- Size
- Quantity, including approximate quantity
- Price, if known
- Optional coarse inventory status
- Notes

The capture priority is:

1. Photo-first
2. Product-first
3. Coarse status/location later
4. Carton or detailed physical organization last

### Inventory Visibility

Shows operational stock visibility without requiring exact warehouse mapping:

- Known stock
- Stock by product, size, and category
- Stock by Inventory Status
- Verified and unverified stock
- Conflict or mismatch list
- Products missing price, quantity, size, category, or photo

### Inventory Health

Shows where the business is messy and what needs cleanup:

- Business Confidence percentage
- Missing prices
- Missing quantities
- Missing categories
- Missing sizes
- Missing photos
- Unverified stock value
- Conflicting records
- Aging or unsold stock value

### Business Feed

Shows progress and recent activity so users feel the system becoming more useful:

- Products added
- Quantities verified
- Sales recorded
- Returns or adjustments
- Business Confidence changes
- Potential mismatches detected
- Slow-moving stock detected
- Imported records resolved

Example feed items:

- 5 products added
- 2 quantities verified
- 15 units sold
- Business Confidence increased from 61% to 63%
- 1 potential mismatch detected

### Sales Intelligence

Shows business performance and recommendations:

- Best sellers
- Slow sellers
- Revenue trends
- Size trends
- Category performance
- Dead stock alerts
- Aging stock
- Suggested actions

Insights must show whether they are based on verified data, partial data, imported data, or conflicting data.

### Action Queue

Turns messy data into small owner-friendly tasks:

- Add missing prices
- Verify quantities
- Review mismatches
- Add category or size
- Add photos
- Check unverified stock value

The dashboard should make the next useful action obvious.

## Dashboard Design

The dashboard is the owner home screen. It answers:

1. What do I know about my business right now?
2. Where is the mess or risk?
3. What should I do next?

Desktop dashboard priority:

1. Business Confidence, sales this month, unverified stock value, dead stock risk
2. Action Queue
3. Business Feed
4. Inventory Health
5. Sales Intelligence charts and recommendations

Mobile dashboard priority:

1. Action Queue
2. Quick capture
3. Business Confidence and Inventory Health
4. Business Feed
5. Sales Intelligence

## Data Model

The system is built around events, source, and confidence. It should not rely on exact locations initially.

### Product

Represents an apparel product or SKU:

- SKU or style code
- Name
- Category
- Color
- Size
- Images
- Cost price
- Selling price
- Tags

### Stock Lot

Represents a quantity of a product known to the system.

Fields:

- Product
- Quantity
- Quantity type: exact or approximate
- Inventory Status
- Confidence State
- Source
- Optional photos
- Optional notes
- Created timestamp
- Updated timestamp

### Inventory Status

Represents where the stock sits in the business flow, using coarse and optional buckets:

- main_stock
- partner_inventory
- retail_store
- in_transit
- sold
- returned
- unknown

The MVP should not depend on racks, shelves, bins, or detailed location mapping. If a brand has one warehouse, the default can simply be main_stock.

### Confidence State

Represents the reliability of a stock record:

- photo_only
- imported_unverified
- manually_entered
- count_verified
- sales_reconciled
- conflict_detected

These states are useful internally, but the owner-facing view should roll them up into Business Confidence.

### Source

Represents where a stock record came from:

- photo
- import
- manual_entry
- sales_sync
- erp_import

Source is required because mismatches are easier to understand when the system knows where each number came from.

### Inventory Event

Represents every meaningful stock action:

- Import
- Photo capture
- Manual entry
- Count
- Sale
- Return
- Adjustment
- Partner assignment
- Verification
- Conflict detection
- Conflict resolution

Events should be preserved instead of overwritten so the product can later support leakage detection and accountability.

### Sales Record

Represents a sale:

- Product
- Size
- Quantity
- Price
- Channel
- Date
- Partner or customer, if known
- Source
- Confidence

### Insight

Represents a generated business observation:

- Insight type
- Message
- Supporting data
- Confidence level
- Recommended action
- Created timestamp

Examples:

- Black shirts sell 3x faster than other shirts.
- Size M accounts for 60% of verified sales.
- Rs. 1.2L of inventory has not moved in 120 days.
- Partner B underperforms compared with other partners.

## Business Confidence

Business Confidence is the main owner-facing trust metric.

Example: `Business Confidence: 72%`

It is based on:

- Verified inventory
- Verified sales
- Missing prices
- Missing quantities
- Missing product details
- Conflicting stock records
- Unreconciled sales
- Unknown source records
- Aging unverified stock value

The score should show drivers:

- +8% this week from verified quantities
- -6% due to products missing quantities
- -4% due to conflicting records
- -3% due to unverified stock value

Individual confidence labels still exist in the data model, but owners should not need to inspect hundreds of them. The dashboard should summarize trust through Business Confidence, then show what actions will improve it.

## Error Handling and Trust

Imperfect data is a normal product state.

### Duplicate Products

If two records look similar, the system suggests a merge but does not merge automatically.

### Conflicting Quantities

If imported stock says 100 units and a manual count says 82, the system preserves both events and marks the related stock as conflict_detected.

### Unknown Values

Missing price, quantity, size, category, or photo should be allowed. The issue appears in Inventory Health and Action Queue.

### Approximate Counts

Approximate quantities are allowed and useful, but they lower confidence until verified.

### Negative or Impossible Stock

If sales exceed known stock, the app warns the user instead of blocking the sale. Small brands may record sales before the system is fully caught up.

### Insight Confidence

Recommendations should explain their basis.

Example:

Rs. 3.2L stock has not moved in 120 days. Confidence: medium, based on imported inventory and sales records.

## MVP Boundaries

### In MVP

- Adaptive onboarding
- Excel/CSV import
- ERP export upload
- Manual product and stock entry
- Photo-first capture
- Inventory Status, Confidence State, and Source
- Business Confidence
- Inventory Health
- Business Feed
- Action Queue
- Basic sales record entry or import
- Sales intelligence dashboard
- Dead stock and slow seller detection
- Simple mismatch detection between sources
- Responsive web app

### Not Full MVP Yet

- Full partner settlement management
- Detailed leakage investigation workflows
- Rack, shelf, and bin warehouse mapping
- Native mobile app
- AI photo recognition or counting
- Automated ERP integrations
- Barcode or QR label generation
- Multi-company franchise controls
- Advanced forecasting
- Accounting reconciliation

### Prepare For Later

The MVP should still record events for:

- Partner stock assignment
- Partner sales
- Returns
- Adjustments
- Source changes
- Confidence changes
- Mismatches and conflicts

## Testing Scenarios

The first implementation should be tested against these scenarios:

- Organized brand imports inventory and all imported stock starts as imported_unverified.
- Partly organized brand imports data and captures missing products manually.
- Messy brand adds product photos without quantity or price, and those gaps appear in Inventory Health.
- User verifies quantities, and Business Confidence increases.
- Sales are recorded against unverified inventory without breaking the system.
- Conflicting quantities create a mismatch instead of overwriting history.
- Missing prices, quantities, and categories appear in Action Queue.
- Business Feed records product additions, verifications, sales, confidence changes, and mismatches.
- Sales Intelligence labels unreliable or partial data instead of showing false certainty.
- Mobile layout prioritizes Action Queue and quick capture.
- Desktop layout prioritizes dashboard visibility and analytics.

## Success Criteria

The MVP succeeds if:

- A user can start without clean inventory.
- A user with organized inventory can import and begin immediately.
- The dashboard shows useful information even with partial data.
- Business Confidence gives a clear sense of progress.
- The system never hides uncertainty.
- The system creates value while improving data quality over time.
- Future partner accountability and leakage detection are possible from the event history.
