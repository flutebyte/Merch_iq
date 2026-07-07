const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/mailer');

const router = express.Router();

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — within OWASP's 15-60 min guidance
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'new password must be at least 8 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'user not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'current password is incorrect' });
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash: newHash } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashResetToken(token),
          passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email, resetUrl);

      // Non-production convenience only: lets the flow be exercised without real email infra.
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ ok: true, message: GENERIC_RESET_MESSAGE, devResetUrl: resetUrl });
      }
    }

    // Same response whether or not the email is registered — avoids account enumeration.
    res.json({ ok: true, message: GENERIC_RESET_MESSAGE });
  } catch (err) { next(err); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'new password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: hashResetToken(token) } });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });

    res.json({ ok: true });
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
