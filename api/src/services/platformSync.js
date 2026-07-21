/**
 * Sync services for Amazon SP-API, Flipkart, WhatsApp Business,
 * Generic POS webhook, and Tally XML export.
 *
 * Each platform has its own auth exchange + sync function.
 * All functions accept an `integration` row from the DB and a `brandId`.
 */

const prisma = require('../db');
const { invalidateCache } = require('./actionQueueGenerator');
const { upsertPlatformOrders } = require('./platformDataNormalizer');
const { withRetry } = require('../utils/retryUtil');

// ── Amazon SP-API ──────────────────────────────────────────────────────────────

const AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
// India marketplace
const AMAZON_SPAPI_BASE = 'https://sellingpartnerapi-fe.amazon.com';
const AMAZON_MARKETPLACE_ID = 'A21TJRUUN4KGV'; // Amazon India

async function amazonRefreshToken(integration) {
  const res = await fetch(AMAZON_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Amazon token refresh failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  return { access_token, expiresAt: new Date(Date.now() + expires_in * 1000) };
}

async function amazonFetch(path, token, options = {}) {
  const res = await fetch(`${AMAZON_SPAPI_BASE}${path}`, {
    ...options,
    headers: {
      'x-amz-access-token': token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Amazon SP-API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function exchangeAmazonCode(code) {
  const res = await fetch(AMAZON_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET,
      redirect_uri: `${process.env.APP_URL}/integrations/amazon/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Amazon token exchange failed: ${await res.text()}`);
  return res.json();
}

async function syncAmazonProducts(integration, brandId) {
  let { accessToken, tokenExpiresAt } = integration;
  if (!accessToken || new Date(tokenExpiresAt) < new Date(Date.now() + 60000)) {
    const refreshed = await amazonRefreshToken(integration);
    accessToken = refreshed.access_token;
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'amazon' } },
      data: { accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
  }

  let synced = 0;
  let nextToken = null;

  do {
    const params = new URLSearchParams({
      marketplaceIds: AMAZON_MARKETPLACE_ID,
      pageSize: '20',
      includedData: 'summaries,attributes',
    });
    if (nextToken) params.set('pageToken', nextToken);

    const data = await amazonFetch(`/catalog/2022-04-01/items?${params}`, accessToken);

    for (const item of (data.items || [])) {
      const asin = item.asin;
      const summary = item.summaries?.[0];
      if (!summary) continue;

      const rows = await prisma.$queryRaw`
        SELECT id FROM products
        WHERE brand_id = ${brandId}::uuid
        AND external_ids ->> 'amazon' = ${asin}
        LIMIT 1
      `;

      const payload = {
        name: summary.itemName,
        category: summary.productType || null,
        images: summary.mainImage?.link ? [summary.mainImage.link] : [],
        externalIds: { amazon: asin },
      };

      if (rows.length > 0) {
        const existing = await prisma.product.findUnique({ where: { id: rows[0].id } });
        await prisma.product.update({
          where: { id: rows[0].id },
          data: { ...payload, externalIds: { ...(existing?.externalIds || {}), amazon: asin } },
        });
      } else {
        await prisma.product.create({ data: { brandId, ...payload } });
      }
      synced++;
    }

    nextToken = data.nextToken || null;
  } while (nextToken);

  invalidateCache(brandId);
  return { synced };
}

async function importAmazonOrders(integration, brandId) {
  let { accessToken, tokenExpiresAt, syncCursor } = integration;
  if (!accessToken || new Date(tokenExpiresAt) < new Date(Date.now() + 60000)) {
    const refreshed = await amazonRefreshToken(integration);
    accessToken = refreshed.access_token;
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'amazon' } },
      data: { accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
  }

  const since = syncCursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    MarketplaceIds: AMAZON_MARKETPLACE_ID,
    CreatedAfter: since,
    OrderStatuses: 'Shipped,Unshipped,PartiallyShipped,Canceled',
  });

  let imported = 0;
  let nextToken = null;
  let latestDate = syncCursor;
  const platformOrdersBatch = [];

  do {
    if (nextToken) params.set('NextToken', nextToken);
    // Amazon SP-API: ~0.5 req/s on orders endpoint — use retry for 429s
    const data = await withRetry(
      () => amazonFetch(`/orders/v0/orders?${params}`, accessToken),
      { label: 'amazon orders', baseDelayMs: 2000 }
    );

    for (const order of (data.payload?.Orders || [])) {
      const itemsData = await withRetry(
        () => amazonFetch(`/orders/v0/orders/${order.AmazonOrderId}/orderItems`, accessToken),
        { label: 'amazon order items', baseDelayMs: 2000 }
      );

      const items = (itemsData.payload?.OrderItems || []).map(item => ({
        sku: item.SellerSKU || null,
        name: item.Title || null,
        qty: parseInt(item.QuantityOrdered, 10) || 1,
        unitPrice: item.ItemPrice?.Amount ? parseFloat(item.ItemPrice.Amount) / (parseInt(item.QuantityOrdered, 10) || 1) : 0,
      }));

      platformOrdersBatch.push({
        platformOrderId: order.AmazonOrderId,
        status: order.OrderStatus === 'Canceled' ? 'cancelled' : 'delivered',
        orderDate: order.PurchaseDate,
        grossAmount: parseFloat(order.OrderTotal?.Amount || 0),
        platformFee: null,
        shippingCost: null,
        currency: order.OrderTotal?.CurrencyCode || 'INR',
        items,
        returnReason: null,
        cancellationReason: null,
        customerCity: order.ShippingAddress?.City || null,
        customerState: order.ShippingAddress?.StateOrRegion || null,
        metadata: { orderStatus: order.OrderStatus },
        source: 'oauth_sync',
      });

      // SalesRecord backward compat (non-canceled only)
      if (order.OrderStatus !== 'Canceled') {
        for (const item of (itemsData.payload?.OrderItems || [])) {
          const externalOrderId = `amazon:${order.AmazonOrderId}:${item.OrderItemId}`;
          const dup = await prisma.salesRecord.findFirst({ where: { brandId, externalOrderId } });
          if (dup) continue;
          const rows = await prisma.$queryRaw`
            SELECT id FROM products WHERE brand_id = ${brandId}::uuid
            AND external_ids ->> 'amazon' = ${item.ASIN} LIMIT 1
          `;
          if (rows.length === 0) continue;
          await prisma.salesRecord.create({
            data: {
              brandId, productId: rows[0].id,
              quantity: parseInt(item.QuantityOrdered, 10) || 1,
              price: item.ItemPrice?.Amount ? parseFloat(item.ItemPrice.Amount) / (parseInt(item.QuantityOrdered, 10) || 1) : null,
              channel: 'amazon', date: new Date(order.PurchaseDate),
              externalOrderId, source: 'sales_sync', confidence: 'high',
              notes: `Amazon order ${order.AmazonOrderId}`,
            },
          });
          imported++;
        }
      }

      if (!latestDate || order.PurchaseDate > latestDate) latestDate = order.PurchaseDate;
    }

    nextToken = data.payload?.NextToken || null;
  } while (nextToken);

  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'amazon', platformOrdersBatch);
  }

  if (latestDate) {
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'amazon' } },
      data: {
        syncCursor: latestDate,
        lastSyncAt: new Date(),
        metadata: { syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() } },
      },
    });
  }

  invalidateCache(brandId);
  return { imported, platformOrders: platformOrdersBatch.length };
}

// ── Flipkart Seller API ────────────────────────────────────────────────────────

const FLIPKART_TOKEN_URL = 'https://api.flipkart.net/oauth-service/oauth/token';
const FLIPKART_API_BASE = 'https://api.flipkart.net/sellers';

async function exchangeFlipkartCode(code) {
  const creds = Buffer.from(`${process.env.FLIPKART_CLIENT_ID}:${process.env.FLIPKART_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(FLIPKART_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.APP_URL}/integrations/flipkart/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Flipkart token exchange failed: ${await res.text()}`);
  return res.json();
}

async function flipkartFetch(path, token, options = {}) {
  const res = await fetch(`${FLIPKART_API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Flipkart API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function syncFlipkartListings(integration, brandId) {
  const { accessToken } = integration;
  const data = await flipkartFetch('/skus/filter?state=ACTIVE', accessToken, { method: 'POST', body: JSON.stringify({}) });

  let synced = 0;
  for (const listing of (data.skuItems || [])) {
    const fsn = listing.fsn;
    const rows = await prisma.$queryRaw`
      SELECT id FROM products WHERE brand_id = ${brandId}::uuid AND external_ids ->> 'flipkart' = ${fsn} LIMIT 1
    `;

    const payload = { name: listing.title || null, sku: listing.sellerSkuId || null, externalIds: { flipkart: fsn } };

    if (rows.length > 0) {
      const ex = await prisma.product.findUnique({ where: { id: rows[0].id } });
      await prisma.product.update({ where: { id: rows[0].id }, data: { ...payload, externalIds: { ...(ex?.externalIds || {}), flipkart: fsn } } });
    } else {
      await prisma.product.create({ data: { brandId, ...payload } });
    }
    synced++;
  }

  invalidateCache(brandId);
  return { synced };
}

async function importFlipkartOrders(integration, brandId) {
  const { accessToken, syncCursor } = integration;
  const since = syncCursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const data = await flipkartFetch(
    `/orders/filter?states=APPROVED,SHIPPED,DELIVERED,CANCELLED,RETURNED&modifiedSince=${since}`,
    accessToken,
    { method: 'POST', body: JSON.stringify({}) }
  );

  let imported = 0;
  let latestDate = syncCursor;
  const platformOrdersBatch = [];

  // Flipkart returns per-item, group by orderId
  const orderMap = new Map();
  for (const item of (data.orderItems || [])) {
    if (!orderMap.has(item.orderId)) {
      orderMap.set(item.orderId, { order: item, items: [] });
    }
    orderMap.get(item.orderId).items.push(item);
  }

  for (const { order, items } of orderMap.values()) {
    const status = (order.orderStatus || '').toLowerCase() === 'cancelled' ? 'cancelled'
      : (order.orderStatus || '').toLowerCase() === 'returned' ? 'returned'
      : 'delivered';

    platformOrdersBatch.push({
      platformOrderId: String(order.orderId),
      status,
      orderDate: order.orderDate,
      grossAmount: items.reduce((s, i) => s + parseFloat(i.sellingPrice || 0), 0),
      platformFee: null,
      shippingCost: null,
      currency: 'INR',
      items: items.map(i => ({
        sku: i.sellerSkuId || null,
        name: i.productTitle || null,
        qty: i.quantity || 1,
        unitPrice: parseFloat(i.sellingPrice || 0),
      })),
      returnReason: order.returnReason || null,
      cancellationReason: order.cancellationReason || null,
      source: 'oauth_sync',
    });

    // SalesRecord backward compat
    for (const item of items) {
      const externalOrderId = `flipkart:${order.orderId}:${item.orderItemId}`;
      const dup = await prisma.salesRecord.findFirst({ where: { brandId, externalOrderId } });
      if (dup) continue;
      const rows = await prisma.$queryRaw`
        SELECT id FROM products WHERE brand_id = ${brandId}::uuid AND external_ids ->> 'flipkart' = ${item.fsn} LIMIT 1
      `;
      if (rows.length === 0) continue;
      await prisma.salesRecord.create({
        data: {
          brandId, productId: rows[0].id,
          quantity: item.quantity || 1,
          price: item.sellingPrice ? parseFloat(item.sellingPrice) : null,
          channel: 'flipkart', date: new Date(order.orderDate),
          externalOrderId, source: 'sales_sync', confidence: 'high',
          notes: `Flipkart order ${order.orderId}`,
        },
      });
      imported++;
    }

    if (!latestDate || order.modifiedDate > latestDate) latestDate = order.modifiedDate;
  }

  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'flipkart', platformOrdersBatch);
  }

  if (latestDate) {
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'flipkart' } },
      data: {
        syncCursor: latestDate,
        lastSyncAt: new Date(),
        metadata: { syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() } },
      },
    });
  }

  invalidateCache(brandId);
  return { imported, platformOrders: platformOrdersBatch.length };
}

// ── WhatsApp Business (Meta Graph API) ────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v18.0';

async function exchangeWhatsAppCode(code) {
  const res = await fetch(`${META_GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.WHATSAPP_APP_ID,
      client_secret: process.env.WHATSAPP_APP_SECRET,
      redirect_uri: `${process.env.APP_URL}/integrations/whatsapp/callback`,
      code,
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp token exchange failed: ${await res.text()}`);
  return res.json();
}

async function exportWhatsAppCatalog(integration, brandId) {
  const { accessToken, metadata } = integration;
  const catalogId = metadata?.catalogId;
  if (!catalogId) throw new Error('WhatsApp catalog ID not configured. Set it in integration metadata.');

  const products = await prisma.product.findMany({
    where: { brandId, name: { not: null }, sellingPrice: { not: null } },
    take: 1000,
  });

  let exported = 0;
  for (const p of products) {
    try {
      const res = await fetch(`${META_GRAPH_BASE}/${catalogId}/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailer_id: p.sku || p.id,
          name: p.name,
          description: [p.category, p.color, p.size].filter(Boolean).join(', ') || p.name,
          price: p.sellingPrice ? Math.round(parseFloat(p.sellingPrice) * 100) : undefined,
          currency: 'INR',
          availability: 'in stock',
          image_url: p.images?.[0] || undefined,
        }),
      });
      if (res.ok) exported++;
    } catch (_) {}
  }

  await prisma.integration.update({
    where: { brandId_platform: { brandId, platform: 'whatsapp' } },
    data: { lastSyncAt: new Date() },
  });

  return { exported, total: products.length };
}

// ── POS System (generic webhook) ──────────────────────────────────────────────

async function processPosWebhook(brandId, payload) {
  // Generic POS payload format:
  // { items: [{ sku, quantity, price, channel }], saleDate, orderId }
  const { items = [], saleDate, orderId } = payload;
  let imported = 0;

  for (const item of items) {
    if (!item.sku || !item.quantity) continue;

    const product = await prisma.product.findFirst({
      where: { brandId, sku: { equals: item.sku, mode: 'insensitive' } },
    });
    if (!product) continue;

    const externalOrderId = `pos:${orderId || Date.now()}:${item.sku}`;
    const dup = await prisma.salesRecord.findFirst({ where: { brandId, externalOrderId } });
    if (dup) continue;

    await prisma.salesRecord.create({
      data: {
        brandId, productId: product.id,
        quantity: item.quantity,
        price: item.price ? parseFloat(item.price) : null,
        channel: item.channel || 'pos',
        date: saleDate ? new Date(saleDate) : new Date(),
        externalOrderId, source: 'sales_sync', confidence: 'high',
      },
    });
    imported++;
  }

  invalidateCache(brandId);
  return { imported };
}

// ── Tally XML Export ───────────────────────────────────────────────────────────

async function generateTallyXml(brandId) {
  const products = await prisma.product.findMany({
    where: { brandId },
    include: { stockLots: { where: { inventoryStatus: 'main_stock', quantity: { gt: 0 } } } },
  });

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<ENVELOPE>');
  lines.push('  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>');
  lines.push('  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Stock Items</REPORTNAME></REQUESTDESC><REQUESTDATA>');
  lines.push('    <TALLYMESSAGE xmlns:UDF="TallyUDF">');

  for (const p of products) {
    const qty = p.stockLots.reduce((s, l) => s + (l.quantity || 0), 0);
    if (qty === 0) continue;
    lines.push(`      <STOCKITEM NAME="${xmlEscape(p.name || p.sku || p.id)}" ACTION="Create">`);
    lines.push(`        <NAME>${xmlEscape(p.name || p.sku || p.id)}</NAME>`);
    if (p.category) lines.push(`        <PARENT>${xmlEscape(p.category)}</PARENT>`);
    lines.push(`        <OPENINGBALANCE>${qty}</OPENINGBALANCE>`);
    if (p.sellingPrice) lines.push(`        <STANDARDCOST>${parseFloat(p.sellingPrice).toFixed(2)}</STANDARDCOST>`);
    lines.push('      </STOCKITEM>');
  }

  lines.push('    </TALLYMESSAGE>');
  lines.push('  </REQUESTDATA></IMPORTDATA></BODY>');
  lines.push('</ENVELOPE>');

  return lines.join('\n');
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  exchangeAmazonCode, syncAmazonProducts, importAmazonOrders,
  exchangeFlipkartCode, syncFlipkartListings, importFlipkartOrders,
  exchangeWhatsAppCode, exportWhatsAppCatalog,
  processPosWebhook,
  generateTallyXml,
};
