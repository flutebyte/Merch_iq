# Adaptive Inventory BI — Build Log

## Phase 2 — Capture

### Backend

- [x] POST /storage/presigned-upload — already exists in storage.js (returns mock in dev mode)
- [x] GET /inventory-events — add new route
- [x] Wire InventoryEventWriter to StockLot state changes — already wired in stockLots.js
- [x] POST /import-jobs — create new route
- [x] GET /import-jobs/:id/status — add to import-jobs route
- [x] Import processor background job — implemented in services/importProcessor.js

### Frontend

- [x] index.css — full design system replacement (light mode, Inter font, indigo accent)
- [x] ImportWizard — real CSV/XLSX parsing with PapaParse, column mapping, POST to API
- [x] PhotoCapture — client-side validation, improved UX with capture count
- [x] Inventory — confidence_state filter, real badges
- [x] ProductDetail — load from API, stock lots list, inline edit with version field

## Phase 3 — Intelligence

### Backend

- [x] ConfidenceCalculator service — formula from spec §16.4
- [x] ConfidenceBackgroundJob — pg-boss worker
- [x] ActionQueueGenerator — 9 task types, idempotent
- [x] GET /action-queue — computed tasks
- [x] GET /brands/:id/confidence — score + breakdown
- [x] BusinessFeedQuery — last 20 events as human-readable feed
- [x] GET /business-feed — formatted feed

### Frontend

- [x] Dashboard — real confidence score, BusinessFeed widget, action queue count
- [x] ActionCenter — wire to GET /action-queue, confidence delta, snooze

## Phase 4 — Sales + New Screens

### Backend

- [x] GET/POST /sales-records
- [x] GET /sales-intelligence/best-sellers
- [x] GET /sales-intelligence/dead-stock
- [x] GET /sales-intelligence/revenue-trend

### Frontend

- [x] SalesScreen — list + add sale form
- [x] SalesIntelligence — best sellers, dead stock, revenue chart
- [x] Sidebar — updated nav items
- [x] MainApp — Sales and SalesIntelligence screens wired

## Phase 5 — Hardening

- [x] Optimistic locking — already in stockLots.js
- [x] Error states and retry UI
- [x] Mobile bottom nav — MobileBottomNav component
- [x] Final pass — no seedData imports

## Phase 6 — Dark Theme + Product Update Bug Fix

### Product Q&A
- Integration architecture decision: event-sourced model supports all future integrations
- Roadmap: Shopify/WhatsApp (Phase 2), Amazon/Flipkart (Phase 3), POS/ERP (Phase 4)
- Data model decisions: channel on SalesRecord (already present), externalIds pending migration

### Fixes
- [x] index.css — full dark theme (deep #090911 bg, surface layers, adjusted semantic colors)
- [x] index.html — add JetBrains Mono font
- [x] Dashboard.jsx — METRIC_CARD_THEMES now use CSS variables (dark-safe transparent overlays)
- [x] ProductDetail.jsx — CRITICAL: Save button now calls PATCH /products/:id or PATCH /stock-lots/:id
  - Root cause was onClick={() => setEditing(null)} with no API call
  - localMissing state updates immediately on successful save (badge disappears)
  - Keyboard: Enter to save, Escape to cancel
  - Error banner shown on save failure
- [x] products.js — PATCH handler now invalidates action queue cache + triggers confidence update
- [x] products.js — GET list now computes daysUnmoved per product (groupBy lastSaleDate)
- [x] Login.jsx / Signup.jsx — updated gradient rgba to match new accent color
- [x] SalesIntelligence.jsx — fixed hardcoded warning border color
- [x] SalesScreen.jsx — modal backdrop updated for dark mode (rgba(0,0,0,0.72))
- [x] MobileBottomNav.jsx — shadow updated for dark mode

## Phase 7 — Inventory Accuracy + Direct Product Navigation

- [x] Inventory.jsx — fixed isDeadStock always being false (now uses same logic as Dashboard)
- [x] Inventory.jsx — daysUnmoved now passed from API through mapProduct
- [x] MainApp.jsx — added handleNavigateToProduct: fetches product by ID and navigates to ProductDetail
- [x] ActionCenter.jsx — "Go to product" now navigates directly to ProductDetail (not just inventory list)
- [x] ActionCenter.jsx — unified edit_product/view_product/count_entry all use onSelectProduct

## Phase 10 — Bug Fixes, Image Thumbnails, Live Action Count, Settings Page

### Bugs Fixed
- [x] ProductDetail `editing` state init was `null`, which matched fields with `key: null` (Category, Days Unmoved) — both showed the same shared input. Fixed: init to `''` so `'' !== null` for non-editable fields
- [x] Action Center sidebar badge count only updated on page refresh — added `window.dispatchEvent(new CustomEvent('inv:mutation'))` from ProductDetail.handleSave and ActionCenter.handleResolveConflict; Sidebar listens via `useEffect` with a stable `useRef` pattern
- [x] Inventory table: product images missing — added 34×34 thumbnail in Product column; CSS background-image from `product.images[0]`; letter-avatar fallback when no image
- [x] Theme toggle removed from Sidebar footer — moved to Settings > Appearance

### New Features
- [x] Settings page (Settings.jsx) — full production-grade settings with 8 sections:
  - **Appearance**: Light/Dark/System theme picker (functional, persisted to localStorage)
  - **Notifications**: Email and in-app toggles, low-stock threshold, dead-stock alert (localStorage)
  - **Account**: Brand name (PATCH /brands/:id), business type, city, phone (localStorage); email read-only
  - **Security**: Password change (POST /auth/change-password — new endpoint); active sessions display; show/hide password inputs
  - **Preferences**: Currency, date format, inventory view mode (localStorage)
  - **Data & Export**: Export products as CSV (live download); clear preferences; account deletion request
  - **Integrations**: Placeholder cards for WhatsApp, Shopify, Amazon, Flipkart, Meesho, POS, Tally/ERP
  - **System**: App version, environment badge, full local reset
- [x] auth.js — added `POST /auth/change-password` endpoint (bcrypt verify + update)
- [x] Sidebar — added Settings nav item in footer; removed theme toggle; mutation listener for live badge count

## Phase 9 — Revenue Bug Fix + Sales Intelligence Data + Theme System

### Bugs Fixed
- [x] RevenueTrendTab crash: `weeks.map is not a function` — API returns `{ weeks: 12, data: [...] }`, frontend was reading `data.weeks` (the number 12) instead of `data.data` (the array). Fixed: `const weeks = data?.data || []`
- [x] BestSellers field mismatch: API returned `totalQuantity` / `product.name`, frontend expected `totalUnits` / `productName`
  - Rewrote best-sellers endpoint: now uses `findMany` instead of `groupBy` for correct revenue calculation (`sum(price × quantity)` per record)
  - Added `productName` field, renamed `totalQuantity` → `totalUnits`
- [x] DeadStock field mismatch: API returned `estimatedValue` / `product.name`, no `daysSinceLastSale`; frontend expected `stuckValue` / `productName` / `daysSinceLastSale`
  - Added `productName`, `stuckValue` (alias for `estimatedValue`)
  - Added `daysSinceLastSale` computation via `salesRecord.groupBy` with `_max.date` for dead-stock products

### Theme System
- [x] index.css — added `[data-theme="light"]` override block with complete light palette
- [x] index.css — added `@media (prefers-color-scheme: light)` for system theme auto-detection
- [x] index.css — fixed scrollbar hover to use `var(--border2)` with `filter: brightness(0.85)` (was hardcoded dark purple)
- [x] index.html — added inline no-flicker theme script (runs before React mounts, reads `inv_theme` from localStorage)
- [x] useTheme.js — new hook: reads/writes `inv_theme` in localStorage, applies `data-theme` attribute to `<html>`
- [x] Sidebar.jsx — added Sun/Moon/Monitor theme toggle in user footer area

### Missing Price Bug — Verification
Full chain verified correct:
1. ProductDetail.handleSave('price') → `patch('/products/:id', { sellingPrice })` ✓
2. products.js PATCH → `prisma.product.update(...)` → `invalidateCache(req.brandId)` ✓
3. Next `/action-queue` fetch → `_computeTasks` reloads fresh product.sellingPrice from DB → no "Add price" task ✓
4. Dashboard remounts → `useFetch('/products')` refetches → fresh data without missing-price indicator ✓

## Phase 8 — ActionCenter Completeness

- [x] ActionCenter.jsx — resolve_conflict action: calls PATCH /stock-lots/:id with trigger=conflict_resolved, then dismisses and refetches
- [x] ActionCenter.jsx — edit_draft action now navigates to product via onSelectProduct
- [x] ActionCenter.jsx — resolving state tracked per task to show loading spinner
- [x] ActionCenter.jsx — conflict tasks get "Resolve conflict" + "View product" buttons; no snooze (conflicts should not be deferred)
- [x] ActionCenter.jsx — useApiRequest now includes patch method for conflict resolution
