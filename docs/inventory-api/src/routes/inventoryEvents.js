const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /inventory-events?stockLotId=xxx&limit=50
// GET /inventory-events?brandId=xxx&limit=20  (brand feed)
router.get('/', async (req, res, next) => {
  try {
    const { stockLotId, limit = 50 } = req.query;

    const where = { brandId: req.brandId };
    if (stockLotId) where.stockLotId = stockLotId;

    const events = await prisma.inventoryEvent.findMany({
      where,
      include: {
        stockLot: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        createdBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    });

    res.json(events);
  } catch (err) { next(err); }
});

module.exports = router;
