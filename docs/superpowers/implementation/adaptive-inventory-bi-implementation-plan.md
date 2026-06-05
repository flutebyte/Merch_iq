# Adaptive Inventory BI — Implementation Roadmap

**Date:** 2026-06-06  
**Spec:** `superpowers/specs/adaptive-inventory-bi-spec.md`  
**Existing app:** `inventory-app/` — React CRA frontend prototype, no backend  

---

## Existing App Assessment

The existing application is a **UI design prototype only**. It has:
- 7 React screen components with good visual design
- A CSS variable design system (colors, spacing, fonts — all production-quality)
- All data hardcoded in `src/data/seedData.js`
- No backend, no database, no auth, no API calls
- No routing (screen switching via `useState` in App.jsx)
- No state management beyond local component state
- No real photo upload, no real file import, no persistence

**Strategy:** Keep the UI shells and design system. Rebuild everything behind them against real APIs and a real data model. This is a "skin the skeleton" migration — the visual layer is done; the substrate must be built.

---

## 1. Existing Modules Likely Reusable

These components can be used with minimal or zero structural changes. They need data wiring, not redesign.

### 1.1 CSS Design System — `src/index.css`

**Reuse as-is.** The design system uses CSS custom properties (variables) for all colors, spacing, typography, and component tokens (`--surface`, `--accent`, `--border`, `--radius-lg`, etc.). Every component uses these consistently. The system is dark-themed, apparel-brand appropriate, and production-quality.

**What to do:** Copy `index.css` into the new project. Do not replace with a UI library. The existing visual language is an asset.

### 1.2 `Onboarding.jsx`

**Reuse with cosmetic update.** The component already implements the 2-path routing (import → photo) correctly. It has 4 option labels; the spec requires 5 (add "Already organized in ERP or inventory software" → routes to import path). The selection UI, animation, and option card design are directly reusable.

**Change needed:** Add the 5th label (ERP option), update data array. No structural change.

### 1.3 `ImportWizard.jsx` — UX shell

**Reuse the 3-step wizard shell.** The Upload → Map Columns → Preview & Import flow matches the spec exactly. The step indicator, drag-drop zone, column mapping select dropdowns, and preview table are all spec-compliant in structure.

**What is hardcoded and must be replaced:** `MOCK_PREVIEW` data, `COLUMNS` static list, fake file acceptance. The real implementation keeps the same JSX structure but derives column names from actual parsed file headers.

### 1.4 `PhotoCapture.jsx` — UX shell

**Reuse the capture form layout.** The two-panel layout (photo area + optional fields), `<input type="file" accept="image/*" capture="environment">` approach, optional name/quantity fields, and the "captured this session" history list are all spec-aligned.

**What is local-only and must be replaced:** Photo preview uses `URL.createObjectURL()` (local blob). Real implementation fetches a presigned URL, uploads to S3/R2, and creates a StockLot via API on success.

### 1.5 `Sidebar.jsx` — Navigation shell

**Reuse the sidebar structure.** The nav item rendering, active state styling, hover effects, and user footer are all clean and reusable. The icon set (lucide-react) is already installed.

**What must change:** Nav items are a static array. Real implementation adds: Sales, Import, Settings. Badge count on Action Center must come from API (not hardcoded `5`).

### 1.6 `Inventory.jsx` — List shell

**Reuse the table + filter UI.** The search input, status tab filter, category dropdown, and product table columns are all spec-aligned. The empty state is clean.

**What must change:** `seedProducts` import → API call. Status filter uses `verified/draft/unverified`; spec uses 7-state `confidence_state`. Table columns must add `confidence_state` badge and remove the flat `status` field. Filter options must expand to all 7 confidence states.

### 1.7 `ActionCenter.jsx` — Task list shell

**Reuse the accordion task list.** The expandable task cards, progress bar, and completed/pending sections are spec-aligned. The expand/collapse behavior works well.

**What must change:** `seedActions` import → API call. "Mark done" button must call API to record completion. Snooze button needs to be added. Confidence impact delta (`+1.2%`) needs to appear per task.

---

## 2. Existing Modules Requiring Modification

These components need structural changes to match the spec's data model or new feature requirements.

### 2.1 `App.jsx` — Routing and auth

**Problem:** Screen switching via `useState` with `appStage` and `currentScreen`. No URL-based routing, no auth guards, no brand context.

**Required changes:**
- Replace `useState` navigation with `react-router-dom` v6 routes
- Add auth guard (redirect to `/login` if no session)
- Add `BrandContext` provider (current brand_id, user role, confidence score)
- Add routes for: `/login`, `/signup`, `/onboarding`, `/dashboard`, `/inventory`, `/products/:id`, `/sales`, `/actions`, `/import`, `/settings`
- Keep the `appStage` concept as an onboarding-complete flag stored in user/brand record, not component state

### 2.2 `Dashboard.jsx` — Data source and new widgets

**Problem:** All metrics from `seedData`. Missing Business Confidence widget and Business Feed.

**Required changes:**
- Replace all `seedProducts` / `seedActions` / `dashboardStats` with API calls
- Add `BusinessConfidenceWidget` (score, delta, top 3 positive/negative drivers)
- Add `BusinessFeedWidget` (last 10 events, plain language, confidence deltas)
- Replace dead stock banner with API-computed value
- Replace "Inventory at Risk" count with API-computed count (products with confidence_state in warning states)
- Rename "Potential Recovery" to match spec language ("₹X in potential recovery")
- Add staleness indicator when `confidence_last_computed_at` > 1 hour ago

### 2.3 `ProductDetail.jsx` — StockLot awareness

**Problem:** Shows a single flat product. Spec requires understanding that one Product has multiple StockLots, each with its own confidence_state, quantity_certainty, source.

**Required changes:**
- Add a StockLot list section showing all lots for the product
- "Mark verified" button must create a `count` InventoryEvent (not just set local state)
- Inline editing (price, quantity, SKU) must call API with optimistic locking (version field)
- Add `confidence_state` badge per lot (not just product-level status)
- Add conflict detection display (if any lot is `conflict_detected`, show conflict banner)
- Dead stock section: show per-lot accuracy, label as "Based on [data confidence level]"
- Sales history bar chart: source from SalesRecord API, not hardcoded product.sales array

### 2.4 `PhotoCapture.jsx` — Real upload + state machine

**Problem:** Photo stays in browser memory only. No API call. No StockLot created.

**Required changes:**
- Validate file client-side (size ≤ 15MB, MIME type check) before fetching upload URL
- Compress images > 2MB using `browser-image-compression` before upload
- Fetch presigned URL from `/api/storage/presigned-upload`
- PUT photo directly to S3/R2
- On upload success: POST to `/api/stock-lots` with `source: photo`, `confidence_state: photo_only`
- On name entry: PATCH stock lot → confidence_state machine advances to `draft_photo`
- On name + quantity both entered: state machine advances to `manually_entered`
- Show upload progress indicator
- Handle upload failure: show retry, do not create StockLot

### 2.5 `ImportWizard.jsx` — Real file parsing + async job

**Problem:** Column names are static. File is never read. Import is immediate (mock).

**Required changes:**
- Actually read uploaded file headers (use PapaParse for CSV, SheetJS for XLSX)
- Derive actual column names from file and pre-populate the mapping dropdowns
- Validate file client-side (size ≤ 25MB, correct MIME type)
- Upload file to S3/R2 via presigned URL (same pattern as photos)
- POST to `/api/import-jobs` with file S3 key + column mapping
- Poll `/api/import-jobs/:id/status` every 3 seconds
- Show real progress bar (`processed_count / row_count`)
- Show real import summary (new / updated / errors)
- Show error rows table on completion
- Add "stuck job" detection (10+ minutes in processing → show warning)

---

## 3. New Modules That Must Be Built

Everything here is greenfield. The existing prototype has no equivalent.

### 3.1 Backend — Full stack (no backend currently exists)

The existing app has zero server-side code. The entire backend must be built.

**Technology choice:** The spec does not mandate a framework. Recommend **Node.js + Express** (or Fastify) with **Prisma ORM** against PostgreSQL. Rationale: same language as the React frontend, Prisma handles migrations cleanly, pg-boss has first-class Node.js support.

Alternative: If the team prefers Ruby on Rails or Python Django, those work — the data model and business rules are framework-agnostic.

### 3.2 Frontend — New screens

| Screen | Notes |
|--------|-------|
| `Login.jsx` | Email + password form. JWT or session cookie. |
| `Signup.jsx` | Brand name + owner email + password. Creates Brand + User. |
| `SalesScreen.jsx` | Sales records list + Add Sale form (spec §6 S9) |
| `InventoryHealth.jsx` | Gap counts by category with CTAs (spec §6 S7) |
| `ConflictResolution.jsx` | Side-by-side conflict view, select winner (spec §6 S11) |
| `SalesIntelligence.jsx` | Best sellers, dead stock tab, revenue chart (spec §6 S10) |
| `ImportStatus.jsx` | Progress polling view, summary on complete |
| `Settings.jsx` | Brand profile, user management (invite by role) |
| `MobileBottomNav.jsx` | Bottom tab bar for mobile (replaces sidebar on small screens) |

### 3.3 Frontend — New components

| Component | Purpose |
|-----------|---------|
| `BusinessConfidenceWidget` | Score + delta + driver breakdown (spec §9) |
| `BusinessFeedWidget` | Activity stream, last 10 events (spec §6 S12) |
| `ActionTaskCard` | Single Action Queue task with confidence impact delta |
| `StockLotCard` | Single StockLot row with confidence_state badge |
| `ImportProgressBar` | Polling-based progress display |
| `ConfidenceStateBadge` | Color-coded badge for all 7 states |
| `ConfidenceImpactDelta` | "+1.2%" inline chip shown next to tasks |
| `ConflictBanner` | Warning banner shown when a product has conflict_detected lots |
| `UploadDropzone` | Shared between ImportWizard and PhotoCapture |
| `InlineEditField` | Editable field with optimistic locking (version-aware save) |

### 3.4 Frontend — Infrastructure

| Item | What it is |
|------|-----------|
| `src/api/client.js` | Base API fetch wrapper (auth headers, error handling, refresh) |
| `src/api/brands.js` | Brand endpoints |
| `src/api/products.js` | Product CRUD |
| `src/api/stockLots.js` | StockLot CRUD + confidence state |
| `src/api/sales.js` | SalesRecord CRUD |
| `src/api/imports.js` | ImportJob create + poll |
| `src/api/storage.js` | Presigned URL fetch |
| `src/api/actionQueue.js` | Action Queue fetch |
| `src/api/feed.js` | Business Feed fetch |
| `src/contexts/AuthContext.jsx` | Current user + JWT |
| `src/contexts/BrandContext.jsx` | Current brand + confidence score |
| `src/hooks/useApi.js` | Data fetching hook (loading/error/data) |
| `src/hooks/usePolling.js` | Polling hook used by import progress |
| `src/router/index.jsx` | react-router-dom v6 route definitions + auth guard |

### 3.5 Backend — API routes

| Route group | Endpoints |
|-------------|-----------|
| Auth | POST /auth/signup, POST /auth/login, POST /auth/logout, GET /auth/me |
| Brands | GET /brands/:id, PATCH /brands/:id |
| Products | GET/POST /products, GET/PATCH/DELETE /products/:id |
| Stock Lots | GET/POST /stock-lots, GET/PATCH /stock-lots/:id |
| Inventory Events | GET /inventory-events (filtered by lot or brand) |
| Sales Records | GET/POST /sales-records, GET /sales-records/:id |
| Import Jobs | POST /import-jobs, GET /import-jobs/:id/status |
| Storage | POST /storage/presigned-upload (photo + import) |
| Action Queue | GET /action-queue |
| Business Feed | GET /business-feed |
| Sales Intelligence | GET /sales-intelligence/best-sellers, /dead-stock, /revenue-trend |
| Users | GET/POST/PATCH /users (invite, role change) |
| Confidence | GET /brands/:id/confidence (explicit refresh trigger) |

### 3.6 Backend — Services

| Service | What it does |
|---------|-------------|
| `ConfidenceStateMachine` | Determines valid transitions, enforces rules (spec §16.1) |
| `ConfidenceCalculator` | Computes Business Confidence score + breakdown (spec §16.4) |
| `ConfidenceBackgroundJob` | pg-boss job: runs ConfidenceCalculator, writes to Brand |
| `ActionQueueGenerator` | Queries data gaps, returns prioritized task list (spec §10) |
| `ImportProcessor` | pg-boss job: parses file, deduplicates, creates StockLots |
| `ImportDeduplicator` | Exact SKU match → fuzzy name match → new record (spec §16.5) |
| `DeadStockQuery` | Computes dead stock list (computed on read, 1h cache) |
| `BusinessFeedQuery` | Returns last N InventoryEvents as human-readable feed items |
| `SalesIntelligenceQuery` | Best sellers, slow sellers, revenue trends, size distribution |
| `ConflictDetector` | Compares quantities across sources, fires conflict_detected transition |
| `PhotoValidator` | Server-side MIME type check on presigned URL grant |
| `OptimisticLockGuard` | Checks `version` field on StockLot writes, returns 409 on mismatch |

---

## 4. Database Migration Plan

Run migrations in this exact order. Each migration is a separate file. Never combine schema changes that depend on each other.

### M1 — Core tenant models (Week 1, Day 1)

```
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  confidence_score float,
  confidence_breakdown jsonb,
  confidence_last_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brand_users (
  brand_id uuid NOT NULL REFERENCES brands(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner','warehouse','sales','finance')),
  PRIMARY KEY (brand_id, user_id)
);
```

### M2 — Product model (Week 1, Day 1)

```
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id),
  sku text,
  name text,
  category text,
  color text,
  size text,
  images text[] DEFAULT '{}',
  cost_price numeric(12,2),
  selling_price numeric(12,2),
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON products(brand_id, sku);
CREATE INDEX ON products(brand_id, category);
```

### M3 — StockLot model with confidence state machine fields (Week 1, Day 2)

```
CREATE TYPE quantity_certainty_enum AS ENUM ('exact', 'approximate', 'unknown');
CREATE TYPE inventory_status_enum AS ENUM (
  'main_stock','partner_inventory','retail_store',
  'in_transit','sold','returned','unknown'
);
CREATE TYPE confidence_state_enum AS ENUM (
  'photo_only','draft_photo','imported_unverified',
  'manually_entered','count_verified','sales_reconciled','conflict_detected'
);
CREATE TYPE source_enum AS ENUM (
  'photo','import','manual_entry','sales_sync','erp_import'
);

CREATE TABLE stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer,
  quantity_certainty quantity_certainty_enum NOT NULL DEFAULT 'unknown',
  inventory_status inventory_status_enum NOT NULL DEFAULT 'main_stock',
  confidence_state confidence_state_enum NOT NULL DEFAULT 'photo_only',
  source source_enum NOT NULL,
  photos text[] DEFAULT '{}',
  notes text,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON stock_lots(brand_id, inventory_status, confidence_state);
CREATE INDEX ON stock_lots(brand_id, confidence_state);
CREATE INDEX ON stock_lots(brand_id, product_id);
```

### M4 — InventoryEvent append-only log (Week 1, Day 2)

```
CREATE TYPE inventory_event_type AS ENUM (
  'import','photo_capture','photo_draft','manual_entry',
  'count','sale','return','adjustment','partner_assign',
  'verification','conflict_detection','conflict_resolution'
);

CREATE TABLE inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id),
  stock_lot_id uuid NOT NULL REFERENCES stock_lots(id),
  event_type inventory_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON inventory_events(stock_lot_id, event_type, created_at);
CREATE INDEX ON inventory_events(brand_id, created_at DESC);
```

### M5 — SalesRecord with stock_lot_id FK (Week 1, Day 3)

```
CREATE TABLE sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id),
  product_id uuid NOT NULL REFERENCES products(id),
  stock_lot_id uuid REFERENCES stock_lots(id),   -- nullable FK
  size text,
  quantity integer NOT NULL,
  price numeric(12,2),
  channel text NOT NULL DEFAULT 'direct',
  date date NOT NULL,
  partner text,
  source text NOT NULL DEFAULT 'manual_entry',
  confidence text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON sales_records(brand_id, product_id, date);
CREATE INDEX ON sales_records(brand_id, date DESC);
```

### M6 — ImportJob model (Week 2, Day 1)

```
CREATE TYPE import_job_status AS ENUM ('queued','processing','complete','failed');

CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id),
  file_url text NOT NULL,
  status import_job_status NOT NULL DEFAULT 'queued',
  row_count integer,
  processed_count integer DEFAULT 0,
  error_rows jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### M7 — pg-boss job queue tables (Week 2, Day 1)

pg-boss creates its own schema (`pgboss`) when initialized. Run `pgboss.start()` once on first boot — it handles its own migrations. No manual SQL needed.

**Job queue names to register:**
- `confidence-score-update` — triggered by any StockLot or SalesRecord write
- `import-process` — triggered by ImportJob creation

---

## 5. API Implementation Order

Implement in this order. Each layer unlocks the next. Do not implement endpoints out of order — the frontend cannot test without the backend endpoints it depends on.

### Batch A — Auth + Brand (Phase 1, Week 1)

Must be first. Nothing else works without auth.

```
POST   /auth/signup              Create user + brand + brand_user(owner)
POST   /auth/login               Returns JWT
POST   /auth/logout              Invalidates session
GET    /auth/me                  Returns current user + brand + role
GET    /brands/:id               Brand record including confidence_score
```

### Batch B — Products + Stock Lots (Phase 1, Week 1)

Core data model. Import and photo capture both create these.

```
GET    /products                 List (brand_id from JWT), filterable
POST   /products                 Create (all fields nullable)
GET    /products/:id             With linked stock lots
PATCH  /products/:id             Update product fields
GET    /stock-lots               List (brand_id), filterable by confidence_state
POST   /stock-lots               Create (source, confidence_state, product_id)
GET    /stock-lots/:id           With inventory events
PATCH  /stock-lots/:id           Update with optimistic lock (version check)
```

### Batch C — Storage (Phase 1, Week 2)

Required before photo capture or file import can work.

```
POST   /storage/presigned-upload  Returns presigned PUT URL + S3 key
                                  Validates: brand ownership, file type whitelist
```

### Batch D — InventoryEvents (Phase 1, Week 2)

All StockLot mutations must write events. Implement the event writer as a service layer, not a separate endpoint.

```
GET    /inventory-events          List for a lot or brand (audit trail)
```

Event writes happen internally on every StockLot state change — not via a standalone POST endpoint. The state machine calls `appendEvent()` on every transition.

### Batch E — Import Pipeline (Phase 2, Week 3)

Requires: Batch C (storage), Batch B (stock lots), pg-boss running.

```
POST   /import-jobs               Create job (file_url + column_mapping)
GET    /import-jobs/:id/status    Progress polling (processed_count, row_count, status)
```

The job processor runs async via pg-boss. The endpoint returns `202 Accepted` immediately.

### Batch F — Business Confidence (Phase 3, Week 5)

Requires: Batch B (stock lots), Batch E partially (for imported lot states).

```
GET    /brands/:id/confidence     Returns current cached score + breakdown + staleness
POST   /brands/:id/confidence/refresh   Explicit trigger (for testing; normally BG job)
```

The BG job runs automatically on every StockLot or SalesRecord write. The GET endpoint reads from the cache on the Brand record.

### Batch G — Action Queue (Phase 3, Week 5)

Requires: Batch B, Batch F.

```
GET    /action-queue              Computed on read, filtered by brand_id + role
POST   /action-queue/:taskId/snooze   Snooze 7 days (write to snooze table)
```

### Batch H — Business Feed (Phase 3, Week 6)

Requires: Batch D (inventory events).

```
GET    /business-feed             Last 100 events for brand, formatted as feed items
```

### Batch I — Sales Records (Phase 4, Week 7)

Requires: Batch B.

```
GET    /sales-records             List (brand_id), filterable
POST   /sales-records             Create + trigger confidence BG job
GET    /sales-records/:id         Single record
```

### Batch J — Sales Intelligence (Phase 4, Week 7)

Requires: Batch I.

```
GET    /sales-intelligence/best-sellers      ?period=30d|90d
GET    /sales-intelligence/dead-stock        ?threshold_days=90
GET    /sales-intelligence/revenue-trend     ?weeks=12
GET    /sales-intelligence/category-perf
GET    /sales-intelligence/size-distribution
```

All computed on read with 1-hour cache per brand.

### Batch K — Users + Permissions (Phase 4, Week 8)

```
GET    /users                     List brand users (owner only)
POST   /users/invite              Send invite email, create pending user
PATCH  /users/:id                 Update role (owner only)
DELETE /users/:id                 Remove from brand (owner only)
```

---

## 6. Frontend Implementation Order

Mirror the API order. Frontend tasks are ordered by their API dependency.

### F-A — Auth screens + routing infrastructure (Phase 1)

- Install react-router-dom v6
- Create `src/router/index.jsx` with all routes + auth guard
- Create `src/contexts/AuthContext.jsx` (JWT storage, user state)
- Create `src/api/client.js` (fetch wrapper with auth header injection)
- Build `Login.jsx` → POST /auth/login → redirect to /dashboard
- Build `Signup.jsx` → POST /auth/signup → redirect to /onboarding
- Update `App.jsx` to use `<RouterProvider>` instead of state-based navigation

### F-B — Onboarding update (Phase 1)

- Add 5th option label (ERP) to `Onboarding.jsx`
- Connect to `BrandContext` (mark onboarding complete on continue)
- Route to `/import` or `/photo-capture` based on selection (URL-based, not state)

### F-C — Data layer hooks (Phase 1)

- Create `src/hooks/useApi.js` (generic loading/error/data wrapper)
- Create `src/contexts/BrandContext.jsx` (brand_id, confidence_score, role)
- Create all API modules: `brands.js`, `products.js`, `stockLots.js`

### F-D — Photo capture wiring (Phase 2)

- Add client-side file validation (size, MIME type) to `PhotoCapture.jsx`
- Install `browser-image-compression`
- Fetch presigned URL from `/api/storage/presigned-upload`
- PUT file to S3/R2 from browser
- POST to `/api/stock-lots` on upload success
- Update captured session list from API response (not local state)
- Add upload progress indicator
- Add error state (retry button)

### F-E — Import wizard wiring (Phase 2)

- Install PapaParse + SheetJS
- Replace static `COLUMNS` with file-parsed headers
- Replace drag-drop mock with real file validation + presigned URL upload
- POST to `/api/import-jobs` with S3 key + column mapping
- Install `usePolling` hook
- Show real progress bar polling `/api/import-jobs/:id/status`
- Show real import summary (new, updated, error rows table)
- Show "stuck" warning after 10 minutes with retry button

### F-F — Inventory list wiring (Phase 2)

- Replace `seedProducts` with `useApi` call to `/api/products`
- Replace `status` filter tabs with `confidence_state` filter (7 values)
- Add `ConfidenceStateBadge` component (color-coded per state)
- Add confidence_state column to table
- Wire product row click → `/products/:id` route

### F-G — Product detail wiring (Phase 2)

- Replace prop-passed product with API call to `/api/products/:id`
- Add StockLot list section (all lots for this product)
- Wire "Mark verified" to POST `/api/stock-lots/:id` with event `count`
- Wire inline edits to PATCH `/api/stock-lots/:id` with `version` field
- Handle 409 version conflict (show "Updated elsewhere — reload" message)
- Add `ConflictBanner` if any lot is `conflict_detected`
- Replace static sales chart with API data from `/api/sales-records?product_id=:id`

### F-H — Dashboard wiring (Phase 3)

- Replace all `seedProducts`/`seedActions`/`dashboardStats` with API calls
- Add `BusinessConfidenceWidget` (score + delta + top 3 drivers each direction)
- Add `BusinessFeedWidget` (last 10 events from `/api/business-feed`)
- Add staleness indicator when `confidence_last_computed_at` > 1h
- Wire dead stock banner to API value
- Wire "Inventory at Risk" count to API count

### F-I — Action Queue wiring (Phase 3)

- Replace `seedActions` with API call to `/api/action-queue`
- Show `ConfidenceImpactDelta` per task (+1.2% chip)
- Wire "Mark done" to appropriate API call (depends on task type)
- Add "Snooze 7 days" button → POST `/api/action-queue/:taskId/snooze`
- Auto-refresh queue after any completion

### F-J — New screens (Phase 4)

Build in this order (each is independent once the data layer exists):

1. `SalesScreen.jsx` — list + Add Sale form → POST `/api/sales-records`
2. `InventoryHealth.jsx` — gap counts from `/api/stock-lots` aggregates
3. `SalesIntelligence.jsx` — tabs: best sellers, dead stock, revenue trend
4. `ConflictResolution.jsx` — fetches conflict lot pairs, POST resolution
5. `Settings.jsx` — brand profile (PATCH /brands/:id) + user management

### F-K — Mobile layout (Phase 4-5)

- Add `MobileBottomNav.jsx` (5 tabs: Dashboard, Inventory, +Capture, Sales, Queue)
- Conditionally render Sidebar vs MobileBottomNav based on viewport width (breakpoint: 768px)
- Test all screens at 375px viewport width
- Photo capture: test camera fallback on 3 target devices

---

## 7. Recommended Development Phases

### Phase 1 — Data Foundation (Weeks 1–2)
**Goal:** Schema live, auth working, one product can be created and read back via API.

Tasks:
- [ ] Run migrations M1–M6 against local PostgreSQL
- [ ] Initialize pg-boss, register job queues
- [ ] Implement Batch A (auth), Batch B (products/lots), Batch C (storage)
- [ ] Write ConfidenceStateMachine service (all 7 states, all transitions)
- [ ] Write InventoryEvent append logic (called by state machine on every transition)
- [ ] Frontend: F-A (auth + routing), F-B (onboarding update), F-C (data hooks)
- [ ] Integration test: create a StockLot via API, verify state machine transitions

**Gate:** A user can sign up, see the dashboard (empty), and create one product with one stock lot. StockLot confidence_state transitions work correctly for all 7 states. Auth guard works.

### Phase 2 — Capture (Weeks 3–4)
**Goal:** Both onboarding paths work end-to-end. Data is persisted. No mock data anywhere.

Tasks:
- [ ] Implement Batch E (import pipeline + pg-boss job)
- [ ] Implement ImportDeduplicator (exact SKU + fuzzy name)
- [ ] Frontend: F-D (photo capture wiring — real upload)
- [ ] Frontend: F-E (import wizard wiring — real file + async job)
- [ ] Frontend: F-F (inventory list wiring — real data)
- [ ] Frontend: F-G (product detail wiring — real data, optimistic locking)
- [ ] Remove all seedData.js imports from all components
- [ ] Test: upload 100-row CSV, verify all rows imported, verify confidence_state = imported_unverified
- [ ] Test: take photo, verify StockLot created with photo_only state
- [ ] Test: add name to photo draft, verify state advances to draft_photo
- [ ] Mobile camera test on Android Chrome

**Gate:** No seedData.js imported anywhere. A no-file user can create 3 photo drafts. A has-file user can import a CSV and see the inventory. Both see an empty but real dashboard.

### Phase 3 — Intelligence (Weeks 5–6)
**Goal:** Business Confidence is live, Action Queue is computed, Business Feed is populated.

Tasks:
- [ ] Implement ConfidenceCalculator (formula, breakdown JSON, spec §16.4)
- [ ] Implement ConfidenceBackgroundJob (pg-boss, triggered on StockLot/SalesRecord writes)
- [ ] Implement ActionQueueGenerator (computed on read, idempotent, 9 task types)
- [ ] Implement BusinessFeedQuery (InventoryEvents → human-readable feed items)
- [ ] Batch F (confidence API), Batch G (action queue API), Batch H (feed API)
- [ ] Frontend: F-H (dashboard wiring — real data + BusinessConfidenceWidget + BusinessFeedWidget)
- [ ] Frontend: F-I (action queue wiring — real data, snooze, confidence delta)
- [ ] Test: verify action on 10 lots (count_verified), confidence score increases by expected amount
- [ ] Test: complete an Action Queue task, verify task disappears on next poll
- [ ] Test: add a conflict (two sources disagree), verify conflict_detected state + feed entry

**Gate:** Business Confidence shows a real score. Action Queue shows real tasks computed from data gaps. Business Feed shows real events. Completing an action updates the confidence score.

### Phase 4 — Sales + Dashboard (Weeks 7–8)
**Goal:** Full dashboard complete. Sales Intelligence working. All spec screens present.

Tasks:
- [ ] Batch I (sales records), Batch J (sales intelligence), Batch K (users)
- [ ] Frontend: F-J (all new screens: Sales, InventoryHealth, SalesIntelligence, ConflictResolution, Settings)
- [ ] Sales Intelligence labels: every insight shows data confidence level
- [ ] Dead stock query working (lots with zero sales in 90+ days)
- [ ] Conflict resolution UI: side-by-side view, winner selection, state machine call
- [ ] Sidebar: add Sales, Settings nav items; live badge on Action Queue
- [ ] Mobile layout: MobileBottomNav rendered on small viewports
- [ ] Test: record sales against specific StockLots, verify dead stock clears for that lot
- [ ] Test: resolve a conflict, verify lot returns to pre-conflict state
- [ ] Test: invite a user with Warehouse role, verify they cannot see cost prices

**Gate:** All 12 spec screens are accessible. Sales Intelligence shows real data. Dead stock detection is accurate. Conflict resolution UI works. All 4 roles have correct permissions enforced server-side.

### Phase 5 — Hardening (Weeks 9–10)
**Goal:** Production-ready. Concurrent edits safe. Failure modes handled. Mobile validated.

Tasks:
- [ ] Verify optimistic locking works (write version-conflict test)
- [ ] Test concurrent quantity edit from two browser tabs → 409 handled gracefully
- [ ] Import stuck job detection: verify 10-minute timeout shows warning
- [ ] Confidence BG job failure: verify staleness indicator appears after 1h
- [ ] Presigned URL expiry: verify failed upload shows retry, does not create orphan StockLot
- [ ] Frontend: F-K (mobile bottom nav, viewport-conditional rendering)
- [ ] Mobile camera test: iOS Safari + Android Chrome + file picker fallback
- [ ] Load test: import 5,000-row CSV, verify completes in < 60s
- [ ] Performance: dead stock query on 1,000 SKUs returns in < 500ms
- [ ] Lighthouse mobile score > 80

**Gate:** All 3 critical failure modes (stuck import, stale confidence, presigned expiry) have user-visible handling. Concurrent edit test passes. Mobile layout tested on 3 devices. Load test passes.

---

## 8. Dependencies Between Phases

```
Phase 1: Data Foundation
  ├── M1 Migrations (users, brands, brand_users)
  ├── M2 Migrations (products)
  ├── M3 Migrations (stock_lots)          ← depends on M2
  ├── M4 Migrations (inventory_events)    ← depends on M3
  ├── M5 Migrations (sales_records)       ← depends on M3
  ├── M6 Migrations (import_jobs)         ← depends on M1
  ├── ConfidenceStateMachine service      ← must exist before any StockLot writes
  ├── Auth APIs (Batch A)
  └── Product/StockLot APIs (Batch B)     ← depends on ConfidenceStateMachine

Phase 2: Capture
  ├── Storage presigned URL (Batch C)     ← depends on Phase 1 auth
  ├── Import pipeline (Batch E)           ← depends on Batch C + Batch B + pg-boss
  ├── Frontend photo capture              ← depends on Batch C
  └── Frontend import wizard             ← depends on Batch E

Phase 3: Intelligence
  ├── ConfidenceCalculator               ← depends on ConfidenceStateMachine
  ├── ConfidenceBackgroundJob            ← depends on ConfidenceCalculator + pg-boss
  ├── ActionQueueGenerator               ← depends on StockLot data (Phase 1)
  └── BusinessFeedQuery                  ← depends on InventoryEvents (Phase 1)

Phase 4: Sales + Dashboard
  ├── Sales APIs (Batch I)               ← depends on Phase 1 (stock_lots)
  ├── Sales Intelligence (Batch J)       ← depends on Batch I
  ├── Users API (Batch K)               ← depends on Phase 1 (brand_users)
  └── All new frontend screens          ← depends on Phases 1-3 APIs

Phase 5: Hardening
  └── No new features. Depends on all prior phases being complete.

CRITICAL PATH:
M1 → M2 → M3 + M4 + M5 → ConfidenceStateMachine → Batch A + B
→ Batch C → Batch E (import) / Photo capture
→ ConfidenceCalculator → ConfidenceBackgroundJob → Dashboard
→ Batch I → Batch J → SalesIntelligence
```

**Parallelization opportunities:**
- Phase 2: Photo capture frontend + Import pipeline backend can be developed in parallel (different engineers, same Batch C dependency)
- Phase 3: ConfidenceCalculator + ActionQueueGenerator can be developed in parallel
- Phase 4: Each new screen (Sales, InventoryHealth, ConflictResolution) is independent once the API exists

---

## 9. Testing Checklist

### Unit tests (must be written before any feature ships)

**ConfidenceStateMachine**
- [ ] `photo_only` → `draft_photo` on name added
- [ ] `draft_photo` → `manually_entered` on name + quantity both present
- [ ] Any state → `conflict_detected` when two sources disagree
- [ ] `conflict_detected` → pre-conflict state on resolution
- [ ] `imported_unverified` → `count_verified` on physical count
- [ ] `count_verified` → `sales_reconciled` on sale recorded
- [ ] Invalid transition (photo_only → sales_reconciled) raises error

**ConfidenceCalculator**
- [ ] All lots at `count_verified`, `exact` certainty → score ≥ 95%
- [ ] All lots at `imported_unverified` → score ≈ 50%
- [ ] 10 products with null selling_price → penalty applied correctly (-3% × 10, capped at -20%)
- [ ] 1 conflict_detected lot out of 10 → 0% weight applied + conflict penalty
- [ ] `confidence_breakdown` JSON drivers sum correctly (base + penalties = final score)
- [ ] Score clamped to [0, 100] when penalties exceed base

**ImportDeduplicator**
- [ ] Exact SKU match → update existing lot, no new lot created
- [ ] Fuzzy name match >85% → returns as "possible duplicate" for user confirmation
- [ ] Fuzzy name match <85% → treated as new product
- [ ] Two rows with same SKU in one file → second row wins (last-row-wins within import)
- [ ] Re-import of same 50-row CSV → 0 new records created, 50 updated

**OptimisticLockGuard**
- [ ] Write with version=N where DB has version=N → success, version increments to N+1
- [ ] Write with version=N where DB has version=N+1 → 409 returned, no write applied
- [ ] Concurrent writes from two clients → exactly one succeeds, one gets 409

**ActionQueueGenerator**
- [ ] Running generator twice returns same tasks (idempotent)
- [ ] `photo_only` lot → "add name" task in queue
- [ ] Product with null `selling_price` + known quantity → "add price" task
- [ ] `conflict_detected` lot → conflict task appears first (Priority 1)
- [ ] After conflict resolved → conflict task absent on next generation

**PhotoValidator**
- [ ] File > 15MB → rejected before presigned URL issued
- [ ] Non-image MIME type → rejected before presigned URL issued
- [ ] image/heic accepted
- [ ] image/gif rejected

### Integration tests (must run against real Postgres in CI)

- [ ] Full no-file onboarding: signup → photo → StockLot created with photo_only → Action Queue shows "add name" task
- [ ] Full has-file onboarding: signup → CSV upload → ImportJob created → polling returns progress → import complete → all lots at imported_unverified → confidence score ≥ 40%
- [ ] Quantity verification flow: imported_unverified lot → count event → count_verified → confidence score increases
- [ ] Conflict flow: manual entry says 100, import says 72 → conflict_detected → conflict resolution → lot returns to count_verified
- [ ] Sales flow: record sale against stock lot → quantity decremented → InventoryEvent of type `sale` created → if lot was count_verified → transitions to sales_reconciled
- [ ] Negative stock: record sale that exceeds quantity → warning generated, sale still recorded, quantity goes negative
- [ ] Stuck import detection: set import_job.updated_at to 11 minutes ago → API returns stuck flag

### E2E tests (Playwright or Cypress, run before each phase gate)

- [ ] No-file user: mobile viewport → Onboarding → Photo capture → draft appears on Dashboard → Action Queue shows "add name" task
- [ ] Has-file user: Upload CSV → column mapping → import progress → inventory list populated → confidence score shown
- [ ] Conflict detection: import CSV with conflicting quantity → conflict banner appears on ProductDetail → resolve → confidence score recovers
- [ ] Role test: login as Warehouse user → verify cost price column hidden → verify cannot access Settings
- [ ] Concurrent edit: open product in two tabs → edit quantity in tab 1 → attempt edit in tab 2 → 409 error message shown in tab 2

---

## 10. Definition of Done — Per Phase

### Phase 1: Data Foundation — Done when:

1. All migrations M1–M6 run cleanly in both `development` and `test` environments
2. pg-boss initialized, job queues registered
3. Auth: user can signup, login, and receive a valid JWT. Protected endpoints return 401 without it
4. Products API: create a product with all fields null (no error), read it back
5. StockLots API: create a StockLot, state machine transitions correctly for all 7 states
6. InventoryEvent written on every StockLot state change (verified by reading events for lot)
7. ConfidenceStateMachine unit tests all passing
8. Frontend: login screen loads, signup creates a real user, dashboard loads (empty, no errors)
9. No seedData.js imports in any component (`grep -r seedData src/` returns 0 results)
10. Optimistic locking: concurrent edit test manually verified (409 returned on version mismatch)

### Phase 2: Capture — Done when:

1. No-file path: user takes photo → StockLot created with `confidence_state = photo_only` (verified via API)
2. Photo upload: file > 15MB rejected client-side (no API call made)
3. Photo upload: HEIC accepted, GIF rejected
4. Draft promotion: add name to photo_only → `draft_photo`. Add quantity → `manually_entered`
5. Has-file path: 100-row CSV uploaded → ImportJob created → polling shows real progress → all rows imported at `imported_unverified`
6. Deduplication: re-import same CSV → 0 new records, 100 updated
7. Error rows: CSV with 5 bad rows → 95 imported, 5 in `error_rows` JSON, shown in UI
8. Stuck job: ImportJob stuck 10+ minutes → dashboard shows warning
9. Inventory list: shows real data, filters by confidence_state, no seedData
10. Product detail: loads from API, inline edits call API with version field

### Phase 3: Intelligence — Done when:

1. Business Confidence score appears on dashboard for a brand with at least 5 StockLots
2. Confidence calculator: all-verified brand scores ≥ 95%. All-unverified brand scores ≈ 50%
3. Score updates within 30 seconds of verifying a StockLot quantity
4. Staleness indicator appears when `confidence_last_computed_at` > 1 hour old
5. Confidence breakdown shows ≤ 3 positive + ≤ 3 negative drivers in plain language
6. Action Queue: 9 task types all generate correctly for appropriate data gaps
7. Action Queue: completing a task removes it; snooze hides it for 7 days
8. Business Feed: last 10 events visible, timestamps correct, confidence deltas shown
9. ConfidenceCalculator unit tests all passing (known input → known output)
10. ActionQueueGenerator idempotency test: running twice returns same task list

### Phase 4: Sales + Dashboard — Done when:

1. Sales record can be created via UI, linked to a StockLot (optional), visible in list
2. Sales Intelligence: best sellers correct (verified with known sales data)
3. Dead stock: lot with zero sales in 90+ days appears in dead stock list
4. Dead stock: confidence label shown ("Based on imported, unverified data") when lot is imported_unverified
5. Conflict resolution: two-source conflict shows side-by-side view, user selects winner, lot returns to pre-conflict state
6. All 4 user roles: Warehouse cannot see cost price (server-enforced, not just hidden in UI)
7. All 4 user roles: Finance cannot create StockLots (API returns 403)
8. Sidebar: Sales, Import, Settings nav items present and functional
9. Action Queue badge on sidebar shows live count from API (not hardcoded 5)
10. All 12 spec screens are reachable from navigation

### Phase 5: Hardening — Done when:

1. Concurrent edit: open product in two browser tabs simultaneously → second write returns 409 with clear message (no silent data loss)
2. Import stuck job: manually set updated_at to 15 minutes ago → dashboard shows warning with retry button
3. Confidence BG job failure: kill job worker mid-run → staleness indicator appears after 1 hour → job retries automatically up to 3 times
4. Presigned URL expiry: upload fails after URL generated (simulated) → draft not created → retry shown
5. Mobile camera on Android Chrome: photo taken, StockLot created (manual device test)
6. Mobile camera on iOS Safari: photo taken, StockLot created (manual device test)
7. File picker fallback: camera permission denied → file picker appears automatically (no error shown)
8. 5,000-row CSV import completes in < 60 seconds (measured)
9. Dead stock query on 1,000 products returns in < 500ms (measured with EXPLAIN ANALYZE)
10. Lighthouse mobile performance score ≥ 80 on Dashboard screen
