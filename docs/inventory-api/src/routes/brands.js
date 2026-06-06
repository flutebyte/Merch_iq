const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/current', async (req, res, next) => {
  try {
    const brand = await prisma.brand.findUnique({ where: { id: req.brandId } });
    if (!brand) return res.status(404).json({ error: 'brand not found' });
    res.json(brand);
  } catch (err) { next(err); }
});

module.exports = router;
