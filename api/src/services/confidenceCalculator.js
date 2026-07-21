/**
 * ConfidenceCalculator — implements Business Confidence formula from spec §16.4.
 *
 * Returns a score (0–100) and a structured breakdown JSON.
 */

const STATE_WEIGHTS = {
  count_verified:      1.00,
  sales_reconciled:    0.95,
  manually_entered:    0.70,
  imported_unverified: 0.50,
  draft_photo:         0.20,
  photo_only:          0.10,
  conflict_detected:   0.00,
};

const CERTAINTY_FACTORS = {
  exact:       1.0,
  approximate: 0.7,
  unknown:     null, // excluded from denominator
};

/**
 * Compute Business Confidence score and breakdown for a brand.
 *
 * @param {string} brandId
 * @param {object} prisma - Prisma client
 * @returns {{ score: number, breakdown: object }}
 */
async function computeConfidence(brandId, prisma) {
  // Load all stock lots for the brand
  const lots = await prisma.stockLot.findMany({
    where: { brandId },
    select: {
      id: true,
      confidenceState: true,
      quantityCertainty: true,
      inventoryStatus: true,
    },
  });

  // Load products for price penalty
  const products = await prisma.product.findMany({
    where: { brandId },
    select: { id: true, sellingPrice: true },
  });

  // Count recent conflicts (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentConflicts = await prisma.inventoryEvent.count({
    where: {
      brandId,
      eventType: 'conflict_detection',
      createdAt: { gte: sevenDaysAgo },
    },
  });

  const totalLots = lots.length;
  if (totalLots === 0) {
    return {
      score: 0,
      breakdown: {
        base_score: 0,
        drivers: [],
        final_score: 0,
        computed_at: new Date().toISOString(),
        lot_count: 0,
      },
    };
  }

  // Step 1–3: Weighted base score
  let weightedSum = 0;
  let denominatorSum = 0;
  let unknownQtyCount = 0;

  // Counts for drivers
  const stateCounts = {};
  let conflictCount = 0;
  let approxCount = 0;
  let verifiedThisWeek = 0;

  // Check count_verified events this week for positive driver
  const verifiedRecent = await prisma.inventoryEvent.count({
    where: {
      brandId,
      eventType: 'count',
      createdAt: { gte: sevenDaysAgo },
    },
  });

  const pricesAddedRecent = await prisma.inventoryEvent.count({
    where: {
      brandId,
      eventType: { in: ['manual_entry', 'import'] },
      createdAt: { gte: sevenDaysAgo },
    },
  });

  for (const lot of lots) {
    const stateWeight = STATE_WEIGHTS[lot.confidenceState] ?? 0;
    const certFactor = CERTAINTY_FACTORS[lot.quantityCertainty];

    if (lot.confidenceState === 'conflict_detected') conflictCount++;
    stateCounts[lot.confidenceState] = (stateCounts[lot.confidenceState] || 0) + 1;

    if (certFactor === null) {
      unknownQtyCount++;
      continue; // exclude from denominator
    }

    if (lot.quantityCertainty === 'approximate') approxCount++;

    const contribution = stateWeight * certFactor;
    weightedSum += contribution;
    denominatorSum += certFactor;
  }

  const base_score = denominatorSum > 0
    ? (weightedSum / denominatorSum) * 100
    : 0;

  // Step 4: Penalties
  const missingPriceCount = products.filter(p => !p.sellingPrice).length;
  const penalty_missing_price = Math.max(-20, -3 * missingPriceCount);

  const conflictRatio = totalLots > 0 ? conflictCount / totalLots * 10 : 0;
  const penalty_conflicts = Math.max(-15, -2 * conflictRatio);

  // Step 5: Bonus (no conflicts in past 7 days AND total conflicts = 0)
  const bonus_clean_streak = (recentConflicts === 0 && conflictCount === 0) ? 2 : 0;

  // Step 6: Final score
  const final_score = Math.min(100, Math.max(0,
    base_score + penalty_missing_price + penalty_conflicts + bonus_clean_streak
  ));

  // Build drivers (top 3 positive + top 3 negative, sorted by absolute delta)
  const drivers = [];

  // Positive drivers
  if (verifiedRecent > 0) {
    drivers.push({
      label: `${verifiedRecent} ${verifiedRecent === 1 ? 'quantity' : 'quantities'} verified this week`,
      delta: +(verifiedRecent * 0.35).toFixed(1),
      type: 'positive',
    });
  }
  if (pricesAddedRecent > 0) {
    drivers.push({
      label: `${pricesAddedRecent} record${pricesAddedRecent !== 1 ? 's' : ''} updated this week`,
      delta: +(pricesAddedRecent * 0.1).toFixed(1),
      type: 'positive',
    });
  }
  if (bonus_clean_streak > 0) {
    drivers.push({
      label: 'No conflicts — clean data streak',
      delta: +bonus_clean_streak.toFixed(1),
      type: 'positive',
    });
  }
  const cvCount = stateCounts['count_verified'] || 0;
  if (cvCount > 0) {
    drivers.push({
      label: `${cvCount} lot${cvCount !== 1 ? 's' : ''} fully verified`,
      delta: +(cvCount * 0.2).toFixed(1),
      type: 'positive',
    });
  }

  // Negative drivers
  if (missingPriceCount > 0) {
    drivers.push({
      label: `${missingPriceCount} product${missingPriceCount !== 1 ? 's' : ''} missing price`,
      delta: +Math.max(-20, -3 * missingPriceCount).toFixed(1),
      type: 'negative',
    });
  }
  if (conflictCount > 0) {
    drivers.push({
      label: `${conflictCount} lot${conflictCount !== 1 ? 's' : ''} in conflict`,
      delta: +penalty_conflicts.toFixed(1),
      type: 'negative',
    });
  }
  const unverifiedCount = stateCounts['imported_unverified'] || 0;
  if (unverifiedCount > 0) {
    drivers.push({
      label: `${unverifiedCount} imported lot${unverifiedCount !== 1 ? 's' : ''} not yet verified`,
      delta: +(-unverifiedCount * 0.1).toFixed(1),
      type: 'negative',
    });
  }
  if (unknownQtyCount > 0) {
    drivers.push({
      label: `${unknownQtyCount} lot${unknownQtyCount !== 1 ? 's' : ''} with unknown quantity`,
      delta: +(-unknownQtyCount * 0.05).toFixed(1),
      type: 'negative',
    });
  }

  // Sort and limit to 3 each
  const positiveDrivers = drivers
    .filter(d => d.type === 'positive')
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const negativeDrivers = drivers
    .filter(d => d.type === 'negative')
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  const breakdown = {
    base_score: +base_score.toFixed(1),
    penalty_missing_price: +penalty_missing_price.toFixed(1),
    penalty_conflicts: +penalty_conflicts.toFixed(1),
    bonus_clean_streak,
    drivers: [...positiveDrivers, ...negativeDrivers],
    final_score: +final_score.toFixed(1),
    computed_at: new Date().toISOString(),
    lot_count: totalLots,
    state_counts: stateCounts,
  };

  return {
    score: +final_score.toFixed(1),
    breakdown,
  };
}

module.exports = { computeConfidence };
