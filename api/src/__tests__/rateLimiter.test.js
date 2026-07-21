const express = require('express');
const request = require('supertest');
const { createLoginLimiter, createSignupLimiter } = require('../middleware/rateLimiter');

function appWithLimiter(limiter, { fail = false } = {}) {
  const app = express();
  app.post('/probe', limiter, (req, res) => {
    if (fail) return res.status(401).json({ error: 'invalid credentials' });
    res.json({ ok: true });
  });
  return app;
}

describe('auth rate limiters', () => {
  test('loginLimiter blocks after the configured number of failed attempts (skips successes)', async () => {
    const failingApp = appWithLimiter(createLoginLimiter(), { fail: true });

    for (let i = 0; i < 10; i++) {
      const res = await request(failingApp).post('/probe');
      expect(res.status).toBe(401);
    }

    const blocked = await request(failingApp).post('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });

  test('loginLimiter does not count successful requests toward the limit', async () => {
    const okApp = appWithLimiter(createLoginLimiter(), { fail: false });

    for (let i = 0; i < 25; i++) {
      const res = await request(okApp).post('/probe');
      expect(res.status).toBe(200);
    }
  });

  test('signupLimiter allows up to the configured limit, then returns 429', async () => {
    const app = appWithLimiter(createSignupLimiter());

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/probe');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });
});
