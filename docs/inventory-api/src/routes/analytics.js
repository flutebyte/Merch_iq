const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  revenueAnalytics,
  returnAnalysis,
  demandSignal,
  anomalyDetector,
  forecastEngine,
} = require('../services/analyticsEngine');

router.use(requireAuth);

router.get('/revenue', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const data = await revenueAnalytics(req.brandId, days);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/returns', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const data = await returnAnalysis(req.brandId, days);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/demand', async (req, res, next) => {
  try {
    const data = await demandSignal(req.brandId);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/anomalies', async (req, res, next) => {
  try {
    const data = await anomalyDetector(req.brandId);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/forecast', async (req, res, next) => {
  try {
    const data = await forecastEngine(req.brandId);
    res.json(data);
  } catch (err) { next(err); }
});

// Sales view — delivered + shipped orders only, with daily trend for line graph
router.get('/order-sales', async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await prisma.platformOrder.findMany({
      where: {
        brandId: req.brandId,
        orderDate: { gte: since },
        status: { in: ['delivered', 'shipped'] },
      },
      select: {
        platformOrderId: true, platform: true, orderDate: true,
        grossAmount: true, netRevenue: true, status: true, items: true,
      },
      orderBy: { orderDate: 'desc' },
    });

    // Build daily revenue trend, filling gaps with zero
    const dailyMap = {};
    for (const o of orders) {
      const day = o.orderDate.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, orders: 0 };
      dailyMap[day].revenue += Number(o.grossAmount);
      dailyMap[day].orders++;
    }
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      trend.push(dailyMap[day] || { date: day, revenue: 0, orders: 0 });
    }

    const totalRevenue = orders.reduce((s, o) => s + Number(o.grossAmount), 0);
    const totalUnits   = orders.reduce((s, o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return s + items.reduce((ss, i) => ss + (i.qty || 1), 0);
    }, 0);

    res.json({ orders, trend, totalRevenue: Math.round(totalRevenue), totalOrders: orders.length, totalUnits, periodDays: days });
  } catch (err) { next(err); }
});

module.exports = router;
