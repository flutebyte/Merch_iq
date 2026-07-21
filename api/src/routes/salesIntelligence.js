const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Simple 1-hour cache per brand
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}
function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// GET /sales-intelligence/best-sellers?period=30d
router.get('/best-sellers', async (req, res, next) => {
  try {
    const period = req.query.period === '90d' ? 90 : 30;
    const cacheKey = `best-sellers-${req.brandId}-${period}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const salesRecords = await prisma.salesRecord.findMany({
      where: { brandId: req.brandId, date: { gte: since } },
      select: { productId: true, quantity: true, price: true },
    });

    // Aggregate per product: revenue = sum(price * quantity) per record
    const byProduct = new Map();
    for (const s of salesRecords) {
      const cur = byProduct.get(s.productId) || { totalUnits: 0, totalRevenue: 0 };
      cur.totalUnits += s.quantity || 0;
      cur.totalRevenue += s.price ? parseFloat(s.price) * (s.quantity || 0) : 0;
      byProduct.set(s.productId, cur);
    }

    const sorted = [...byProduct.entries()]
      .sort((a, b) => b[1].totalUnits - a[1].totalUnits)
      .slice(0, 20);

    const productIds = sorted.map(([id]) => id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, category: true, sellingPrice: true },
    });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const result = sorted.map(([productId, agg]) => ({
      productId,
      productName: productMap[productId]?.name || 'Unnamed product',
      product: productMap[productId] || null,
      totalUnits: agg.totalUnits,
      totalRevenue: +agg.totalRevenue.toFixed(2),
    }));

    const response = {
      period: `${period}d`,
      items: result,
      confidenceNote: 'Based on recorded sales only',
    };
    setCached(cacheKey, response);
    res.json(response);
  } catch (err) { next(err); }
});

// GET /sales-intelligence/dead-stock?threshold_days=90
router.get('/dead-stock', async (req, res, next) => {
  try {
    const thresholdDays = parseInt(req.query.threshold_days, 10) || 90;
    const cacheKey = `dead-stock-${req.brandId}-${thresholdDays}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const since = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

    // Get product IDs with recent sales
    const recentSales = await prisma.salesRecord.findMany({
      where: { brandId: req.brandId, date: { gte: since } },
      select: { productId: true },
    });
    const recentlySoldIds = new Set(recentSales.map(s => s.productId));

    // Get main_stock lots with quantity > 0 or known quantity
    const lots = await prisma.stockLot.findMany({
      where: {
        brandId: req.brandId,
        inventoryStatus: 'main_stock',
        quantityCertainty: { not: 'unknown' },
        quantity: { gt: 0 },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, sellingPrice: true } },
      },
    });

    const deadLotProductIds = lots.filter(l => !recentlySoldIds.has(l.productId)).map(l => l.productId);

    // Get last sale date per dead-stock product (may have been sold once, just not recently)
    const lastSaleRows = await prisma.salesRecord.groupBy({
      by: ['productId'],
      where: { brandId: req.brandId, productId: { in: deadLotProductIds } },
      _max: { date: true },
    });
    const lastSaleMap = new Map(lastSaleRows.map(r => [r.productId, r._max.date]));

    const deadItems = [];
    let missingPriceCount = 0;
    let totalValue = 0;

    for (const lot of lots) {
      if (recentlySoldIds.has(lot.productId)) continue;

      const qty = lot.quantity || 0;
      const price = lot.product?.sellingPrice ? parseFloat(lot.product.sellingPrice) : null;
      const value = price != null ? qty * price : null;
      if (value != null) totalValue += value;
      if (price == null) missingPriceCount++;

      const lastSaleDate = lastSaleMap.get(lot.productId);
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / 86400000)
        : null;

      deadItems.push({
        lotId: lot.id,
        productId: lot.productId,
        productName: lot.product?.name || 'Unnamed product',
        product: lot.product,
        quantity: qty,
        stuckValue: value,
        estimatedValue: value,
        daysSinceLastSale,
        confidenceState: lot.confidenceState,
        confidenceNote: lot.confidenceState === 'imported_unverified'
          ? 'Medium confidence — quantities not yet verified'
          : lot.confidenceState === 'count_verified'
          ? 'High confidence — quantity verified'
          : 'Based on available data',
      });
    }

    // Sort by value desc, then by product name
    deadItems.sort((a, b) => (b.estimatedValue ?? -1) - (a.estimatedValue ?? -1));

    const response = {
      thresholdDays,
      totalValue: +totalValue.toFixed(2),
      missingPriceCount,
      items: deadItems,
      summary: `${deadItems.length} products with no sales in ${thresholdDays}+ days`,
    };
    setCached(cacheKey, response);
    res.json(response);
  } catch (err) { next(err); }
});

// GET /sales-intelligence/low-stock?threshold=5
router.get('/low-stock', async (req, res, next) => {
  try {
    const threshold = Math.max(1, parseInt(req.query.threshold, 10) || 5);
    const cacheKey = `low-stock-${req.brandId}-${threshold}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const products = await prisma.product.findMany({
      where: { brandId: req.brandId },
      select: {
        id: true, name: true, sku: true, category: true, sellingPrice: true,
        stockLots: {
          where: { inventoryStatus: 'main_stock', quantityCertainty: { not: 'unknown' } },
          select: { quantity: true, confidenceState: true },
        },
      },
      take: 200,
    });

    const items = [];
    for (const p of products) {
      const totalQty = p.stockLots.reduce((sum, l) => sum + (l.quantity || 0), 0);
      if (p.stockLots.length > 0 && totalQty < threshold) {
        items.push({
          productId: p.id,
          productName: p.name || 'Unnamed product',
          sku: p.sku,
          category: p.category,
          quantity: totalQty,
          sellingPrice: p.sellingPrice ? parseFloat(p.sellingPrice) : null,
        });
      }
    }

    items.sort((a, b) => a.quantity - b.quantity);

    const response = { threshold, items, summary: `${items.length} products with fewer than ${threshold} units` };
    setCached(cacheKey, response);
    res.json(response);
  } catch (err) { next(err); }
});

// GET /sales-intelligence/revenue-trend?weeks=12
router.get('/revenue-trend', async (req, res, next) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks, 10) || 12, 52);
    const cacheKey = `revenue-trend-${req.brandId}-${weeks}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

    const sales = await prisma.salesRecord.findMany({
      where: { brandId: req.brandId, date: { gte: since } },
      select: { date: true, quantity: true, price: true },
      orderBy: { date: 'asc' },
    });

    // Group by week (ISO week number)
    const weekMap = new Map();
    for (const s of sales) {
      const d = new Date(s.date);
      // Get Monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().split('T')[0];

      const entry = weekMap.get(key) || { weekStart: key, revenue: 0, units: 0 };
      entry.revenue += s.price ? parseFloat(s.price) * s.quantity : 0;
      entry.units += s.quantity;
      weekMap.set(key, entry);
    }

    // Fill in missing weeks with 0
    const result = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const monday = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().split('T')[0];
      result.push(weekMap.get(key) || { weekStart: key, revenue: 0, units: 0 });
    }

    const response = { weeks, data: result };
    setCached(cacheKey, response);
    res.json(response);
  } catch (err) { next(err); }
});

// GET /sales-intelligence/channel-analytics?period=90d
router.get('/channel-analytics', async (req, res, next) => {
  try {
    const period = Math.min(parseInt(req.query.period, 10) || 90, 365);
    const cacheKey = `channel-analytics-${req.brandId}-${period}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const records = await prisma.salesRecord.findMany({
      where: { brandId: req.brandId, date: { gte: since } },
      select: { channel: true, quantity: true, price: true, date: true },
    });

    // Aggregate per channel
    const byChannel = new Map();
    for (const r of records) {
      const ch = r.channel || 'direct';
      const cur = byChannel.get(ch) || { channel: ch, units: 0, revenue: 0, txCount: 0 };
      cur.units    += r.quantity || 0;
      cur.revenue  += r.price ? parseFloat(r.price) * (r.quantity || 0) : 0;
      cur.txCount  += 1;
      byChannel.set(ch, cur);
    }

    const channels = [...byChannel.values()].sort((a, b) => b.units - a.units);
    const totalUnits   = channels.reduce((s, c) => s + c.units, 0);
    const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);

    channels.forEach(c => {
      c.unitShare    = totalUnits   > 0 ? +(c.units   / totalUnits   * 100).toFixed(1) : 0;
      c.revenueShare = totalRevenue > 0 ? +(c.revenue / totalRevenue * 100).toFixed(1) : 0;
      c.revenue      = +c.revenue.toFixed(2);
      c.avgOrderSize = c.txCount > 0 ? +(c.units / c.txCount).toFixed(1) : 0;
    });

    // Herfindahl-Hirschman Index: HHI = sum((share/100)^2)
    // HHI < 0.15 = diverse  |  0.15-0.5 = moderate  |  > 0.5 = concentrated
    const hhi = channels.reduce((s, c) => s + Math.pow(c.unitShare / 100, 2), 0);
    const concentration = hhi > 0.5 ? 'high' : hhi > 0.15 ? 'moderate' : 'diverse';

    // Recommendations based on channel data
    const recommendations = [];
    if (channels.length === 0) {
      recommendations.push({ type: 'start_selling', priority: 'high', message: 'No sales recorded yet. Start by recording a sale to track channel performance.' });
    } else if (channels.length === 1) {
      recommendations.push({ type: 'single_channel_risk', priority: 'high', message: `All sales are through ${channels[0].channel}. Adding a second channel reduces revenue risk significantly.` });
    } else {
      const dominant = channels[0];
      if (dominant.unitShare > 70) {
        recommendations.push({ type: 'channel_concentration', priority: 'medium', message: `${dominant.channel} drives ${dominant.unitShare}% of sales. Over-dependence on one channel creates risk if that channel changes fees or policies.` });
      }
      const growing = channels.filter(c => c.txCount >= 3 && c.unitShare < dominant.unitShare * 0.5);
      if (growing.length > 0) {
        recommendations.push({ type: 'growth_opportunity', priority: 'medium', message: `${growing[0].channel} is an active but underutilized channel (${growing[0].unitShare}% share). Increasing focus here could diversify risk.` });
      }
      const highRevPerUnit = channels.sort((a, b) => (b.revenue / Math.max(b.units, 1)) - (a.revenue / Math.max(a.units, 1)))[0];
      const highVolume = channels.sort((a, b) => b.units - a.units)[0];
      if (highRevPerUnit.channel !== highVolume.channel) {
        recommendations.push({ type: 'revenue_optimization', priority: 'low', message: `${highRevPerUnit.channel} has the highest revenue per unit (₹${(highRevPerUnit.revenue / Math.max(highRevPerUnit.units, 1)).toFixed(0)}/unit). Consider shifting higher-margin products to this channel.` });
      }
    }

    const response = {
      period: `${period}d`,
      totalUnits, totalRevenue: +totalRevenue.toFixed(2),
      channelCount: channels.length,
      concentration, hhi: +hhi.toFixed(3),
      channels: channels.sort((a, b) => b.units - a.units),
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    setCached(cacheKey, response);
    res.json(response);
  } catch (err) { next(err); }
});

module.exports = router;
