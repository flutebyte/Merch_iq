const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, brandName } = req.body;

    if (!email || !password || !brandName) {
      return res.status(400).json({ error: 'email, password, and brandName are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'email already in use' });

    const passwordHash = await bcrypt.hash(password, 12);
    const baseSlug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash } });
      const brand = await tx.brand.create({
        data: { name: brandName, slug: `${baseSlug}-${user.id.slice(0, 6)}` },
      });
      await tx.brandUser.create({ data: { brandId: brand.id, userId: user.id, role: 'owner' } });
      return { user, brand };
    });

    const token = jwt.sign(
      { userId: result.user.id, brandId: result.brand.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: { id: result.user.id, email: result.user.email },
      brand: { id: result.brand.id, name: result.brand.name, slug: result.brand.slug },
    });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'invalid credentials' });

    const brandUser = await prisma.brandUser.findFirst({
      where: { userId: user.id },
      include: { brand: true },
    });
    if (!brandUser) return res.status(403).json({ error: 'no brand access' });

    const token = jwt.sign(
      { userId: user.id, brandId: brandUser.brandId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
      brand: { id: brandUser.brand.id, name: brandUser.brand.name, slug: brandUser.brand.slug },
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  // JWT is stateless; client drops the token. Token blocklist deferred to Phase 2.
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [user, brandUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.brandUser.findFirst({
        where: { userId: req.userId, brandId: req.brandId },
        include: { brand: true },
      }),
    ]);
    if (!user) return res.status(401).json({ error: 'user not found' });

    res.json({
      user: { id: user.id, email: user.email },
      brand: brandUser ? { id: brandUser.brand.id, name: brandUser.brand.name, slug: brandUser.brand.slug } : null,
      role: brandUser?.role ?? null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
