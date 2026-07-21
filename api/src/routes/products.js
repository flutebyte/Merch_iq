const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { invalidateCache } = require('../services/actionQueueGenerator');
const { isNonNegativeNumber } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

const RECOVERY_ACTIONS = ['discount', 'bundle', 'relist', 'wholesale', 'liquidate'];

router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const where = { brandId: req.brandId };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [products, lastSales] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          stockLots: {
            select: { id: true, quantity: true, quantityCertainty: true, confidenceState: true, inventoryStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesRecord.groupBy({
        by: ['productId'],
        where: { brandId: req.brandId },
        _max: { date: true },
      }),
    ]);

    const lastSaleMap = new Map(lastSales.map(s => [s.productId, s._max.date]));
    const now = Date.now();
    const enriched = products.map(p => ({
      ...p,
      daysUnmoved: lastSaleMap.has(p.id)
        ? Math.floor((now - new Date(lastSaleMap.get(p.id)).getTime()) / 86400000)
        : null,
    }));

    res.json(enriched);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { sku, name, category, color, size, costPrice, sellingPrice, tags, images, forceCreate } = req.body;

    if (!isNonNegativeNumber(costPrice) || !isNonNegativeNumber(sellingPrice)) {
      return res.status(400).json({ error: 'Cost price and selling price must be zero or greater.' });
    }

    // ── Duplicate detection ───────────────────────────────────────────────────
    // Primary: SKU match (SKU must be unique per brand)
    if (!forceCreate && sku && sku.trim()) {
      const skuMatch = await prisma.product.findFirst({
        where: { brandId: req.brandId, sku: { equals: sku.trim(), mode: 'insensitive' } },
        select: { id: true, name: true, sku: true, category: true, sellingPrice: true },
      });
      if (skuMatch) {
        return res.status(409).json({
          error: 'sku_conflict',
          message: `A product with SKU "${sku}" already exists.`,
          existingProduct: skuMatch,
        });
      }
    }

    if (!forceCreate && name && name.trim()) {
      const nameMatch = await prisma.product.findFirst({
        where: { brandId: req.brandId, name: { equals: name.trim(), mode: 'insensitive' } },
        select: { id: true, name: true, sku: true, category: true, color: true, size: true },
      });
      if (nameMatch) {
        return res.status(409).json({
          error: 'duplicate_name',
          message: `A product named "${name.trim()}" already exists. Do you want to merge with the existing product or keep them separate?`,
          existingProduct: nameMatch,
        });
      }
    }

    // Secondary: name + size + color (all three must be present and match)
    if (!forceCreate && name && name.trim() && size && color) {
      const attrMatch = await prisma.product.findFirst({
        where: {
          brandId: req.brandId,
          name: { equals: name.trim(), mode: 'insensitive' },
          size,
          color,
        },
        select: { id: true, name: true, sku: true, size: true, color: true },
      });
      if (attrMatch) {
        return res.status(409).json({
          error: 'duplicate_detected',
          message: `A product "${name.trim()}" (${size}, ${color}) already exists.`,
          existingProduct: attrMatch,
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        brandId: req.brandId,
        sku: sku ?? null,
        name: name ?? null,
        category: category ?? null,
        color: color ?? null,
        size: size ?? null,
        costPrice: costPrice ?? null,
        sellingPrice: sellingPrice ?? null,
        tags: tags || [],
        images: images || [],
      },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
      include: {
        stockLots: {
          include: {
            inventoryEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        },
      },
    });
    if (!product) return res.status(404).json({ error: 'not found' });
    res.json(product);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, brandId: req.brandId } });
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { sku, name, category, color, size, costPrice, sellingPrice, tags, images, recoveryAction } = req.body;

    if (recoveryAction !== undefined && recoveryAction !== null && !RECOVERY_ACTIONS.includes(recoveryAction)) {
      return res.status(400).json({ error: 'invalid_recovery_action', message: `recoveryAction must be one of: ${RECOVERY_ACTIONS.join(', ')}` });
    }

    if (!isNonNegativeNumber(costPrice) || !isNonNegativeNumber(sellingPrice)) {
      return res.status(400).json({ error: 'Cost price and selling price must be zero or greater.' });
    }

    if (sku && sku.trim() && sku.trim().toLowerCase() !== (existing.sku || '').toLowerCase()) {
      const skuMatch = await prisma.product.findFirst({
        where: { brandId: req.brandId, sku: { equals: sku.trim(), mode: 'insensitive' }, id: { not: existing.id } },
        select: { id: true, name: true, sku: true },
      });
      if (skuMatch) {
        return res.status(409).json({
          error: 'sku_conflict',
          message: `A product with SKU "${sku.trim()}" already exists.`,
          existingProduct: skuMatch,
        });
      }
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        sku:          sku          !== undefined ? sku          : existing.sku,
        name:         name         !== undefined ? name         : existing.name,
        category:     category     !== undefined ? category     : existing.category,
        color:        color        !== undefined ? color        : existing.color,
        size:         size         !== undefined ? size         : existing.size,
        costPrice:    costPrice    !== undefined ? costPrice    : existing.costPrice,
        sellingPrice: sellingPrice !== undefined ? sellingPrice : existing.sellingPrice,
        tags:         tags         !== undefined ? tags         : existing.tags,
        images:       images       !== undefined ? images       : existing.images,
        recoveryAction:   recoveryAction !== undefined ? recoveryAction : existing.recoveryAction,
        recoveryActionAt: recoveryAction !== undefined ? (recoveryAction ? new Date() : null) : existing.recoveryActionAt,
      },
    });

    invalidateCache(req.brandId);
    try {
      const { getQueue } = require('../services/jobQueue');
      const boss = getQueue();
      await boss.send('confidence-score-update', { brandId: req.brandId }, { singletonKey: `confidence-${req.brandId}` });
    } catch (_) {}

    res.json(updated);
  } catch (err) { next(err); }
});

// SKUs seen in imported orders that have no matching Product record
router.get('/unrecognized-skus', async (req, res, next) => {
  try {
    const brandId = req.brandId;

    const [orders, existingProducts] = await Promise.all([
      prisma.platformOrder.findMany({
        where: { brandId },
        select: { items: true, platform: true, orderDate: true },
      }),
      prisma.product.findMany({
        where: { brandId },
        select: { sku: true },
      }),
    ]);

    const existingSkus = new Set(existingProducts.map(p => p.sku).filter(Boolean));

    const skuMap = {};
    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (!item.sku) continue;
        if (!skuMap[item.sku]) {
          skuMap[item.sku] = { sku: item.sku, name: item.name || null, unitsSold: 0, lastSeen: null, platform: order.platform };
        }
        skuMap[item.sku].unitsSold += (item.qty || 1);
        if (!skuMap[item.sku].lastSeen || order.orderDate > skuMap[item.sku].lastSeen) {
          skuMap[item.sku].lastSeen = order.orderDate;
          if (item.name) skuMap[item.sku].name = item.name;
        }
      }
    }

    const unrecognized = Object.values(skuMap)
      .filter(s => !existingSkus.has(s.sku))
      .sort((a, b) => b.unitsSold - a.unitsSold);

    res.json({ unrecognized, total: unrecognized.length });
  } catch (err) { next(err); }
});

// Bulk-create products from unrecognized SKUs
router.post('/bulk-from-skus', async (req, res, next) => {
  try {
    const brandId = req.brandId;
    const skus = Array.isArray(req.body.skus) ? req.body.skus : [];

    let created = 0;
    for (const { sku, name } of skus) {
      if (!sku) continue;
      const exists = await prisma.product.findFirst({ where: { brandId, sku } });
      if (!exists) {
        await prisma.product.create({
          data: { brandId, sku, name: name || sku, category: 'Uncategorized' },
        });
        created++;
      }
    }

    if (created > 0) invalidateCache(brandId);
    res.json({ created });
  } catch (err) { next(err); }
});

module.exports = router;
