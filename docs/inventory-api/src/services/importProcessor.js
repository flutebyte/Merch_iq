/**
 * ImportProcessor — pg-boss job handler for CSV/XLSX imports.
 *
 * This runs in-process as a pg-boss worker. It:
 * 1. Reads the file from local dev storage (or S3 key in prod)
 * 2. Parses rows using PapaParse (CSV) or SheetJS (XLSX)
 * 3. Deduplicates against existing brand records
 * 4. Creates Products and StockLots row by row
 * 5. Updates ImportJob.processedCount as it goes
 * 6. Stores failed rows in ImportJob.errorRows
 */

const prisma = require('../db');
const { writeEvent } = require('./inventoryEventWriter');
const { getQueue } = require('./jobQueue');

const COLUMN_ALIASES = {
  name:         ['name', 'product name', 'item name', 'description', 'product_name', 'item_name'],
  sku:          ['sku', 'style code', 'product code', 'style_code', 'product_code', 'code'],
  quantity:     ['qty', 'quantity', 'stock', 'units'],
  sellingPrice: ['price', 'selling price', 'mrp', 'rate', 'selling_price'],
  costPrice:    ['cost', 'cost price', 'purchase price', 'cost_price', 'purchase_price'],
  category:     ['category', 'type', 'product type', 'product_type'],
  size:         ['size', 'size name', 'size_name'],
  color:        ['color', 'colour'],
};

/**
 * Auto-detect column mappings from file headers.
 * @param {string[]} headers - raw headers from parsed file
 * @returns {{ [fieldName]: headerName }}
 */
function autoDetectMapping(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(h => (h || '').toLowerCase().trim());

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

/**
 * Normalize a product name for fuzzy matching.
 */
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Compute Levenshtein similarity ratio between two strings.
 * Returns 0–100 (percentage similarity).
 */
function similarityScore(a, b) {
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const dp = Array.from({ length: la + 1 }, (_, i) => Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const maxLen = Math.max(la, lb);
  return Math.round((1 - dp[la][lb] / maxLen) * 100);
}

/**
 * Process a single import job row.
 * Returns { created: boolean, updated: boolean, skipped: boolean, error: string|null }
 */
async function processRow(tx, { row, brandId, userId, skuIndex }) {
  const { name, sku, quantity, sellingPrice, costPrice, category, size, color } = row;

  if (!name && !sku) {
    return { error: 'Row has no product name or SKU' };
  }

  let product = null;

  // Step 1: Exact SKU match
  if (sku) {
    const existing = await tx.product.findFirst({
      where: { brandId, sku },
      include: { stockLots: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) {
      product = existing;
    }
  }

  // Step 2: Fuzzy name match if no SKU match
  if (!product && name) {
    const existingProducts = await tx.product.findMany({
      where: { brandId, name: { not: null } },
      select: { id: true, name: true, sku: true },
    });
    const normalizedNew = normalizeName(name);
    let bestMatch = null, bestScore = 0;
    for (const p of existingProducts) {
      const score = similarityScore(normalizeName(p.name), normalizedNew);
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
    if (bestScore > 85) {
      product = await tx.product.findUnique({
        where: { id: bestMatch.id },
        include: { stockLots: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
    }
  }

  // Step 3: Create new product if no match
  if (!product) {
    product = await tx.product.create({
      data: {
        brandId,
        name: name || null,
        sku: sku || null,
        category: category || null,
        size: size || null,
        color: color || null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
      },
    });
  } else {
    // Update product fields if provided
    const updateData = {};
    if (name && !product.name) updateData.name = name;
    if (sku && !product.sku)   updateData.sku = sku;
    if (category)              updateData.category = category;
    if (size)                  updateData.size = size;
    if (color)                 updateData.color = color;
    if (sellingPrice)          updateData.sellingPrice = parseFloat(sellingPrice);
    if (costPrice)             updateData.costPrice    = parseFloat(costPrice);
    if (Object.keys(updateData).length > 0) {
      product = await tx.product.update({ where: { id: product.id }, data: updateData });
    }
  }

  // Validate quantity
  const qty = quantity !== undefined && quantity !== '' && quantity !== null
    ? parseInt(quantity, 10)
    : null;
  const validQty = qty !== null && !isNaN(qty) ? qty : null;

  // Create StockLot with imported_unverified state
  const lot = await tx.stockLot.create({
    data: {
      brandId,
      productId: product.id,
      quantity: validQty,
      quantityCertainty: validQty != null ? 'approximate' : 'unknown',
      inventoryStatus: 'main_stock',
      confidenceState: 'imported_unverified',
      source: 'import',
      version: 0,
    },
  });

  await writeEvent(tx, {
    brandId,
    stockLotId: lot.id,
    eventType: 'import',
    payload: {
      source: 'csv_import',
      originalRow: row,
      productId: product.id,
    },
    userId,
  });

  return { created: true };
}

/**
 * Main job handler — registered with pg-boss.
 */
async function handleImportJob(job) {
  const { importJobId, brandId, fileUrl, columnMapping, userId } = job.data;

  console.log(`[import] Starting job ${importJobId} for brand ${brandId}`);

  // Mark as processing
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: 'processing' },
  });

  try {
    // In dev mode, fileUrl is /dev-uploads/<uuid> — rows were passed via columnMapping
    // In prod, fileUrl is an S3 key
    // For now, we expect rows to be passed in the job data (for MVP inline approach)
    const { rows } = job.data;

    if (!rows || !Array.isArray(rows)) {
      throw new Error('No rows data provided in job');
    }

    // Update row count
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { rowCount: rows.length },
    });

    const errorRows = [];
    let processed = 0;

    // Track SKUs within this import for deduplication (last-row-wins)
    const skuIndex = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.sku) {
        skuIndex[row.sku] = i; // last occurrence wins
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip non-last-occurrence rows for duplicate SKUs
      if (row.sku && skuIndex[row.sku] !== i) {
        processed++;
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await processRow(tx, { row, brandId, userId, skuIndex });
        });
      } catch (rowErr) {
        errorRows.push({
          row: i + 2, // +2 because row 1 is header and we're 0-indexed
          content: row,
          reason: rowErr.message,
        });
      }

      processed++;

      // Update progress every 10 rows
      if (processed % 10 === 0 || processed === rows.length) {
        await prisma.importJob.update({
          where: { id: importJobId },
          data: { processedCount: processed, errorRows },
        });
      }
    }

    // Mark complete
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: 'complete',
        processedCount: processed,
        errorRows,
      },
    });

    // Trigger confidence score update
    try {
      const boss = getQueue();
      await boss.send('confidence-score-update', { brandId }, { singletonKey: `confidence-${brandId}` });
    } catch (_) { /* non-fatal */ }

    console.log(`[import] Job ${importJobId} complete. Processed: ${processed}, Errors: ${errorRows.length}`);
  } catch (err) {
    console.error(`[import] Job ${importJobId} failed:`, err.message);
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'failed' },
    });
    throw err;
  }
}

/**
 * Register the import-process worker with pg-boss.
 */
async function registerImportWorker(boss) {
  await boss.work('import-process', { teamSize: 2, teamConcurrency: 1 }, handleImportJob);
  console.log('[import] Worker registered for import-process queue');
}

module.exports = { registerImportWorker, autoDetectMapping, processRow, normalizeName };
