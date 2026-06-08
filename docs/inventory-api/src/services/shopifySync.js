const prisma = require('../db');
const { invalidateCache } = require('./actionQueueGenerator');
const { upsertPlatformOrders } = require('./platformDataNormalizer');
const { withRetry } = require('../utils/retryUtil');

const API_VERSION = '2024-01';

function shopifyBase(shop) {
  return `https://${shop}/admin/api/${API_VERSION}`;
}

async function shopifyFetch(shop, token, path, options = {}) {
  const res = await fetch(`${shopifyBase(shop)}${path}`, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status}: ${text.slice(0, 200)}`);
  }
  return { json: await res.json(), headers: res.headers };
}

// Fetch all products across pages
async function fetchAllProducts(shop, token) {
  const products = [];
  let url = `${shopifyBase(shop)}/products.json?limit=250&fields=id,title,product_type,variants,images,tags,status`;

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
    if (!res.ok) break;
    const data = await res.json();
    products.push(...(data.products || []));
    const link = res.headers.get('link');
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return products;
}

async function syncProducts(integration, brandId) {
  const { accessToken, shopDomain } = integration;
  const shopifyProducts = await fetchAllProducts(shopDomain, accessToken);

  let created = 0, updated = 0;

  for (const sp of shopifyProducts) {
    if (sp.status === 'archived') continue;

    const variant = sp.variants?.[0];
    const imageUrl = sp.images?.[0]?.src || null;
    const price = variant?.price ? parseFloat(variant.price) : null;
    const sku = variant?.sku?.trim() || null;
    const shopifyId = sp.id.toString();

    // Find existing: by SKU first, then by externalIds.shopify
    let existing = null;
    if (sku) {
      existing = await prisma.product.findFirst({
        where: { brandId, sku: { equals: sku, mode: 'insensitive' } },
      });
    }
    if (!existing) {
      const rows = await prisma.$queryRaw`
        SELECT id FROM products
        WHERE brand_id = ${brandId}::uuid
        AND external_ids ->> 'shopify' = ${shopifyId}
        LIMIT 1
      `;
      if (rows.length > 0) {
        existing = await prisma.product.findUnique({ where: { id: rows[0].id } });
      }
    }

    const extIds = { ...(existing?.externalIds || {}), shopify: shopifyId };
    const payload = {
      name: sp.title,
      category: sp.product_type || existing?.category || null,
      sku: sku || existing?.sku || null,
      sellingPrice: price,
      images: imageUrl ? [imageUrl] : (existing?.images || []),
      externalIds: extIds,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.product.create({ data: { brandId, ...payload } });
      created++;
    }
  }

  invalidateCache(brandId);
  return { total: shopifyProducts.length, created, updated };
}

async function importOrders(integration, brandId) {
  const { accessToken, shopDomain, syncCursor } = integration;

  const params = new URLSearchParams({ limit: '250', status: 'any' });
  const since = syncCursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  params.set(syncCursor ? 'updated_at_min' : 'created_at_min', since);

  let url = `${shopifyBase(shopDomain)}/orders.json?${params}`;
  let imported = 0;
  let latestUpdatedAt = syncCursor;
  const platformOrdersBatch = [];

  while (url) {
    const res = await withRetry(
      () => fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } }),
      { label: 'shopify orders' }
    );
    if (!res.ok) break;

    const { orders } = await res.json();

    for (const order of (orders || [])) {
      if (order.updated_at > (latestUpdatedAt || '')) latestUpdatedAt = order.updated_at;

      // Write to platform_orders (one record per order, all items in json)
      platformOrdersBatch.push({
        platformOrderId: String(order.id),
        status: order.financial_status === 'refunded' ? 'refunded'
          : order.cancelled_at ? 'cancelled'
          : order.fulfillment_status === 'fulfilled' ? 'delivered'
          : 'processing',
        orderDate: order.created_at,
        grossAmount: parseFloat(order.total_price || 0),
        platformFee: null, // Shopify doesn't expose fee per order
        shippingCost: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0) || null,
        currency: order.currency || 'INR',
        items: (order.line_items || []).map(item => ({
          sku: item.sku || null,
          name: item.title,
          qty: item.quantity,
          unitPrice: parseFloat(item.price || 0),
        })),
        returnReason: null,
        cancellationReason: order.cancel_reason || null,
        customerCity: order.shipping_address?.city || null,
        customerState: order.shipping_address?.province || null,
        metadata: { orderNumber: order.order_number },
        source: 'oauth_sync',
      });

      // Also write individual line items to SalesRecord for backward compat
      for (const item of (order.line_items || [])) {
        if (!item.product_id) continue;
        const externalOrderId = `shopify:${order.id}:${item.id}`;
        const dup = await prisma.salesRecord.findFirst({ where: { brandId, externalOrderId } });
        if (dup) continue;
        const rows = await prisma.$queryRaw`
          SELECT id FROM products WHERE brand_id = ${brandId}::uuid
          AND external_ids ->> 'shopify' = ${item.product_id.toString()} LIMIT 1
        `;
        if (rows.length === 0) continue;
        await prisma.salesRecord.create({
          data: {
            brandId, productId: rows[0].id,
            quantity: item.quantity,
            price: item.price ? parseFloat(item.price) : null,
            channel: 'shopify',
            date: new Date(order.created_at),
            externalOrderId, source: 'sales_sync', confidence: 'high',
            notes: `Shopify order #${order.order_number}`,
          },
        });
        imported++;
      }
    }

    const link = res.headers.get('link');
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }

  // Upsert all orders into platform_orders
  if (platformOrdersBatch.length > 0) {
    await upsertPlatformOrders(brandId, 'shopify', platformOrdersBatch);
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'shopify' } },
      data: {
        metadata: {
          ...((await prisma.integration.findUnique({ where: { brandId_platform: { brandId, platform: 'shopify' } } }))?.metadata || {}),
          syncStats: { lastOrderCount: platformOrdersBatch.length, lastSyncAt: new Date().toISOString() },
        },
      },
    });
  }

  if (latestUpdatedAt) {
    await prisma.integration.update({
      where: { brandId_platform: { brandId, platform: 'shopify' } },
      data: { syncCursor: latestUpdatedAt, lastSyncAt: new Date() },
    });
  }

  invalidateCache(brandId);
  return { imported, platformOrders: platformOrdersBatch.length };
}

async function registerWebhooks(shop, token, appUrl) {
  const topics = [
    'orders/create',
    'orders/updated',
    'products/update',
    'products/delete',
  ];

  for (const topic of topics) {
    try {
      await shopifyFetch(shop, token, '/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            topic,
            address: `${appUrl}/integrations/shopify/webhooks/${topic.replace('/', '_')}`,
            format: 'json',
          },
        }),
      });
    } catch (err) {
      // 422 = already registered; safe to ignore
      if (!err.message.includes('422')) console.warn(`Webhook ${topic}:`, err.message);
    }
  }
}

module.exports = { syncProducts, importOrders, registerWebhooks };
