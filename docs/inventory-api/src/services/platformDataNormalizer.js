const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Validates and normalizes the items array shape before DB insert
function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map(item => ({
    sku: item.sku || item.SKU || item.variant_sku || null,
    name: item.name || item.title || item.product_name || null,
    qty: Number(item.qty || item.quantity || 1),
    unitPrice: Number(item.unitPrice || item.unit_price || item.price || 0),
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
  }));
}

function mapStatus(raw) {
  const s = (raw || '').toLowerCase();
  if (['return', 'returned', 'rto'].includes(s)) return 'returned';
  if (['cancel', 'cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['refund', 'refunded'].includes(s)) return 'refunded';
  if (['shipped', 'dispatched'].includes(s)) return 'shipped';
  if (['pending', 'open'].includes(s)) return 'pending';
  if (['processing', 'confirmed'].includes(s)) return 'processing';
  return 'delivered';
}

// Upsert a batch of normalized platform orders (dedup on platform_order_id)
async function upsertPlatformOrders(brandId, platform, orders) {
  const results = { inserted: 0, skipped: 0, errors: [] };

  for (const order of orders) {
    try {
      const items = normalizeItems(order.items || order.line_items || []);
      const grossAmount = parseFloat(order.grossAmount || order.gross_amount || order.total_price || 0);
      const platformFee = order.platformFee != null ? parseFloat(order.platformFee) : null;
      const shippingCost = order.shippingCost != null ? parseFloat(order.shippingCost) : null;
      const netRevenue = platformFee != null && shippingCost != null
        ? grossAmount - platformFee - shippingCost
        : platformFee != null
          ? grossAmount - platformFee
          : null;

      await prisma.platformOrder.upsert({
        where: {
          brandId_platform_platformOrderId: {
            brandId,
            platform,
            platformOrderId: String(order.platformOrderId || order.platform_order_id || order.id),
          },
        },
        create: {
          brandId,
          platform,
          platformOrderId: String(order.platformOrderId || order.platform_order_id || order.id),
          status: mapStatus(order.status),
          orderDate: new Date(order.orderDate || order.order_date || order.created_at),
          grossAmount,
          platformFee,
          shippingCost,
          netRevenue,
          currency: order.currency || 'INR',
          items,
          returnReason: order.returnReason || order.return_reason || null,
          cancellationReason: order.cancellationReason || order.cancellation_reason || null,
          customerCity: order.customerCity || order.customer_city || null,
          customerState: order.customerState || order.customer_state || null,
          metadata: order.metadata || {},
          source: order.source || 'oauth_sync',
        },
        update: {
          status: mapStatus(order.status),
          grossAmount,
          platformFee,
          shippingCost,
          netRevenue,
          items,
          returnReason: order.returnReason || order.return_reason || null,
          cancellationReason: order.cancellationReason || order.cancellation_reason || null,
          syncedAt: new Date(),
        },
      });
      results.inserted++;
    } catch (err) {
      results.errors.push({ orderId: order.platformOrderId, error: err.message });
      results.skipped++;
    }
  }

  return results;
}

// Upsert Meesho GSTR/payment rows into PlatformOrder.
// Matches on (brandId, 'meesho', sub_order_num). If a matching order exists,
// enriches it with netRevenue and GST metadata. If not, creates a partial record.
async function upsertMeeshoPaymentData(brandId, payments) {
  const results = { inserted: 0, skipped: 0, errors: [] };

  for (const payment of payments) {
    try {
      const platformOrderId = String(payment.platformOrderId || '');
      if (!platformOrderId) { results.skipped++; continue; }

      const grossAmount = parseFloat(payment.grossAmount || 0);
      const netRevenue  = parseFloat(payment.netRevenue  || 0) || null;
      const shippingCost = payment.shippingCost != null ? parseFloat(payment.shippingCost) : null;

      // Read existing to merge metadata (avoid overwrite)
      const existing = await prisma.platformOrder.findUnique({
        where: { brandId_platform_platformOrderId: { brandId, platform: 'meesho', platformOrderId } },
        select: { metadata: true },
      });

      const existingMeta = (existing?.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
      const mergedMeta = { ...existingMeta, gst: payment.metadata?.gst || {}, gstin: payment.metadata?.gstin || null };

      await prisma.platformOrder.upsert({
        where: { brandId_platform_platformOrderId: { brandId, platform: 'meesho', platformOrderId } },
        create: {
          brandId,
          platform: 'meesho',
          platformOrderId,
          status: payment.status || 'delivered',
          orderDate: new Date(payment.orderDate || Date.now()),
          grossAmount, // total_invoice_value — only data we have on create
          netRevenue,
          shippingCost,
          currency: 'INR',
          items: [],
          metadata: mergedMeta,
          source: 'csv_import',
        },
        update: {
          netRevenue,
          shippingCost,
          metadata: mergedMeta,
          syncedAt: new Date(),
        },
      });
      results.inserted++;
    } catch (err) {
      results.errors.push({ orderId: payment.platformOrderId, error: err.message });
      results.skipped++;
    }
  }

  return results;
}

module.exports = { upsertPlatformOrders, upsertMeeshoPaymentData, normalizeItems, mapStatus };
