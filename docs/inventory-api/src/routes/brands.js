const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeConfidence } = require('../services/confidenceCalculator');

const router = express.Router();
router.use(requireAuth);

// GET /brands/current — current brand with confidence
router.get('/current', async (req, res, next) => {
  try {
    const brand = await prisma.brand.findUnique({ where: { id: req.brandId } });
    if (!brand) return res.status(404).json({ error: 'brand not found' });
    res.json(brand);
  } catch (err) { next(err); }
});

// GET /brands/:id/confidence — return cached confidence + staleness flag
router.get('/:id/confidence', async (req, res, next) => {
  try {
    if (req.params.id !== req.brandId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const brand = await prisma.brand.findUnique({ where: { id: req.brandId } });
    if (!brand) return res.status(404).json({ error: 'brand not found' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isStale = !brand.confidenceLastComputedAt ||
      new Date(brand.confidenceLastComputedAt) < oneHourAgo;

    res.json({
      score: brand.confidenceScore,
      breakdown: brand.confidenceBreakdown,
      lastComputedAt: brand.confidenceLastComputedAt,
      isStale,
    });
  } catch (err) { next(err); }
});

// POST /brands/:id/confidence/refresh — explicit trigger (testing + manual refresh)
router.post('/:id/confidence/refresh', async (req, res, next) => {
  try {
    if (req.params.id !== req.brandId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { score, breakdown } = await computeConfidence(req.brandId, prisma);

    await prisma.brand.update({
      where: { id: req.brandId },
      data: {
        confidenceScore:          score,
        confidenceBreakdown:      breakdown,
        confidenceLastComputedAt: new Date(),
      },
    });

    res.json({ score, breakdown, refreshedAt: new Date() });
  } catch (err) { next(err); }
});

// PATCH /brands/:id — update brand settings
router.patch('/:id', async (req, res, next) => {
  try {
    if (req.params.id !== req.brandId) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const { name } = req.body;
    const updated = await prisma.brand.update({
      where: { id: req.brandId },
      data: { ...(name ? { name } : {}) },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
