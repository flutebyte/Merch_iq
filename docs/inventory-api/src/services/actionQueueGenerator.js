/**
 * ActionQueueGenerator — computes the action queue from current data state.
 *
 * Idempotent: running twice returns the same tasks.
 * Computed on read (not stored). 5-minute cache per brand.
 *
 * Task types and priorities from spec §10:
 *   P1 — Resolve conflict (conflict_detected lots)
 *   P2 — Add price (null selling_price + known quantity)
 *   P3 — Verify quantity (approximate / imported_unverified)
 *   P4 — Enrichment gaps (missing category, size, photo)
 *   P5 — Draft completion (photo_only, draft_photo missing name/qty)
 */

const prisma = require('../db');

// Simple in-memory cache: { brandId: { tasks, expiresAt } }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Snooze storage: { taskId: snoozedUntil }
const snoozeStore = new Map();

function isSnoozeActive(taskId) {
  const until = snoozeStore.get(taskId);
  if (!until) return false;
  if (Date.now() > until) { snoozeStore.delete(taskId); return false; }
  return true;
}

function snoozeTask(taskId, days = 7) {
  snoozeStore.set(taskId, Date.now() + days * 24 * 60 * 60 * 1000);
}

async function generateActionQueue(brandId) {
  // Check cache
  const cached = cache.get(brandId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tasks.filter(t => !isSnoozeActive(t.id));
  }

  const tasks = await _computeTasks(brandId);
  cache.set(brandId, { tasks, expiresAt: Date.now() + CACHE_TTL_MS });
  return tasks.filter(t => !isSnoozeActive(t.id));
}

function invalidateCache(brandId) {
  cache.delete(brandId);
}

async function _computeTasks(brandId) {
  const tasks = [];

  // Load all lots with their products
  const lots = await prisma.stockLot.findMany({
    where: { brandId },
    include: {
      product: { select: { id: true, name: true, sku: true, sellingPrice: true, category: true, size: true, images: true } },
    },
  });

  // Load sales for dead stock detection
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentlySoldProductIds = new Set(
    (await prisma.salesRecord.findMany({
      where: { brandId, date: { gte: ninetyDaysAgo } },
      select: { productId: true },
    })).map(s => s.productId)
  );

  for (const lot of lots) {
    const p = lot.product;

    // P1 — Resolve conflict
    if (lot.confidenceState === 'conflict_detected') {
      const taskId = `conflict-${lot.id}`;
      tasks.push({
        id: taskId,
        priority: 1,
        type: 'resolve_conflict',
        label: `Resolve conflict: ${p.name || 'Unnamed product'}`,
        productId: p.id,
        productName: p.name || 'Unnamed product',
        stockLotId: lot.id,
        confidenceDelta: '+3–5%',
        action: 'resolve_conflict',
      });
      continue; // Don't generate other tasks for conflicted lots
    }

    // P2 — Add price
    if (!p.sellingPrice && lot.quantity != null) {
      const taskId = `price-${p.id}`;
      if (!tasks.find(t => t.id === taskId)) {
        tasks.push({
          id: taskId,
          priority: 2,
          type: 'add_price',
          label: `Add price to ${p.name || 'Unnamed product'}`,
          productId: p.id,
          productName: p.name || 'Unnamed product',
          stockLotId: lot.id,
          confidenceDelta: '+1–3%',
          action: 'edit_product',
        });
      }
    }

    // P3 — Verify quantity
    if (lot.quantityCertainty === 'approximate' || lot.confidenceState === 'imported_unverified') {
      const taskId = `verify-qty-${lot.id}`;
      tasks.push({
        id: taskId,
        priority: 3,
        type: 'verify_quantity',
        label: `Verify quantity for ${p.name || 'Unnamed product'}${lot.quantity != null ? ` (currently ~${lot.quantity} units)` : ''}`,
        productId: p.id,
        productName: p.name || 'Unnamed product',
        stockLotId: lot.id,
        confidenceDelta: '+0.5–2%',
        action: 'count_entry',
      });
    }

    // P4 — Enrichment gaps (only for lots that are at least manually_entered)
    const isEnrichable = ['manually_entered', 'count_verified', 'sales_reconciled', 'imported_unverified'].includes(lot.confidenceState);
    if (isEnrichable) {
      if (!p.category) {
        const taskId = `category-${p.id}`;
        if (!tasks.find(t => t.id === taskId)) {
          tasks.push({
            id: taskId,
            priority: 4,
            type: 'add_category',
            label: `Add category to ${p.name || 'Unnamed product'}`,
            productId: p.id,
            productName: p.name || 'Unnamed product',
            stockLotId: lot.id,
            confidenceDelta: '+0.2%',
            action: 'edit_product',
          });
        }
      }

      if ((!p.images || p.images.length === 0) && !lot.photos?.length) {
        const taskId = `photo-${p.id}`;
        if (!tasks.find(t => t.id === taskId)) {
          tasks.push({
            id: taskId,
            priority: 4,
            type: 'add_photo',
            label: `Add photo for ${p.name || 'Unnamed product'}`,
            productId: p.id,
            productName: p.name || 'Unnamed product',
            stockLotId: lot.id,
            confidenceDelta: '+0.2%',
            action: 'photo_capture',
          });
        }
      }
    }

    // P5 — Draft completion
    if (lot.confidenceState === 'photo_only') {
      const taskId = `name-${lot.id}`;
      tasks.push({
        id: taskId,
        priority: 5,
        type: 'add_name',
        label: 'Add name to photo item',
        productId: p.id,
        productName: 'Unnamed photo',
        stockLotId: lot.id,
        confidenceDelta: '+0.1%',
        action: 'edit_draft',
      });
    }

    if (lot.confidenceState === 'draft_photo' && lot.quantity == null) {
      const taskId = `qty-${lot.id}`;
      tasks.push({
        id: taskId,
        priority: 5,
        type: 'add_quantity',
        label: `Add quantity to ${p.name || 'draft item'}`,
        productId: p.id,
        productName: p.name || 'Draft item',
        stockLotId: lot.id,
        confidenceDelta: '+0.1%',
        action: 'count_entry',
      });
    }

    // P4 — Dead stock review
    if (
      lot.inventoryStatus === 'main_stock' &&
      (lot.quantity > 0 || lot.quantityCertainty !== 'unknown') &&
      !recentlySoldProductIds.has(p.id)
    ) {
      const taskId = `deadstock-${lot.id}`;
      tasks.push({
        id: taskId,
        priority: 4,
        type: 'review_dead_stock',
        label: `Review dead stock: ${p.name || 'Unnamed product'} (no sales in 90+ days)`,
        productId: p.id,
        productName: p.name || 'Unnamed product',
        stockLotId: lot.id,
        confidenceDelta: '0%',
        action: 'view_product',
      });
    }
  }

  // Sort by priority, then by product name
  tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.productName || '').localeCompare(b.productName || '');
  });

  return tasks;
}

module.exports = { generateActionQueue, invalidateCache, snoozeTask };
