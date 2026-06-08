const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { STATES, TRIGGERS, transition, inferTrigger } = require('../services/confidenceStateMachine');
const { writeEvent } = require('../services/inventoryEventWriter');
const { invalidateCache } = require('../services/actionQueueGenerator');

const router = express.Router();
router.use(requireAuth);

async function triggerConfidenceUpdate(brandId) {
  try {
    const { getQueue } = require('../services/jobQueue');
    const boss = getQueue();
    await boss.send('confidence-score-update', { brandId }, { singletonKey: `confidence-${brandId}` });
  } catch (_) { /* non-fatal — queue may not be ready */ }
}

const TRIGGER_TO_EVENT_TYPE = {
  [TRIGGERS.PHOTO_CAPTURED]:    'photo_capture',
  [TRIGGERS.NAME_ADDED]:        'photo_draft',
  [TRIGGERS.QUANTITY_ADDED]:    'manual_entry',
  [TRIGGERS.IMPORTED]:          'import',
  [TRIGGERS.MANUAL_ENTRY]:      'manual_entry',
  [TRIGGERS.COUNT_RECORDED]:    'count',
  [TRIGGERS.SALE_RECORDED]:     'sale',
  [TRIGGERS.CONFLICT_DETECTED]: 'conflict_detection',
  [TRIGGERS.CONFLICT_RESOLVED]: 'conflict_resolution',
};

router.get('/', async (req, res, next) => {
  try {
    const { status, state, productId } = req.query;
    const where = { brandId: req.brandId };
    if (status)    where.inventoryStatus = status;
    if (state)     where.confidenceState = state;
    if (productId) where.productId = productId;

    const lots = await prisma.stockLot.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(lots);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, quantity, quantityCertainty, inventoryStatus, source, photos, notes, trigger } = req.body;

    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!source)    return res.status(400).json({ error: 'source is required' });

    const product = await prisma.product.findFirst({ where: { id: productId, brandId: req.brandId } });
    if (!product) return res.status(404).json({ error: 'product not found' });

    const appliedTrigger = trigger
      || (source === 'photo' ? TRIGGERS.PHOTO_CAPTURED : TRIGGERS.MANUAL_ENTRY);

    // New lot starts from photo_only so PHOTO_CAPTURED is the initial trigger
    const { newState, newPreConflictState } = transition(appliedTrigger, STATES.PHOTO_ONLY, null);

    const lot = await prisma.$transaction(async (tx) => {
      const created = await tx.stockLot.create({
        data: {
          brandId:           req.brandId,
          productId,
          quantity:          quantity ?? null,
          quantityCertainty: quantityCertainty || 'unknown',
          inventoryStatus:   inventoryStatus || 'main_stock',
          confidenceState:   newState,
          preConflictState:  newPreConflictState,
          source,
          photos:            photos || [],
          notes:             notes  ?? null,
          version:           0,
        },
      });
      await writeEvent(tx, {
        brandId:   req.brandId,
        stockLotId: created.id,
        eventType: TRIGGER_TO_EVENT_TYPE[appliedTrigger] || 'manual_entry',
        payload:   { trigger: appliedTrigger, quantity, source, initialState: newState },
        userId:    req.userId,
      });
      return created;
    });

    await triggerConfidenceUpdate(req.brandId);
    invalidateCache(req.brandId);

    res.status(201).json(lot);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const lot = await prisma.stockLot.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
      include: {
        product: true,
        inventoryEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lot) return res.status(404).json({ error: 'not found' });
    res.json(lot);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const {
      version,
      quantity, quantityCertainty, inventoryStatus,
      photos, notes,
      trigger: explicitTrigger,
      productName,
    } = req.body;

    const existing = await prisma.stockLot.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
    });
    if (!existing) return res.status(404).json({ error: 'not found' });

    // Optimistic locking — reject if client is working from a stale version
    if (version !== undefined && existing.version !== version) {
      return res.status(409).json({
        error:          'version conflict',
        message:        'This item was updated while you were editing. Please reload and try again.',
        currentVersion: existing.version,
        clientVersion:  version,
      });
    }

    const inferredTrigger = inferTrigger(existing.confidenceState, {
      quantity, productName, trigger: explicitTrigger,
    });

    let newState          = existing.confidenceState;
    let newPreConflictState = existing.preConflictState;

    if (inferredTrigger) {
      const result      = transition(inferredTrigger, existing.confidenceState, existing.preConflictState);
      newState          = result.newState;
      newPreConflictState = result.newPreConflictState;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (productName !== undefined) {
        await tx.product.update({ where: { id: existing.productId }, data: { name: productName } });
      }

      const lot = await tx.stockLot.update({
        where: { id: req.params.id },
        data: {
          quantity:          quantity          !== undefined ? quantity          : existing.quantity,
          quantityCertainty: quantityCertainty !== undefined ? quantityCertainty : existing.quantityCertainty,
          inventoryStatus:   inventoryStatus   !== undefined ? inventoryStatus   : existing.inventoryStatus,
          photos:            photos            !== undefined ? photos            : existing.photos,
          notes:             notes             !== undefined ? notes             : existing.notes,
          confidenceState:   newState,
          preConflictState:  newPreConflictState,
          version:           existing.version + 1,
        },
      });

      if (inferredTrigger) {
        await writeEvent(tx, {
          brandId:    req.brandId,
          stockLotId: existing.id,
          eventType:  TRIGGER_TO_EVENT_TYPE[inferredTrigger] || 'adjustment',
          payload: {
            trigger:     inferredTrigger,
            fromState:   existing.confidenceState,
            toState:     newState,
            quantity,
            productName,
          },
          userId: req.userId,
        });
      }

      return lot;
    });

    await triggerConfidenceUpdate(req.brandId);
    invalidateCache(req.brandId);

    res.json(updated);
  } catch (err) {
    if (err.message?.includes('not allowed while in conflict_detected') ||
        err.message?.includes('requires')) {
      return res.status(422).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.stockLot.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
    });
    if (!existing) return res.status(404).json({ error: 'not found' });

    // Cascade delete inventory events first, then the lot
    await prisma.$transaction(async (tx) => {
      await tx.inventoryEvent.deleteMany({ where: { stockLotId: existing.id } });
      await tx.stockLot.delete({ where: { id: existing.id } });
    });

    invalidateCache(req.brandId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
