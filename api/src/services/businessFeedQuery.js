/**
 * BusinessFeedQuery — returns the last N inventory events as human-readable feed items.
 *
 * Format: { id, timestamp, description, confidenceDelta, stockLotId, productId, productName }
 */

const prisma = require('../db');

const EVENT_DESCRIPTIONS = {
  import:              (e) => {
    const count = e.payload?.rowCount;
    return count ? `${count} product${count !== 1 ? 's' : ''} added via import` : 'Products imported';
  },
  photo_capture:       (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `Photo captured for ${name}` : 'New photo item captured';
  },
  photo_draft:         (e) => {
    const name = e.payload?.productName || e.stockLot?.product?.name;
    return name ? `Name added to photo draft: ${name}` : 'Photo draft updated';
  },
  manual_entry:        (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `${name} added to inventory` : 'Product added to inventory';
  },
  count:               (e) => {
    const name = e.stockLot?.product?.name;
    const qty = e.payload?.quantity;
    if (name && qty != null) return `Quantity verified for ${name} (${qty} units)`;
    if (name) return `Quantity verified for ${name}`;
    return 'Quantity verified';
  },
  sale:                (e) => {
    const name = e.stockLot?.product?.name;
    const qty = e.payload?.quantity;
    if (name && qty) return `${qty} unit${qty !== 1 ? 's' : ''} sold: ${name}`;
    return 'Sale recorded';
  },
  return:              (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `Return recorded for ${name}` : 'Return recorded';
  },
  adjustment:          (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `Inventory adjusted for ${name}` : 'Inventory adjusted';
  },
  partner_assign:      (e) => {
    const name = e.stockLot?.product?.name;
    const partner = e.payload?.partner;
    if (name && partner) return `${name} assigned to ${partner}`;
    return 'Stock assigned to partner';
  },
  verification:        (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `${name} verified` : 'Item verified';
  },
  conflict_detection:  (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `Conflict detected: ${name} (sources disagree)` : 'Conflict detected';
  },
  conflict_resolution: (e) => {
    const name = e.stockLot?.product?.name;
    return name ? `Conflict resolved for ${name}` : 'Conflict resolved';
  },
};

const EVENT_CONFIDENCE_DELTAS = {
  count:               '+0.5–2%',
  conflict_resolution: '+3–5%',
  manual_entry:        '+0.2%',
  import:              '+varies',
  sale:                null,
  conflict_detection:  '-2–5%',
};

async function getBusinessFeed(brandId, limit = 20) {
  const events = await prisma.inventoryEvent.findMany({
    where: { brandId },
    include: {
      stockLot: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
      createdBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });

  return events.map(e => {
    const descFn = EVENT_DESCRIPTIONS[e.eventType];
    const description = descFn ? descFn(e) : e.eventType.replace(/_/g, ' ');
    const confidenceDelta = EVENT_CONFIDENCE_DELTAS[e.eventType] ?? null;

    return {
      id: e.id,
      timestamp: e.createdAt,
      eventType: e.eventType,
      description,
      confidenceDelta,
      stockLotId: e.stockLotId,
      productId: e.stockLot?.product?.id ?? null,
      productName: e.stockLot?.product?.name ?? null,
      createdBy: e.createdBy?.email ?? null,
    };
  });
}

module.exports = { getBusinessFeed };
