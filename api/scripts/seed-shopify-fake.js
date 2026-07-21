/**
 * Seed script: inject fake Shopify integration + orders to test analytics
 * without a real Shopify domain.
 *
 * Usage: node scripts/seed-shopify-fake.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FAKE_SHOP = 'demo-store.myshopify.com';
const FAKE_TOKEN = 'shpua_fake_access_token_for_testing_only';

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

const PRODUCTS = [
  { id: '9001', title: 'Printed Anarkali Kurti', type: 'Kurtis', sku: 'ANK-001', price: '799' },
  { id: '9002', title: 'Block Print Cotton Saree', type: 'Sarees', sku: 'SAR-002', price: '1299' },
  { id: '9003', title: 'Embroidered Palazzo Set', type: 'Sets', sku: 'PLZ-003', price: '1499' },
  { id: '9004', title: 'Rayon Flared Dress', type: 'Dresses', sku: 'DRS-004', price: '649' },
  { id: '9005', title: 'Silk Chanderi Dupatta', type: 'Dupattas', sku: 'DUP-005', price: '399' },
  { id: '9006', title: 'Tie-Dye Crop Top', type: 'Tops', sku: 'TOP-006', price: '449' },
  { id: '9007', title: 'Phulkari Jacket', type: 'Jackets', sku: 'JKT-007', price: '999' },
  { id: '9008', title: 'Cotton Leggings (3-pack)', type: 'Bottoms', sku: 'LEG-008', price: '349' },
];

async function main() {
  // 1. Get first brand
  const brand = await prisma.brand.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!brand) { console.error('No brand found — sign up in the app first'); process.exit(1); }
  console.log(`Using brand: ${brand.name} (${brand.id})`);

  // 2. Upsert Shopify integration (mark as connected, no real token needed)
  await prisma.integration.upsert({
    where: { brandId_platform: { brandId: brand.id, platform: 'shopify' } },
    create: {
      brandId: brand.id, platform: 'shopify', status: 'connected',
      accessToken: FAKE_TOKEN, shopDomain: FAKE_SHOP,
      lastSyncAt: new Date(),
      metadata: { scope: 'read_products,read_orders', fakeData: true },
    },
    update: {
      status: 'connected', accessToken: FAKE_TOKEN, shopDomain: FAKE_SHOP,
      lastSyncAt: new Date(),
      metadata: { scope: 'read_products,read_orders', fakeData: true },
    },
  });
  console.log(`✓ Shopify integration created (${FAKE_SHOP})`);

  // 3. Upsert products with shopify externalIds
  const productIds = {};
  for (const p of PRODUCTS) {
    const extIds = { shopify: p.id };
    let existing = await prisma.product.findFirst({
      where: { brandId: brand.id, sku: p.sku },
    });
    if (!existing) {
      existing = await prisma.product.create({
        data: {
          brandId: brand.id, name: p.title, sku: p.sku,
          category: p.type, sellingPrice: parseFloat(p.price),
          externalIds: extIds,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: { externalIds: { ...existing.externalIds, shopify: p.id } },
      });
    }
    productIds[p.id] = existing.id;
    console.log(`  ✓ Product: ${p.title} (${p.sku})`);
  }

  // 4. Generate 90 days of fake Shopify platform_orders
  let ordersCreated = 0;
  let orderId = 5000100;

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const orderDate = daysAgo(dayOffset);
    const ordersToday = rnd(2, 8);

    for (let i = 0; i < ordersToday; i++) {
      const product = PRODUCTS[rnd(0, PRODUCTS.length - 1)];
      const qty = rnd(1, 3);
      const price = parseFloat(product.price);
      const gross = price * qty;
      const shipping = rnd(0, 1) === 1 ? rnd(40, 120) : 0;
      const statuses = ['delivered', 'delivered', 'delivered', 'cancelled', 'refunded'];
      const status = statuses[rnd(0, statuses.length - 1)];
      const pid = `SHOP-${orderId++}`;

      const existingOrder = await prisma.platformOrder.findFirst({
        where: { brandId: brand.id, platform: 'shopify', platformOrderId: pid },
      });
      if (existingOrder) continue;

      await prisma.platformOrder.create({
        data: {
          brandId: brand.id,
          platform: 'shopify',
          platformOrderId: pid,
          status,
          orderDate,
          grossAmount: gross,
          shippingCost: shipping,
          netRevenue: gross * 0.92,
          currency: 'INR',
          items: [{ sku: product.sku, name: product.title, qty, unitPrice: price }],
          customerCity: ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Surat'][rnd(0, 5)],
          customerState: ['Maharashtra', 'Delhi', 'Karnataka', 'Maharashtra', 'Telangana', 'Gujarat'][rnd(0, 5)],
          metadata: { orderNumber: orderId - 1 },
          source: 'fake_seed',
        },
      });
      ordersCreated++;

      // Also write SalesRecord for delivered orders
      if (status === 'delivered' && productIds[product.id]) {
        const extId = `shopify:${pid}:item1`;
        const dup = await prisma.salesRecord.findFirst({
          where: { brandId: brand.id, externalOrderId: extId },
        });
        if (!dup) {
          await prisma.salesRecord.create({
            data: {
              brandId: brand.id,
              productId: productIds[product.id],
              quantity: qty,
              price: price,
              channel: 'shopify',
              date: orderDate,
              externalOrderId: extId,
              source: 'sales_sync',
              confidence: 'high',
              notes: `Fake Shopify order #${orderId - 1}`,
            },
          });
        }
      }
    }
  }

  console.log(`✓ ${ordersCreated} platform orders created (90-day history)`);
  console.log('\nDone! Shopify integration now has realistic fake data.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
