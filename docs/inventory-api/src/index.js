require('dotenv').config();
const app = require('./app');
const prisma = require('./db');
const { initJobQueue } = require('./services/jobQueue');
const shopifySync = require('./services/shopifySync');

const SYNC_INTERVAL_MS = 60 * 60 * 1000;

async function runShopifySync() {
  try {
    const integrations = await prisma.integration.findMany({
      where: { platform: 'shopify', status: { in: ['connected', 'error'] } },
    });

    const real = integrations.filter(i => !i.metadata?.fakeData);
    if (real.length === 0) return;
    console.log(`[sync] Shopify sync — ${real.length} integration(s)`);

    for (const integration of real) {
      const timer = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('sync timeout after 60s')), 60_000)
      );
      try {
        await Promise.race([shopifySync.importOrders(integration, integration.brandId), timer]);
        // importOrders updates lastSyncAt + syncCursor internally on success
        if (integration.status === 'error') {
          await prisma.integration.update({
            where: { id: integration.id },
            data: { status: 'connected' },
          });
        }
        console.log(`[sync] ✓ brand ${integration.brandId}`);
      } catch (err) {
        console.error(`[sync] ✗ brand ${integration.brandId}:`, err.message);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { status: 'error', metadata: { ...integration.metadata, lastSyncError: err.message } },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[sync] scheduler error:', err.message);
  }
}

const PORT = process.env.PORT || 3001;
let server;
let boss;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('[shutdown] http server closed');
    }

    if (boss) {
      await boss.stop();
      console.log('[shutdown] job queue stopped');
    }

    await prisma.$disconnect();
    console.log('[shutdown] database disconnected');
  } catch (err) {
    console.error('[shutdown] failed:', err);
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2'));
process.once('uncaughtException', (err) => {
  console.error('[startup] uncaughtException:', err);
  shutdown('uncaughtException');
});
process.once('unhandledRejection', (reason) => {
  console.error('[startup] unhandledRejection:', reason);
  shutdown('unhandledRejection');
});

async function start() {
  try {
    await prisma.$connect();
    console.log('[db] connected');

    boss = await initJobQueue();

    server = app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
    });

    // Shopify hourly sync — run once at startup, then every hour
    runShopifySync();
    setInterval(runShopifySync, SYNC_INTERVAL_MS);
    console.log('[sync] Shopify sync scheduler started (1h interval)');

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[startup] port ${PORT} already in use`);
        process.exit(1);
      }
      console.error('[server] error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[startup] failed:', err);
    process.exit(1);
  }
}

start();
