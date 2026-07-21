const PgBoss = require('pg-boss');

let boss;

async function initJobQueue() {
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  });

  await boss.start();

  // Register workers
  const { registerConfidenceWorker } = require('./confidenceBackgroundJob');
  const { registerImportWorker } = require('./importProcessor');

  await registerConfidenceWorker(boss);
  await registerImportWorker(boss);

  // Nightly analytics aggregation — runs at 2am, aggregates all brands
  await boss.schedule('analytics-nightly-aggregation', '0 2 * * *', {});
  await boss.work('analytics-nightly-aggregation', async () => {
    const { runNightlyAggregation } = require('./analyticsEngine');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const brands = await prisma.brand.findMany({ select: { id: true } });
    const results = [];
    for (const brand of brands) {
      try {
        const r = await runNightlyAggregation(brand.id);
        results.push({ brandId: brand.id, ...r });
      } catch (err) {
        console.error(`[analytics-nightly] brandId=${brand.id} failed:`, err.message);
      }
    }
    console.log(`[analytics-nightly] aggregated ${results.length} brands`);
  });

  console.log('[queue] pg-boss started: confidence-score-update, import-process, analytics-nightly-aggregation');
  return boss;
}

function getQueue() {
  if (!boss) throw new Error('Job queue not initialized');
  return boss;
}

module.exports = { initJobQueue, getQueue };
