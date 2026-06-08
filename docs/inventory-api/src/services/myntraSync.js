// Myntra MMIP Developer Centre API (mmip.myntrainfo.com)
// Requires approved Myntra partner status. Set env vars:
//   MYNTRA_CLIENT_ID, MYNTRA_CLIENT_SECRET
// Apply at: mmip.myntrainfo.com/developer

const prisma = require('../db');
const { upsertPlatformOrders } = require('./platformDataNormalizer');
const { withRetry } = require('../utils/retryUtil');

const MYNTRA_TOKEN_URL = 'https://api.myntrainfo.com/oauth/token';
const MYNTRA_API_BASE = 'https://api.myntrainfo.com/v1';

// Myntra MMIP rate limit: ~10 req/min
async function myntraFetch(path, token, options = {}) {
  const res = await withRetry(
    () => fetch(`${MYNTRA_API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    }),
    { label: 'myntra api', baseDelayMs: 6000 }
  );
  if (!res.ok) throw new Error(`Myntra MMIP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function refreshToken(integration) {
  const res = await fetch(MYNTRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
      client_id: process.env.MYNTRA_CLIENT_ID,
      client_secret: process.env.MYNTRA_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Myntra token refresh failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  return { access_token, expiresAt: new Date(Date.now() + expires_in * 1000) };
}

async function exchangeCode(code) {
  const res = await fetch(MYNTRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.MYNTRA_CLIENT_ID,
      client_secret: process.env.MYNTRA_CLIENT_SECRET,
      redirect_uri: `${process.env.APP_URL}/integrations/myntra/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Myntra token exchange failed: ${await res.text()}`);
  return res.json();
}

async function importOrders(integration, brandId) {
  let { accessToken, tokenExpiresAt, syncCursor } = integration;
  if (!accessToken || new Date(tokenExpiresAt) < new Date(Date.now() + 60000)) {
    const refreshed = await refreshToken(integration);
    accessToken = refreshed.access_token;
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'myntra' } },
      data: { accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
  }

  const since = syncCursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let page = 1;
  const platformOrdersBatch = [];
  let latestDate = syncCursor;
  let hasMore = true;

  while (hasMore) {
    const data = await myntraFetch(
      `/orders?from=${encodeURIComponent(since)}&page=${page}&pageSize=50`,
      accessToken
    );

    const orders = data.orders || data.data || [];
    if (orders.length === 0) break;

    for (const order of orders) {
      const status = (order.orderStatus || '').toLowerCase().includes('return') ? 'returned'
        : (order.orderStatus || '').toLowerCase().includes('cancel') ? 'cancelled'
        : 'delivered';

      platformOrdersBatch.push({
        platformOrderId: String(order.orderId || order.id),
        status,
        orderDate: order.orderDate || order.createdAt,
        grossAmount: parseFloat(order.totalAmount || order.grossAmount || 0),
        platformFee: order.commissionAmount ? parseFloat(order.commissionAmount) : null,
        shippingCost: null,
        currency: 'INR',
        items: (order.items || order.orderItems || []).map(item => ({
          sku: item.sku || item.sellerStyleId || null,
          name: item.productName || item.name || null,
          qty: item.quantity || 1,
          unitPrice: parseFloat(item.sellingPrice || item.price || 0),
        })),
        returnReason: order.returnReason || null,
        cancellationReason: order.cancellationReason || null,
        source: 'oauth_sync',
      });

      if (!latestDate || (order.orderDate || '') > latestDate) latestDate = order.orderDate;
    }

    hasMore = data.hasMore || (data.totalPages && page < data.totalPages);
    page++;
  }

  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'myntra', platformOrdersBatch);
  }

  await prisma.integration.update({
    where: { brandId_platform: { brandId, platform: 'myntra' } },
    data: {
      syncCursor: latestDate,
      lastSyncAt: new Date(),
      metadata: { syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() } },
    },
  });

  return { platformOrders: platformOrdersBatch.length };
}

module.exports = { exchangeCode, importOrders };
