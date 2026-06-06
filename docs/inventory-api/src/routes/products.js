const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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
    const products = await prisma.product.findMany({
      where,
      include: {
        stockLots: {
          select: { id: true, quantity: true, quantityCertainty: true, confidenceState: true, inventoryStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { sku, name, category, color, size, costPrice, sellingPrice, tags, images } = req.body;
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

    const { sku, name, category, color, size, costPrice, sellingPrice, tags, images } = req.body;
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
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
