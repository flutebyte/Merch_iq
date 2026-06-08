const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { writeEvent } = require('../services/inventoryEventWriter');
const { getQueue } = require('../services/jobQueue');
const { invalidateCache } = require('../services/actionQueueGenerator');
const { STATES, TRIGGERS, transition } = require('../services/confidenceStateMachine');

const router = express.Router();
router.use(requireAuth);

// GET /sales-records
router.get('/', async (req, res, next) => {
  try {
    const { productId, stockLotId, limit = 50, offset = 0 } = req.query;
    const where = { brandId: req.brandId };
    if (productId)  where.productId  = productId;
    if (stockLotId) where.stockLotId = stockLotId;

    const [records, total] = await Promise.all([
      prisma.salesRecord.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          stockLot: { select: { id: true, confidenceState: true, quantity: true } },
        },
        orderBy: { date: 'desc' },
        take: Math.min(parseInt(limit, 10) || 50, 200),
        skip: parseInt(offset, 10) || 0,
      }),
      prisma.salesRecord.count({ where }),
    ]);

    res.json({ records, total });
  } catch (err) { next(err); }
});

// POST /sales-records
router.post('/', async (req, res, next) => {
  try {
    const {
      productId, stockLotId, size,
      quantity, price, channel, date,
      partner, notes, source = 'manual_entry',
    } = req.body;

    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });
    if (!date) return res.status(400).json({ error: 'date is required' });

    // Verify product belongs to brand
    const product = await prisma.product.findFirst({ where: { id: productId, brandId: req.brandId } });
    if (!product) return res.status(404).json({ error: 'product not found' });

    const result = await prisma.$transaction(async (tx) => {
      // Create sale record
      const sale = await tx.salesRecord.create({
        data: {
          brandId:   req.brandId,
          productId,
          stockLotId: stockLotId || null,
          size:      size || null,
          quantity:  parseInt(quantity, 10),
          price:     price ? parseFloat(price) : null,
          channel:   channel || 'direct',
          date:      new Date(date),
          partner:   partner || null,
          notes:     notes || null,
          source,
          confidence: 'high',
        },
      });

      // If stockLotId provided, update lot quantity and possibly state
      let updatedLot = null;
      if (stockLotId) {
        const lot = await tx.stockLot.findFirst({ where: { id: stockLotId, brandId: req.brandId } });
        if (lot) {
          const newQty = (lot.quantity ?? 0) - parseInt(quantity, 10);

          // Determine new confidence state
          let newState = lot.confidenceState;
          let newPreConflictState = lot.preConflictState;
          if (lot.confidenceState === STATES.COUNT_VERIFIED) {
            try {
              const result = transition(TRIGGERS.SALE_RECORDED, lot.confidenceState, lot.preConflictState);
              newState = result.newState;
              newPreConflictState = result.newPreConflictState;
            } catch (_) { /* keep current state if transition not valid */ }
          }

          updatedLot = await tx.stockLot.update({
            where: { id: stockLotId },
            data: {
              quantity: newQty,
              confidenceState: newState,
              preConflictState: newPreConflictState,
              version: { increment: 1 },
            },
          });

          await writeEvent(tx, {
            brandId: req.brandId,
            stockLotId,
            eventType: 'sale',
            payload: {
              saleId: sale.id,
              quantity: parseInt(quantity, 10),
              price,
              channel,
              lotQuantityAfter: newQty,
            },
            userId: req.userId,
          });

          // Warn if negative stock (spec §16.6)
          if (newQty < 0) {
            console.warn(`[sales] Negative stock for lot ${stockLotId}: ${newQty}`);
          }
        }
      }

      return { sale, updatedLot };
    });

    // Trigger confidence update
    try {
      const boss = getQueue();
      await boss.send('confidence-score-update', { brandId: req.brandId }, { singletonKey: `confidence-${req.brandId}` });
    } catch (_) { /* non-fatal */ }

    invalidateCache(req.brandId);

    res.status(201).json(result.sale);
  } catch (err) { next(err); }
});

// GET /sales-records/:id
router.get('/:id', async (req, res, next) => {
  try {
    const record = await prisma.salesRecord.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        stockLot: { select: { id: true, confidenceState: true, quantity: true } },
      },
    });
    if (!record) return res.status(404).json({ error: 'not found' });
    res.json(record);
  } catch (err) { next(err); }
});

module.exports = router;
