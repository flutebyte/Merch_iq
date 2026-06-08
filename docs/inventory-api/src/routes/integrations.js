const express = require('express');
const crypto  = require('crypto');
const prisma  = require('../db');
const { requireAuth } = require('../middleware/auth');
const shopifySync  = require('../services/shopifySync');
const platformSync = require('../services/platformSync');
const XLSX         = require('xlsx');

const router = express.Router();

const APP_URL      = process.env.APP_URL      || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── OAuth state nonce store (in-memory, 10-min TTL) ───────────────────────────
const nonceStore = new Map();
setInterval(() => {
  const cut = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of nonceStore) { if (v.at < cut) nonceStore.delete(k); }
}, 60000);

function makeState(brandId, platform) {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(nonce, { brandId, platform, at: Date.now() });
  return Buffer.from(JSON.stringify({ brandId, platform, nonce })).toString('base64url');
}

function parseState(state) {
  try {
    const obj = JSON.parse(Buffer.from(state, 'base64url').toString());
    if (!nonceStore.has(obj.nonce)) return null;
    nonceStore.delete(obj.nonce);
    return obj;
  } catch { return null; }
}

function fe(path) { return `${FRONTEND_URL}${path}`; }

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORM_META = {
  shopify:     { name: 'Shopify',           category: 'ecommerce',   desc: 'Sync products and orders with your Shopify store' },
  amazon:      { name: 'Amazon Seller',     category: 'marketplace', desc: 'Sync orders and returns from Amazon India' },
  flipkart:    { name: 'Flipkart Seller',   category: 'marketplace', desc: 'Sync orders and returns from Flipkart' },
  myntra:      { name: 'Myntra',            category: 'marketplace', desc: 'Sync orders via MMIP Developer Centre API (partner approval required)' },
  etsy:        { name: 'Etsy',              category: 'marketplace', desc: 'Sync orders from your Etsy shop' },
  woocommerce: { name: 'WooCommerce',       category: 'ecommerce',   desc: 'Sync orders from your WooCommerce store' },
  meesho:      { name: 'Meesho',            category: 'marketplace', desc: 'Import Meesho orders via CSV export' },
  ajio:        { name: 'Ajio',              category: 'marketplace', desc: 'Import Ajio orders via CSV export' },
  citymall:    { name: 'CityMall',          category: 'marketplace', desc: 'Import CityMall orders via CSV export (Tier 2/3 social commerce)' },
  whatsapp:    { name: 'WhatsApp Business', category: 'messaging',   desc: 'Export product catalogue to WhatsApp' },
  pos:         { name: 'POS System',        category: 'pos',         desc: 'Receive sales from your billing/POS machine via webhook' },
  tally:       { name: 'Tally / ERP',       category: 'erp',         desc: 'Export inventory to Tally XML format (Tally 9, Prime, ERP 9)' },
};

// ── GET /integrations — list with DB-backed status ───────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.integration.findMany({ where: { brandId: req.brandId } });
    const byPlatform = Object.fromEntries(rows.map(r => [r.platform, r]));

    const result = Object.entries(PLATFORM_META).map(([id, meta]) => {
      const conn = byPlatform[id];
      return {
        id, ...meta,
        connected:   !!conn,
        status:      conn?.status || 'disconnected',
        lastSyncAt:  conn?.lastSyncAt || null,
        shopDomain:  conn?.shopDomain || null,
        metadata:    conn?.metadata || {},
      };
    });

    res.json({ integrations: result });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  SHOPIFY
// ═════════════════════════════════════════════════════════════════

// Start Shopify OAuth → frontend calls this, gets back authUrl, redirects user
router.get('/shopify/auth', requireAuth, (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'shop parameter required (e.g. yourstore.myshopify.com)' });
  if (!process.env.SHOPIFY_API_KEY) return res.status(503).json({ error: 'SHOPIFY_API_KEY not configured on server' });

  const state = makeState(req.brandId, 'shopify');
  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,read_fulfillments';
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/shopify/callback`);
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  res.json({ authUrl });
});

// Shopify OAuth callback (public — called by Shopify after user approves)
router.get('/shopify/callback', async (req, res) => {
  const { code, shop, hmac, state } = req.query;

  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=shopify&status=error&msg=invalid_state'));

  // Verify HMAC
  if (process.env.SHOPIFY_API_SECRET) {
    const params = new URLSearchParams(req.query);
    params.delete('hmac');
    const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const msg = sorted.map(([k, v]) => `${k}=${v}`).join('&');
    const digest = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(msg).digest('hex');
    if (digest !== hmac) return res.redirect(fe('/settings?integration=shopify&status=error&msg=hmac_mismatch'));
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, code }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const { access_token, scope } = await tokenRes.json();

    const { brandId } = stateData;
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId, platform: 'shopify' } },
      create: { brandId, platform: 'shopify', status: 'connected', accessToken: access_token, shopDomain: shop, metadata: { scope } },
      update: { status: 'connected', accessToken: access_token, shopDomain: shop, metadata: { scope } },
    });

    // Register webhooks + initial sync (background, non-blocking)
    shopifySync.registerWebhooks(shop, access_token, APP_URL).catch(() => {});
    shopifySync.syncProducts({ accessToken: access_token, shopDomain: shop }, brandId).catch(() => {});
    shopifySync.importOrders({ accessToken: access_token, shopDomain: shop, syncCursor: null }, brandId).catch(() => {});

    res.redirect(fe(`/settings?integration=shopify&status=connected&shop=${encodeURIComponent(shop)}`));
  } catch (err) {
    res.redirect(fe(`/settings?integration=shopify&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

// Manual sync
router.post('/shopify/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { brandId_platform: { brandId: req.brandId, platform: 'shopify' } },
    });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'Shopify not connected' });

    await prisma.integration.update({
      where: { brandId_platform: { brandId: req.brandId, platform: 'shopify' } },
      data: { status: 'syncing' },
    });

    const [products, orders] = await Promise.all([
      shopifySync.syncProducts(integration, req.brandId),
      shopifySync.importOrders(integration, req.brandId),
    ]);

    await prisma.integration.update({
      where: { brandId_platform: { brandId: req.brandId, platform: 'shopify' } },
      data: { status: 'connected', lastSyncAt: new Date() },
    });

    res.json({ ok: true, products, orders });
  } catch (err) { next(err); }
});

// Shopify order webhook (public — raw body needed for HMAC)
router.post('/shopify/webhooks/orders_create', async (req, res) => {
  const raw = req.rawBody;
  if (process.env.SHOPIFY_API_SECRET && raw) {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const digest = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(raw).digest('base64');
    if (digest !== hmac) return res.status(401).end();
  }

  const shopDomain = req.headers['x-shopify-shop-domain'];
  const integration = await prisma.integration.findFirst({ where: { platform: 'shopify', shopDomain } });
  if (!integration) return res.status(200).end();

  const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  for (const item of (order.line_items || [])) {
    if (!item.product_id) continue;
    try {
      const rows = await prisma.$queryRaw`
        SELECT id FROM products WHERE brand_id = ${integration.brandId}::uuid
        AND external_ids ->> 'shopify' = ${item.product_id.toString()} LIMIT 1
      `;
      if (!rows.length) continue;

      const extOrderId = `shopify:${order.id}:${item.id}`;
      const dup = await prisma.salesRecord.findFirst({ where: { brandId: integration.brandId, externalOrderId: extOrderId } });
      if (dup) continue;

      await prisma.salesRecord.create({
        data: {
          brandId: integration.brandId, productId: rows[0].id,
          quantity: item.quantity,
          price: item.price ? parseFloat(item.price) : null,
          channel: 'shopify', date: new Date(order.created_at),
          externalOrderId: extOrderId, source: 'sales_sync', confidence: 'high',
          notes: `Shopify order #${order.order_number}`,
        },
      });
    } catch (_) {}
  }

  res.status(200).end();
});

// Disconnect Shopify
router.delete('/shopify/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'shopify' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  AMAZON SP-API
// ═════════════════════════════════════════════════════════════════

router.get('/amazon/auth', requireAuth, (req, res) => {
  if (!process.env.AMAZON_APP_ID) return res.status(503).json({ error: 'AMAZON_APP_ID not configured' });

  const state = makeState(req.brandId, 'amazon');
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/amazon/callback`);
  const authUrl = `https://sellercentral.amazon.in/apps/authorize/consent?application_id=${process.env.AMAZON_APP_ID}&redirect_uri=${redirectUri}&state=${state}&version=beta`;

  res.json({ authUrl });
});

router.get('/amazon/callback', async (req, res) => {
  const { spapi_oauth_code, state, selling_partner_id } = req.query;

  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=amazon&status=error&msg=invalid_state'));

  try {
    const tokens = await platformSync.exchangeAmazonCode(spapi_oauth_code);
    const { brandId } = stateData;

    await prisma.integration.upsert({
      where: { brandId_platform: { brandId, platform: 'amazon' } },
      create: {
        brandId, platform: 'amazon', status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        metadata: { sellerId: selling_partner_id },
      },
      update: {
        status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        metadata: { sellerId: selling_partner_id },
      },
    });

    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId, platform: 'amazon' } } });
    platformSync.syncAmazonProducts(integration, brandId).catch(() => {});
    platformSync.importAmazonOrders(integration, brandId).catch(() => {});

    res.redirect(fe('/settings?integration=amazon&status=connected'));
  } catch (err) {
    res.redirect(fe(`/settings?integration=amazon&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

router.post('/amazon/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'amazon' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'Amazon not connected' });

    await prisma.integration.update({ where: { brandId_platform: { brandId: req.brandId, platform: 'amazon' } }, data: { status: 'syncing' } });

    const [products, orders] = await Promise.all([
      platformSync.syncAmazonProducts(integration, req.brandId),
      platformSync.importAmazonOrders(integration, req.brandId),
    ]);

    await prisma.integration.update({ where: { brandId_platform: { brandId: req.brandId, platform: 'amazon' } }, data: { status: 'connected', lastSyncAt: new Date() } });
    res.json({ ok: true, products, orders });
  } catch (err) { next(err); }
});

router.delete('/amazon/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'amazon' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  FLIPKART
// ═════════════════════════════════════════════════════════════════

router.get('/flipkart/auth', requireAuth, (req, res) => {
  if (!process.env.FLIPKART_CLIENT_ID) return res.status(503).json({ error: 'FLIPKART_CLIENT_ID not configured' });

  const state = makeState(req.brandId, 'flipkart');
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/flipkart/callback`);
  const scopes = encodeURIComponent('Seller_Api');
  const authUrl = `https://api.flipkart.net/oauth-service/oauth/authorize?response_type=code&client_id=${process.env.FLIPKART_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  res.json({ authUrl });
});

router.get('/flipkart/callback', async (req, res) => {
  const { code, state } = req.query;

  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=flipkart&status=error&msg=invalid_state'));

  try {
    const tokens = await platformSync.exchangeFlipkartCode(code);
    const { brandId } = stateData;

    await prisma.integration.upsert({
      where: { brandId_platform: { brandId, platform: 'flipkart' } },
      create: { brandId, platform: 'flipkart', status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null },
      update: { status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null },
    });

    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId, platform: 'flipkart' } } });
    platformSync.syncFlipkartListings(integration, brandId).catch(() => {});
    platformSync.importFlipkartOrders(integration, brandId).catch(() => {});

    res.redirect(fe('/settings?integration=flipkart&status=connected'));
  } catch (err) {
    res.redirect(fe(`/settings?integration=flipkart&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

router.post('/flipkart/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'flipkart' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'Flipkart not connected' });

    await prisma.integration.update({ where: { brandId_platform: { brandId: req.brandId, platform: 'flipkart' } }, data: { status: 'syncing' } });
    const [listings, orders] = await Promise.all([
      platformSync.syncFlipkartListings(integration, req.brandId),
      platformSync.importFlipkartOrders(integration, req.brandId),
    ]);
    await prisma.integration.update({ where: { brandId_platform: { brandId: req.brandId, platform: 'flipkart' } }, data: { status: 'connected', lastSyncAt: new Date() } });
    res.json({ ok: true, listings, orders });
  } catch (err) { next(err); }
});

router.delete('/flipkart/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'flipkart' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  MYNTRA — MMIP Developer Centre API
// ═════════════════════════════════════════════════════════════════

router.get('/myntra/auth', requireAuth, (req, res) => {
  if (!process.env.MYNTRA_CLIENT_ID) return res.status(503).json({ error: 'MYNTRA_CLIENT_ID not configured. Apply at mmip.myntrainfo.com for MMIP partner access.' });
  const state = makeState(req.brandId, 'myntra');
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/myntra/callback`);
  const authUrl = `https://api.myntrainfo.com/oauth/authorize?client_id=${process.env.MYNTRA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
  res.json({ authUrl });
});

router.get('/myntra/callback', async (req, res) => {
  const { code, state } = req.query;
  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=myntra&status=error&msg=invalid_state'));
  try {
    const myntraSync = require('../services/myntraSync');
    const tokens = await myntraSync.exchangeCode(code);
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: stateData.brandId, platform: 'myntra' } },
      create: { brandId: stateData.brandId, platform: 'myntra', status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000) },
      update: { status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000) },
    });
    res.redirect(fe('/settings?integration=myntra&status=connected'));
  } catch (err) {
    res.redirect(fe(`/settings?integration=myntra&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

router.post('/myntra/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'myntra' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'Myntra not connected' });
    const myntraSync = require('../services/myntraSync');
    const result = await myntraSync.importOrders(integration, req.brandId);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.delete('/myntra/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'myntra' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  ETSY — Open API v3 OAuth 2.0
// ═════════════════════════════════════════════════════════════════

router.get('/etsy/auth', requireAuth, (req, res) => {
  if (!process.env.ETSY_CLIENT_ID) return res.status(503).json({ error: 'ETSY_CLIENT_ID not configured' });
  const state = makeState(req.brandId, 'etsy');
  // PKCE code verifier stored in state (simplified: use state as verifier for now)
  const codeChallenge = crypto.createHash('sha256').update(state).digest('base64url');
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/etsy/callback`);
  const scopes = encodeURIComponent('transactions_r shops_r');
  const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&client_id=${process.env.ETSY_CLIENT_ID}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  res.json({ authUrl, codeVerifier: state });
});

router.get('/etsy/callback', async (req, res) => {
  const { code, state } = req.query;
  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=etsy&status=error&msg=invalid_state'));
  try {
    const etsySync = require('../services/etsySync');
    const tokens = await etsySync.exchangeCode(code, state);
    // Get shop ID after connecting
    let shopId = null;
    try {
      const shopRes = await fetch('https://openapi.etsy.com/v3/application/users/me/shops', {
        headers: { 'x-api-key': process.env.ETSY_CLIENT_ID, Authorization: `Bearer ${tokens.access_token}` },
      });
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        shopId = shopData.results?.[0]?.shop_id || null;
      }
    } catch (_) {}
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: stateData.brandId, platform: 'etsy' } },
      create: { brandId: stateData.brandId, platform: 'etsy', status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000), metadata: { shopId } },
      update: { status: 'connected', accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000), metadata: { shopId } },
    });
    res.redirect(fe('/settings?integration=etsy&status=connected'));
  } catch (err) {
    res.redirect(fe(`/settings?integration=etsy&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

router.post('/etsy/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'etsy' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'Etsy not connected' });
    const etsySync = require('../services/etsySync');
    const result = await etsySync.importOrders(integration, req.brandId);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.delete('/etsy/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'etsy' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  WOOCOMMERCE — Consumer Key auth (no OAuth redirect)
// ═════════════════════════════════════════════════════════════════

router.post('/woocommerce/connect', requireAuth, async (req, res, next) => {
  try {
    const { siteUrl, consumerKey, consumerSecret } = req.body;
    if (!siteUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({ error: 'siteUrl, consumerKey, and consumerSecret are required' });
    }
    // Verify credentials by fetching a simple endpoint
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const test = await fetch(`${siteUrl.replace(/\/$/, '')}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!test.ok && test.status !== 404) throw new Error(`Could not connect to WooCommerce store: ${test.status}`);

    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: req.brandId, platform: 'woocommerce' } },
      create: { brandId: req.brandId, platform: 'woocommerce', status: 'connected', metadata: { siteUrl, consumerKey, consumerSecret } },
      update: { status: 'connected', metadata: { siteUrl, consumerKey, consumerSecret } },
    });
    res.json({ ok: true, siteUrl });
  } catch (err) { next(err); }
});

router.post('/woocommerce/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'woocommerce' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'WooCommerce not connected' });
    const wooSync = require('../services/woocommerceSync');
    const result = await wooSync.importOrders(integration, req.brandId);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.delete('/woocommerce/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'woocommerce' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  WHATSAPP BUSINESS (Meta)
// ═════════════════════════════════════════════════════════════════

router.get('/whatsapp/auth', requireAuth, (req, res) => {
  if (!process.env.WHATSAPP_APP_ID) return res.status(503).json({ error: 'WHATSAPP_APP_ID not configured' });

  const state = makeState(req.brandId, 'whatsapp');
  const redirectUri = encodeURIComponent(`${APP_URL}/integrations/whatsapp/callback`);
  const scopes = encodeURIComponent('catalog_management,business_management,whatsapp_business_management');
  const authUrl = `https://www.facebook.com/dialog/oauth?client_id=${process.env.WHATSAPP_APP_ID}&redirect_uri=${redirectUri}&scope=${scopes}&state=${state}&response_type=code`;

  res.json({ authUrl });
});

router.get('/whatsapp/callback', async (req, res) => {
  const { code, state } = req.query;

  const stateData = parseState(state);
  if (!stateData) return res.redirect(fe('/settings?integration=whatsapp&status=error&msg=invalid_state'));

  try {
    const tokens = await platformSync.exchangeWhatsAppCode(code);
    const { brandId } = stateData;

    await prisma.integration.upsert({
      where: { brandId_platform: { brandId, platform: 'whatsapp' } },
      create: { brandId, platform: 'whatsapp', status: 'connected', accessToken: tokens.access_token, metadata: {} },
      update: { status: 'connected', accessToken: tokens.access_token },
    });

    res.redirect(fe('/settings?integration=whatsapp&status=connected'));
  } catch (err) {
    res.redirect(fe(`/settings?integration=whatsapp&status=error&msg=${encodeURIComponent(err.message)}`));
  }
});

// Update WhatsApp catalog ID (user provides it from Meta Business Suite)
router.patch('/whatsapp/config', requireAuth, async (req, res, next) => {
  try {
    const { catalogId } = req.body;
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'whatsapp' } } });
    if (!integration) return res.status(400).json({ error: 'WhatsApp not connected' });

    await prisma.integration.update({
      where: { brandId_platform: { brandId: req.brandId, platform: 'whatsapp' } },
      data: { metadata: { ...(integration.metadata || {}), catalogId } },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/whatsapp/sync', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'whatsapp' } } });
    if (!integration || integration.status === 'disconnected') return res.status(400).json({ error: 'WhatsApp not connected' });

    const result = await platformSync.exportWhatsAppCatalog(integration, req.brandId);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

router.delete('/whatsapp/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'whatsapp' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  POS — Generic webhook
// ═════════════════════════════════════════════════════════════════

// Returns a unique webhook URL for this brand
router.get('/pos/webhook-url', requireAuth, async (req, res, next) => {
  try {
    // POS "connection" just stores a brand-specific webhook secret
    let integration = await prisma.integration.findUnique({ where: { brandId_platform: { brandId: req.brandId, platform: 'pos' } } });
    if (!integration) {
      const secret = crypto.randomBytes(24).toString('hex');
      integration = await prisma.integration.create({
        data: { brandId: req.brandId, platform: 'pos', status: 'connected', metadata: { webhookSecret: secret } },
      });
    }
    const secret = integration.metadata?.webhookSecret;
    res.json({
      webhookUrl: `${APP_URL}/integrations/pos/webhook?secret=${secret}`,
      secret,
      payloadExample: {
        orderId: 'POS-001',
        saleDate: new Date().toISOString(),
        items: [{ sku: 'SKU-001', quantity: 1, price: 899, channel: 'pos' }],
      },
    });
  } catch (err) { next(err); }
});

// Public POS webhook endpoint
router.post('/pos/webhook', async (req, res) => {
  const { secret } = req.query;
  if (!secret) return res.status(401).json({ error: 'secret required' });

  const integration = await prisma.integration.findFirst({
    where: { platform: 'pos', status: 'connected' },
  });
  if (!integration || integration.metadata?.webhookSecret !== secret) {
    return res.status(401).json({ error: 'invalid secret' });
  }

  try {
    const result = await platformSync.processPosWebhook(integration.brandId, req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/pos/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'pos' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  TALLY — XML export (no OAuth, just export on demand)
// ═════════════════════════════════════════════════════════════════

router.get('/tally/export', requireAuth, async (req, res, next) => {
  try {
    const xml = await platformSync.generateTallyXml(req.brandId);

    // Mark as "connected" (it's always available, no auth needed)
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: req.brandId, platform: 'tally' } },
      create: { brandId: req.brandId, platform: 'tally', status: 'connected', metadata: {} },
      update: { lastSyncAt: new Date() },
    });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-tally-${Date.now()}.xml"`);
    res.send(xml);
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  MEESHO — CSV import (no public API)
// ═════════════════════════════════════════════════════════════════

// Returns instructions + template CSV
router.get('/meesho/template', requireAuth, (req, res) => {
  const csv = [
    'product_name,sku,size,color,quantity,price,order_id,order_date',
    'Sample Kurti,KUR-001,M,Blue,2,599,MSH-12345,2024-01-15',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="meesho-import-template.csv"');
  res.send(csv);
});

// Mark Meesho as "setup" (CSV-based, just stores connection record)
router.post('/meesho/connect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: req.brandId, platform: 'meesho' } },
      create: { brandId: req.brandId, platform: 'meesho', status: 'connected', metadata: { method: 'spreadsheet' } },
      update: { status: 'connected' },
    });
    res.json({ ok: true, note: 'Meesho uses spreadsheet import. Download template and upload your Meesho order export via Import.' });
  } catch (err) { next(err); }
});

router.delete('/meesho/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'meesho' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST file import for Meesho
router.post('/meesho/import', requireAuth, async (req, res, next) => {
  try {
    await handlePlatformImport(req, res, next, 'meesho');
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════
//  AJIO — CSV import (no public API)
// ═════════════════════════════════════════════════════════════════

router.post('/ajio/connect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: req.brandId, platform: 'ajio' } },
      create: { brandId: req.brandId, platform: 'ajio', status: 'connected', metadata: { method: 'spreadsheet' } },
      update: { status: 'connected' },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/ajio/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'ajio' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST file import for Ajio
router.post('/ajio/import', requireAuth, async (req, res, next) => {
  try {
    await handlePlatformImport(req, res, next, 'ajio');
  } catch (err) { next(err); }
});

// ── Shared platform import handler ──────────────────────────────────────────────

// Platforms that accept multiple report sub-types under one integration key
const MEESHO_REPORT_TYPES = new Set(['meesho', 'meesho_payment']);

// Map parsed platform slug → human-readable report type label
const REPORT_TYPE_LABELS = {
  meesho:         'orders',
  meesho_payment: 'payments',
  ajio:           'orders',
  citymall:       'orders',
};

// Read-then-merge metadata to avoid overwriting other report type entries
async function mergeIntegrationMetadata(brandId, platform, updates) {
  const existing = await prisma.integration.findUnique({
    where: { brandId_platform: { brandId, platform } },
    select: { metadata: true },
  });
  const base = (existing?.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
  const merged = { ...base, ...updates };
  if (base.uploads || updates.uploads) {
    merged.uploads = { ...(base.uploads || {}), ...(updates.uploads || {}) };
  }
  return merged;
}

async function handlePlatformImport(req, res, next, expectedPlatform) {
  const busboy = require('busboy');
  const { parseCSV } = require('../services/csvParser');
  const { upsertPlatformOrders, upsertMeeshoPaymentData } = require('../services/platformDataNormalizer');
  const { invalidateAnalyticsCache } = require('../services/analyticsEngine');
  const brandId = req.brandId;

  let fileBuffer = Buffer.alloc(0);
  let fileFound = false;
  let fileName = '';
  let mimeType = '';

  await new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    bb.on('file', (_field, stream, info) => {
      fileFound = true;
      fileName = info.filename || '';
      mimeType = info.mimeType || info.mimetype || '';
      stream.on('data', chunk => { fileBuffer = Buffer.concat([fileBuffer, chunk]); });
      stream.on('end', () => {});
    });
    bb.on('finish', resolve);
    bb.on('error', reject);
    req.pipe(bb);
  });

  if (!fileFound || fileBuffer.length === 0) {
    return res.status(400).json({ error: 'No file provided' });
  }

  let parsed;
  try {
    parsed = parsePlatformFile(fileBuffer, fileName, mimeType, parseCSV);
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }

  // Allow meesho_payment when the integration platform is meesho (same seller account)
  const platformFamily = expectedPlatform === 'meesho' ? MEESHO_REPORT_TYPES : new Set([expectedPlatform]);
  if (!platformFamily.has(parsed.platform)) {
    return res.status(422).json({
      error: `This looks like a ${parsed.platform} file, not ${expectedPlatform}. Please upload the correct file.`,
    });
  }

  // Route to the appropriate storage function based on detected report type
  let result;
  if (parsed.platform === 'meesho_payment') {
    result = await upsertMeeshoPaymentData(brandId, parsed.orders);
  } else {
    result = await upsertPlatformOrders(brandId, expectedPlatform, parsed.orders);

    // Auto-create Product records for any new SKUs found in order items
    const skuMap = {};
    for (const order of parsed.orders) {
      for (const item of (order.items || [])) {
        if (item.sku && !skuMap[item.sku]) skuMap[item.sku] = item.name || item.sku;
      }
    }
    const skuList = Object.keys(skuMap);
    if (skuList.length > 0) {
      const existing = await prisma.product.findMany({
        where: { brandId, sku: { in: skuList } },
        select: { sku: true },
      });
      const existingSet = new Set(existing.map(p => p.sku));
      const toCreate = skuList.filter(s => !existingSet.has(s));
      if (toCreate.length > 0) {
        await prisma.product.createMany({
          data: toCreate.map(sku => ({ brandId, sku, name: skuMap[sku], category: 'Uncategorized' })),
        });
      }
    }
  }

  const reportType = REPORT_TYPE_LABELS[parsed.platform] || 'records';
  const uploadEntry = { lastAt: new Date().toISOString(), rowCount: parsed.rowCount, insertedCount: result.inserted };
  const mergedMeta = await mergeIntegrationMetadata(brandId, expectedPlatform, {
    method: 'spreadsheet',
    uploads: { [reportType]: uploadEntry },
  });

  await prisma.integration.update({
    where: { brandId_platform: { brandId, platform: expectedPlatform } },
    data: { lastSyncAt: new Date(), metadata: mergedMeta },
  });

  invalidateAnalyticsCache(brandId);
  res.json({ ok: true, inserted: result.inserted, skipped: result.skipped, reportType });
}

function parsePlatformFile(fileBuffer, fileName, mimeType, parseCSV) {
  // Ensure filename is treated as a string (busboy may provide non-string values)
  const fileNameStr = (typeof fileName === 'string') ? fileName : (fileName ? String(fileName) : '');
  let ext = '';
  if (fileNameStr && fileNameStr.includes('.')) {
    ext = fileNameStr.toLowerCase().split('.').pop();
  }

  const header = fileBuffer.slice(0, 8);
  const looksLikeXlsx = /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i.test(mimeType)
    || header.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const looksLikeXls = /application\/vnd\.ms-excel/i.test(mimeType)
    || header.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

  if (looksLikeXlsx || looksLikeXls || ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel file has no worksheet');
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ',', RS: '\n' });
    if (!csv.trim()) throw new Error('Uploaded Excel file is empty');
    return parseCSV(csv);
  }

  if (ext === 'csv' || ext === 'txt') {
    return parseCSV(fileBuffer.toString('utf8'));
  }

  throw new Error('Unsupported file format. Please upload a .csv or .xlsx file.');
}

// ═════════════════════════════════════════════════════════════════
//  CITYMALL — CSV import (social commerce, Tier 2/3 India)
// ═════════════════════════════════════════════════════════════════

router.post('/citymall/connect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.upsert({
      where: { brandId_platform: { brandId: req.brandId, platform: 'citymall' } },
      create: { brandId: req.brandId, platform: 'citymall', status: 'connected', metadata: { method: 'spreadsheet' } },
      update: { status: 'connected' },
    });
    res.json({ ok: true, note: 'CityMall uses spreadsheet import. Export your orders from CityMall Seller App and upload the CSV here.' });
  } catch (err) { next(err); }
});

router.delete('/citymall/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { brandId: req.brandId, platform: 'citymall' } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/citymall/import', requireAuth, async (req, res, next) => {
  try {
    await handlePlatformImport(req, res, next, 'citymall');
  } catch (err) { next(err); }
});

module.exports = router;
