// Etsy Open API v3 — OAuth 2.0
// Credentials: ETSY_CLIENT_ID, ETSY_CLIENT_SECRET
// Docs: https://developers.etsy.com/documentation

const prisma = require('../db');
const { upsertPlatformOrders } = require('./platformDataNormalizer');
const { withRetry } = require('../utils/retryUtil');

const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const ETSY_API_BASE = 'https://openapi.etsy.com/v3';

async function etsyFetch(path, token, options = {}) {
  const res = await withRetry(
    () => fetch(`${ETSY_API_BASE}${path}`, {
      ...options,
      headers: { 'x-api-key': process.env.ETSY_CLIENT_ID, Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    }),
    { label: 'etsy api' }
  );
  if (!res.ok) throw new Error(`Etsy API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function refreshToken(integration) {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ETSY_CLIENT_ID,
      refresh_token: integration.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Etsy token refresh failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  return { access_token, expiresAt: new Date(Date.now() + expires_in * 1000) };
}

async function exchangeCode(code, codeVerifier) {
  const res = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ETSY_CLIENT_ID,
      redirect_uri: `${process.env.APP_URL}/integrations/etsy/callback`,
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`Etsy token exchange failed: ${await res.text()}`);
  return res.json();
}

async function importOrders(integration, brandId) {
  let { accessToken, tokenExpiresAt, syncCursor, metadata } = integration;
  if (!accessToken || new Date(tokenExpiresAt) < new Date(Date.now() + 60000)) {
    const refreshed = await refreshToken(integration);
    accessToken = refreshed.access_token;
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'etsy' } },
      data: { accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
  }

  const shopId = metadata?.shopId;
  if (!shopId) throw new Error('Etsy shop ID not found. Reconnect to re-authorize.');

  const minCreated = syncCursor
    ? Math.floor(new Date(syncCursor).getTime() / 1000)
    : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  let offset = 0;
  const limit = 100;
  const platformOrdersBatch = [];
  let latestDate = syncCursor;
  let hasMore = true;

  while (hasMore) {
    const data = await etsyFetch(
      `/application/shops/${shopId}/receipts?min_created=${minCreated}&limit=${limit}&offset=${offset}&was_paid=true`,
      accessToken
    );

    const receipts = data.results || [];
    if (receipts.length === 0) break;

    for (const receipt of receipts) {
      const status = receipt.status === 'refunded' ? 'refunded'
        : receipt.is_gift_wrap_price ? 'delivered'
        : 'delivered';

      platformOrdersBatch.push({
        platformOrderId: String(receipt.receipt_id),
        status,
        orderDate: new Date(receipt.create_timestamp * 1000).toISOString(),
        grossAmount: (receipt.grandtotal?.amount || 0) / 100,
        platformFee: null,
        shippingCost: (receipt.total_shipping_cost?.amount || 0) / 100,
        currency: receipt.grandtotal?.divisor === 100 ? (receipt.currency_code || 'USD') : 'USD',
        items: (receipt.transactions || []).map(tx => ({
          sku: tx.sku || null,
          name: tx.title || null,
          qty: tx.quantity || 1,
          unitPrice: (tx.price?.amount || 0) / 100,
        })),
        returnReason: null,
        cancellationReason: null,
        customerCity: receipt.buyer_address?.city || null,
        customerState: receipt.buyer_address?.state || null,
        source: 'oauth_sync',
      });

      const ts = new Date(receipt.create_timestamp * 1000).toISOString();
      if (!latestDate || ts > latestDate) latestDate = ts;
    }

    hasMore = receipts.length === limit;
    offset += limit;
  }

  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'etsy', platformOrdersBatch);
  }

  await prisma.integration.update({
    where: { brandId_platform: { brandId, platform: 'etsy' } },
    data: {
      syncCursor: latestDate,
      lastSyncAt: new Date(),
      metadata: { ...(metadata || {}), syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() } },
    },
  });

  return { platformOrders: platformOrdersBatch.length };
}

module.exports = { exchangeCode, importOrders };
