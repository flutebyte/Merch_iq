// WooCommerce REST API — consumer key authentication
// Credentials stored in Integration.metadata: { siteUrl, consumerKey, consumerSecret }

const prisma = require('../db');
const { upsertPlatformOrders } = require('./platformDataNormalizer');
const { withRetry } = require('../utils/retryUtil');

function wooBase(siteUrl) {
  return `${siteUrl.replace(/\/$/, '')}/wp-json/wc/v3`;
}

async function wooFetch(siteUrl, consumerKey, consumerSecret, path, options = {}) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await withRetry(
    () => fetch(`${wooBase(siteUrl)}${path}`, {
      ...options,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    }),
    { label: 'woocommerce api' }
  );
  if (!res.ok) throw new Error(`WooCommerce API ${res.status}: ${await res.text()}`);
  return { json: await res.json(), headers: res.headers };
}

async function importOrders(integration, brandId) {
  const { metadata, syncCursor } = integration;
  const { siteUrl, consumerKey, consumerSecret } = metadata || {};
  if (!siteUrl || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce credentials missing. Add siteUrl, consumerKey, consumerSecret in integration settings.');
  }

  const since = syncCursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let page = 1;
  const platformOrdersBatch = [];
  let latestDate = syncCursor;
  let hasMore = true;

  while (hasMore) {
    const { json: orders, headers } = await wooFetch(
      siteUrl, consumerKey, consumerSecret,
      `/orders?after=${encodeURIComponent(since)}&per_page=100&page=${page}&orderby=date&order=asc`
    );

    if (!orders || orders.length === 0) break;

    for (const order of orders) {
      const status = order.status === 'refunded' ? 'refunded'
        : order.status === 'cancelled' ? 'cancelled'
        : order.status === 'completed' ? 'delivered'
        : order.status === 'processing' ? 'processing'
        : 'delivered';

      platformOrdersBatch.push({
        platformOrderId: String(order.id),
        status,
        orderDate: order.date_created,
        grossAmount: parseFloat(order.total || 0),
        platformFee: null,
        shippingCost: parseFloat(order.shipping_total || 0),
        currency: order.currency || 'INR',
        items: (order.line_items || []).map(item => ({
          sku: item.sku || null,
          name: item.name || null,
          qty: item.quantity || 1,
          unitPrice: parseFloat(item.price || 0),
        })),
        returnReason: null,
        cancellationReason: null,
        customerCity: order.billing?.city || null,
        customerState: order.billing?.state || null,
        source: 'oauth_sync',
      });

      if (!latestDate || order.date_modified > latestDate) latestDate = order.date_modified;
    }

    const totalPages = parseInt(headers.get('x-wp-totalpages') || '1', 10);
    hasMore = page < totalPages;
    page++;
  }

  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'woocommerce', platformOrdersBatch);
  }

  await prisma.integration.update({
    where: { brandId_platform: { brandId, platform: 'woocommerce' } },
    data: {
      syncCursor: latestDate,
      lastSyncAt: new Date(),
      metadata: { ...(metadata || {}), syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() } },
    },
  });

  return { platformOrders: platformOrdersBatch.length };
}

module.exports = { importOrders };
