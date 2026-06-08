/**
 * ConfidenceBackgroundJob — pg-boss worker that recomputes Business Confidence
 * on any StockLot or SalesRecord write.
 *
 * Registered in jobQueue.js. Triggered by StockLot and SalesRecord route handlers.
 */

const prisma = require('../db');
const { computeConfidence } = require('./confidenceCalculator');

async function handleConfidenceUpdate(job) {
  const { brandId } = job.data;
  if (!brandId) {
    console.warn('[confidence] Job missing brandId, skipping');
    return;
  }

  console.log(`[confidence] Recomputing for brand ${brandId}`);

  try {
    const { score, breakdown } = await computeConfidence(brandId, prisma);

    await prisma.brand.update({
      where: { id: brandId },
      data: {
        confidenceScore:          score,
        confidenceBreakdown:      breakdown,
        confidenceLastComputedAt: new Date(),
      },
    });

    console.log(`[confidence] Brand ${brandId} score: ${score}%`);
  } catch (err) {
    console.error(`[confidence] Failed for brand ${brandId}:`, err.message);
    throw err; // pg-boss will retry up to 3 times with backoff
  }
}

async function registerConfidenceWorker(boss) {
  await boss.work(
    'confidence-score-update',
    { teamSize: 2, teamConcurrency: 1 },
    handleConfidenceUpdate
  );
  console.log('[confidence] Worker registered for confidence-score-update queue');
}

module.exports = { registerConfidenceWorker };
