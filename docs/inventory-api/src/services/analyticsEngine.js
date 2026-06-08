const { PrismaClient } = require('@prisma/client');
const cache = require('../utils/cacheUtil');

const prisma = new PrismaClient();

// Metric name constants — never use freeform strings
const METRICS = {
  ORDERS: 'orders',
  REVENUE: 'revenue',
  RETURNS: 'returns',
  CANCELLATIONS: 'cancellations',
  NET_REVENUE: 'net_revenue',
  RETURN_RATE: 'return_rate',
};

// Festival seasonality weights for India (month index → weight multiplier)
// Higher = more demand expected; used in forecast smoothing
const FESTIVAL_WEIGHTS = {
  9:  1.4, // October — Navratri, Dussehra
  10: 1.6, // November — Diwali
  11: 1.2, // December — Christmas, year-end
  0:  1.1, // January — Republic Day, winter clearance
  2:  1.2, // March — Holi
  7:  1.1, // August — Independence Day, Raksha Bandhan
};

function periodStart(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}

// ── Revenue Analytics ─────────────────────────────────────────────────────────

async function revenueAnalytics(brandId, days = 30) {
  const cacheKey = `analytics:revenue:${brandId}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const since = periodStart(days);
  const prevSince = periodStart(days * 2);

  const [current, previous] = await Promise.all([
    prisma.platformOrder.findMany({
      where: { brandId, orderDate: { gte: since }, status: { notIn: ['cancelled', 'returned', 'refunded'] } },
      select: { platform: true, grossAmount: true, netRevenue: true, orderDate: true },
    }),
    prisma.platformOrder.findMany({
      where: { brandId, orderDate: { gte: prevSince, lt: since }, status: { notIn: ['cancelled', 'returned', 'refunded'] } },
      select: { grossAmount: true },
    }),
  ]);

  const totalRevenue = current.reduce((s, o) => s + Number(o.grossAmount), 0);
  const prevRevenue = previous.reduce((s, o) => s + Number(o.grossAmount), 0);
  const totalNetRevenue = current.reduce((s, o) => s + (o.netRevenue ? Number(o.netRevenue) : Number(o.grossAmount)), 0);

  const byPlatform = {};
  for (const o of current) {
    if (!byPlatform[o.platform]) byPlatform[o.platform] = { revenue: 0, orders: 0, netRevenue: 0 };
    byPlatform[o.platform].revenue += Number(o.grossAmount);
    byPlatform[o.platform].netRevenue += o.netRevenue ? Number(o.netRevenue) : Number(o.grossAmount);
    byPlatform[o.platform].orders++;
  }

  const platforms = Object.entries(byPlatform).map(([platform, v]) => ({
    platform,
    revenue: Math.round(v.revenue),
    netRevenue: Math.round(v.netRevenue),
    orders: v.orders,
    share: Math.round(safeDivide(v.revenue, totalRevenue) * 100),
  })).sort((a, b) => b.revenue - a.revenue);

  // Daily trend for sparkline
  const dailyMap = {};
  for (const o of current) {
    const day = o.orderDate.toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(o.grossAmount);
  }
  const trend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }));

  const momGrowth = prevRevenue === 0 ? null
    : Math.round((totalRevenue - prevRevenue) / prevRevenue * 100);

  const result = {
    totalRevenue: Math.round(totalRevenue),
    totalNetRevenue: Math.round(totalNetRevenue),
    totalOrders: current.length,
    momGrowth,
    platforms,
    trend,
    note: 'Net revenue uses platform-reported fees — may differ from final settlement.',
    periodDays: days,
  };

  cache.set(cacheKey, result, 10 * 60 * 1000);
  return result;
}

// ── Return & Cancellation Analysis ───────────────────────────────────────────

async function returnAnalysis(brandId, days = 30) {
  const cacheKey = `analytics:returns:${brandId}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const since = periodStart(days);

  const orders = await prisma.platformOrder.findMany({
    where: { brandId, orderDate: { gte: since } },
    select: { platform: true, status: true, items: true, returnReason: true, cancellationReason: true },
  });

  const byPlatform = {};
  for (const o of orders) {
    if (!byPlatform[o.platform]) byPlatform[o.platform] = { total: 0, returns: 0, cancellations: 0, returnReasons: {}, cancelReasons: {} };
    const p = byPlatform[o.platform];
    p.total++;
    if (o.status === 'returned') {
      p.returns++;
      if (o.returnReason) p.returnReasons[o.returnReason] = (p.returnReasons[o.returnReason] || 0) + 1;
    }
    if (o.status === 'cancelled') {
      p.cancellations++;
      if (o.cancellationReason) p.cancelReasons[o.cancellationReason] = (p.cancelReasons[o.cancellationReason] || 0) + 1;
    }
  }

  const platforms = Object.entries(byPlatform).map(([platform, v]) => ({
    platform,
    totalOrders: v.total,
    returns: v.returns,
    cancellations: v.cancellations,
    returnRate: Math.round(safeDivide(v.returns, v.total) * 100 * 10) / 10,
    cancellationRate: Math.round(safeDivide(v.cancellations, v.total) * 100 * 10) / 10,
    topReturnReasons: Object.entries(v.returnReasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count })),
    topCancelReasons: Object.entries(v.cancelReasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count })),
  }));

  // SKU-level return analysis
  const skuReturns = {};
  for (const o of orders) {
    if (o.status !== 'returned') continue;
    for (const item of (Array.isArray(o.items) ? o.items : [])) {
      const sku = item.sku || 'unknown';
      if (!skuReturns[sku]) skuReturns[sku] = { sku, name: item.name, returns: 0 };
      skuReturns[sku].returns += (item.qty || 1);
    }
  }
  const topReturnedSkus = Object.values(skuReturns)
    .sort((a, b) => b.returns - a.returns)
    .slice(0, 10);

  const totalOrders = orders.length;
  const totalReturns = orders.filter(o => o.status === 'returned').length;
  const totalCancellations = orders.filter(o => o.status === 'cancelled').length;

  const result = {
    totalOrders,
    totalReturns,
    totalCancellations,
    overallReturnRate: Math.round(safeDivide(totalReturns, totalOrders) * 100 * 10) / 10,
    overallCancellationRate: Math.round(safeDivide(totalCancellations, totalOrders) * 100 * 10) / 10,
    platforms,
    topReturnedSkus,
    periodDays: days,
  };

  cache.set(cacheKey, result, 10 * 60 * 1000);
  return result;
}

// ── Demand Signal & Sell-Through ─────────────────────────────────────────────

async function demandSignal(brandId) {
  const cacheKey = `analytics:demand:${brandId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const since = periodStart(30);

  const [recentOrders, stockLots, allProducts] = await Promise.all([
    prisma.platformOrder.findMany({
      where: { brandId, orderDate: { gte: since }, status: { notIn: ['cancelled', 'returned', 'refunded'] } },
      select: { items: true },
    }),
    prisma.stockLot.findMany({
      where: { brandId, inventoryStatus: 'main_stock', quantity: { gt: 0 } },
      include: { product: { select: { sku: true, name: true } } },
    }),
    prisma.product.findMany({
      where: { brandId },
      select: { id: true, sku: true, name: true },
    }),
  ]);

  // Sum sold units + capture names per SKU over last 30d
  const soldBySku = {};
  const nameBySku = {};
  for (const order of recentOrders) {
    for (const item of (Array.isArray(order.items) ? order.items : [])) {
      if (!item.sku) continue;
      soldBySku[item.sku] = (soldBySku[item.sku] || 0) + (item.qty || 1);
      if (item.name && !nameBySku[item.sku]) nameBySku[item.sku] = item.name;
    }
  }

  // Product id + name lookup by SKU
  const productBySku = {};
  for (const p of allProducts) {
    if (p.sku) productBySku[p.sku] = { id: p.id, name: p.name };
  }

  // Current stock per SKU (only products with stock lots)
  const stockBySku = {};
  for (const lot of stockLots) {
    const sku = lot.product?.sku || lot.productId;
    if (!sku) continue;
    if (!stockBySku[sku]) stockBySku[sku] = { name: lot.product?.name, stock: 0 };
    stockBySku[sku].stock += (lot.quantity || 0);
  }

  // Union: every SKU that sold OR has stock
  const allSkus = new Set([...Object.keys(soldBySku), ...Object.keys(stockBySku)]);
  const signals = Array.from(allSkus).map(sku => {
    const soldLast30 = soldBySku[sku] || 0;
    const stockEntry = stockBySku[sku];
    const stock      = stockEntry?.stock || 0;
    const name       = stockEntry?.name || productBySku[sku]?.name || nameBySku[sku] || null;
    const productId  = productBySku[sku]?.id || null;
    const inInventory = !!stockEntry;
    const dailyVelocity = soldLast30 / 30;
    const daysRemaining = dailyVelocity === 0 || stock === 0 ? null : Math.round(stock / dailyVelocity);
    return {
      sku, name, productId, stock, soldLast30, inInventory,
      dailyVelocity: Math.round(dailyVelocity * 10) / 10,
      daysRemaining,
      alert: daysRemaining !== null && daysRemaining < 14 ? 'restock' : null,
    };
  }).sort((a, b) => b.soldLast30 - a.soldLast30);

  const result = {
    signals,
    restockAlerts: signals.filter(s => s.alert === 'restock'),
    deadStock: signals.filter(s => s.soldLast30 === 0 && s.stock > 0).slice(0, 20),
    notInInventory: signals.filter(s => !s.inInventory && s.soldLast30 > 0),
  };

  cache.set(cacheKey, result, 15 * 60 * 1000);
  return result;
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────

async function anomalyDetector(brandId) {
  const cacheKey = `analytics:anomalies:${brandId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const since = periodStart(30);

  const orders = await prisma.platformOrder.findMany({
    where: { brandId, orderDate: { gte: since } },
    select: { orderDate: true, status: true, grossAmount: true, platform: true },
  });

  if (orders.length < 7) {
    const result = { anomalies: [], note: 'Insufficient data — need at least 7 days of orders.' };
    cache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  // Build daily revenue series
  const dailyRevenue = {};
  const dailyReturns = {};
  for (const o of orders) {
    const day = o.orderDate.toISOString().slice(0, 10);
    if (o.status !== 'returned' && o.status !== 'cancelled') {
      dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(o.grossAmount);
    }
    if (o.status === 'returned') {
      dailyReturns[day] = (dailyReturns[day] || 0) + 1;
    }
  }

  function zscore(series) {
    const vals = Object.values(series);
    if (vals.length < 3) return {};
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
    if (std === 0) return {};
    return Object.fromEntries(Object.entries(series).map(([d, v]) => [d, (v - mean) / std]));
  }

  const revenueZ = zscore(dailyRevenue);
  const returnZ = zscore(dailyReturns);

  const anomalies = [];
  for (const [date, z] of Object.entries(revenueZ)) {
    if (z < -2) anomalies.push({ date, type: 'revenue_drop', severity: z < -3 ? 'high' : 'medium', message: `Revenue unusually low on ${date}` });
    if (z > 3) anomalies.push({ date, type: 'revenue_spike', severity: 'low', message: `Revenue spike on ${date} — verify authenticity` });
  }
  for (const [date, z] of Object.entries(returnZ)) {
    if (z > 2) anomalies.push({ date, type: 'return_spike', severity: z > 3 ? 'high' : 'medium', message: `High returns on ${date}` });
  }

  anomalies.sort((a, b) => b.date.localeCompare(a.date));

  const result = { anomalies: anomalies.slice(0, 10) };
  cache.set(cacheKey, result, 15 * 60 * 1000);
  return result;
}

// ── Demand Forecast ───────────────────────────────────────────────────────────

async function forecastEngine(brandId) {
  const cacheKey = `analytics:forecast:${brandId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const since = periodStart(90);

  const orders = await prisma.platformOrder.findMany({
    where: { brandId, orderDate: { gte: since }, status: { notIn: ['cancelled', 'returned', 'refunded'] } },
    select: { items: true, orderDate: true },
    orderBy: { orderDate: 'asc' },
  });

  const skuHistory = {};
  for (const order of orders) {
    const week = getWeekKey(order.orderDate);
    for (const item of (Array.isArray(order.items) ? order.items : [])) {
      const sku = item.sku || 'unknown';
      if (!skuHistory[sku]) skuHistory[sku] = { name: item.name, weeks: {} };
      skuHistory[sku].weeks[week] = (skuHistory[sku].weeks[week] || 0) + (item.qty || 1);
    }
  }

  const forecasts = [];
  const currentMonth = new Date().getMonth();
  const seasonalWeight = FESTIVAL_WEIGHTS[currentMonth] || 1.0;

  for (const [sku, { name, weeks }] of Object.entries(skuHistory)) {
    const weekValues = Object.values(weeks);
    if (weekValues.length < 2) continue;

    // Weighted moving average — more recent weeks get higher weight
    const wma = weightedMovingAverage(weekValues);
    const weeklyForecast = wma * seasonalWeight;
    const lowConfidence = weekValues.length < 4;

    forecasts.push({
      sku,
      name,
      weeklyForecast: Math.round(weeklyForecast),
      forecast30d: Math.round(weeklyForecast * 4.3),
      forecast60d: Math.round(weeklyForecast * 8.6),
      forecast90d: Math.round(weeklyForecast * 13),
      lowConfidence,
      seasonalMultiplier: seasonalWeight !== 1.0 ? seasonalWeight : null,
      weeksSeen: weekValues.length,
    });
  }

  forecasts.sort((a, b) => b.forecast30d - a.forecast30d);

  const result = { forecasts: forecasts.slice(0, 50), seasonalNote: seasonalWeight !== 1.0 ? `Festival season detected — forecast includes ${seasonalWeight}x seasonal weight` : null };
  cache.set(cacheKey, result, 60 * 60 * 1000); // 1h cache for forecasts
  return result;
}

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function weightedMovingAverage(values) {
  const n = values.length;
  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < n; i++) {
    const w = i + 1; // more recent = higher index = higher weight
    weightedSum += values[i] * w;
    weightSum += w;
  }
  return weightSum === 0 ? 0 : weightedSum / weightSum;
}

// ── Nightly Aggregation (called by jobQueue) ───────────────────────────────────

async function runNightlyAggregation(brandId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  const dayStart = new Date(dateStr);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.platformOrder.findMany({
    where: { brandId, orderDate: { gte: dayStart, lt: dayEnd } },
    select: { platform: true, status: true, grossAmount: true, netRevenue: true },
  });

  const aggregates = {};
  for (const o of orders) {
    const p = o.platform;
    if (!aggregates[p]) aggregates[p] = { orders: 0, revenue: 0, returns: 0, cancellations: 0, net_revenue: 0 };
    aggregates[p].orders++;
    if (!['returned', 'cancelled', 'refunded'].includes(o.status)) {
      aggregates[p].revenue += Number(o.grossAmount);
      aggregates[p].net_revenue += o.netRevenue ? Number(o.netRevenue) : Number(o.grossAmount);
    }
    if (o.status === 'returned') aggregates[p].returns++;
    if (o.status === 'cancelled') aggregates[p].cancellations++;
  }

  // Upsert one row per platform per metric per day (idempotent)
  for (const [platform, vals] of Object.entries(aggregates)) {
    for (const metric of Object.values(METRICS)) {
      if (!(metric in vals)) continue;
      await prisma.platformMetric.upsert({
        where: { brandId_platform_date_metric: { brandId, platform, date: dayStart, metric } },
        create: { brandId, platform, date: dayStart, metric, value: vals[metric] },
        update: { value: vals[metric] },
      });
    }
    // Compute and store return_rate
    const returnRate = safeDivide(vals.returns, vals.orders) * 100;
    await prisma.platformMetric.upsert({
      where: { brandId_platform_date_metric: { brandId, platform, date: dayStart, metric: METRICS.RETURN_RATE } },
      create: { brandId, platform, date: dayStart, metric: METRICS.RETURN_RATE, value: returnRate },
      update: { value: returnRate },
    });
  }

  // Invalidate analytics cache after aggregation
  cache.invalidate(`analytics:revenue:${brandId}`);
  cache.invalidate(`analytics:returns:${brandId}`);

  return { date: dateStr, platformsProcessed: Object.keys(aggregates).length };
}

function invalidateAnalyticsCache(brandId) {
  // Clears all analytics cache keys for a given brand across all metrics and periods
  const prefixes = ['revenue', 'returns', 'demand', 'anomalies', 'forecast'];
  for (const prefix of prefixes) {
    cache.invalidate(`analytics:${prefix}:${brandId}`);
  }
}

module.exports = {
  revenueAnalytics,
  returnAnalysis,
  demandSignal,
  anomalyDetector,
  forecastEngine,
  runNightlyAggregation,
  invalidateAnalyticsCache,
  METRICS,
};
