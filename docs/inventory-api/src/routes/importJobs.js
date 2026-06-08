const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getQueue } = require('../services/jobQueue');

const router = express.Router();
router.use(requireAuth);

// POST /import-jobs — create a new import job and queue processing
// Body: { fileUrl, columnMapping, rows: [...], rowCount }
// In MVP dev mode, rows are passed directly in the request body.
// In prod, rows would be read from S3 by the background job.
router.post('/', async (req, res, next) => {
  try {
    const { fileUrl, columnMapping, rows, rowCount } = req.body;

    if (!fileUrl && !rows) return res.status(400).json({ error: 'fileUrl or rows is required' });
    if (!columnMapping || typeof columnMapping !== 'object') {
      return res.status(400).json({ error: 'columnMapping object is required' });
    }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows array is required and must not be empty' });
    }

    const job = await prisma.importJob.create({
      data: {
        brandId:        req.brandId,
        fileUrl:        fileUrl || '/inline-upload',
        status:         'queued',
        rowCount:       rowCount || rows.length,
        processedCount: 0,
        errorRows:      [],
      },
    });

    // Queue background processing job with rows inline
    try {
      const boss = getQueue();
      await boss.send('import-process', {
        importJobId:   job.id,
        brandId:       req.brandId,
        fileUrl:       fileUrl || '/inline-upload',
        columnMapping,
        rows,
        userId:        req.userId,
      });
    } catch (queueErr) {
      console.error('[importJobs] Failed to queue job:', queueErr.message);
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: 'failed' },
      });
      return res.status(500).json({ error: 'Failed to queue import job' });
    }

    res.status(202).json(job);
  } catch (err) { next(err); }
});

// GET /import-jobs/:id/status — poll import progress
router.get('/:id/status', async (req, res, next) => {
  try {
    const job = await prisma.importJob.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
    });
    if (!job) return res.status(404).json({ error: 'not found' });

    const isStuck = job.status === 'processing' &&
      (Date.now() - new Date(job.updatedAt).getTime()) > 10 * 60 * 1000;

    res.json({
      id:             job.id,
      status:         job.status,
      rowCount:       job.rowCount,
      processedCount: job.processedCount,
      errorRows:      job.errorRows,
      isStuck,
      createdAt:      job.createdAt,
      updatedAt:      job.updatedAt,
    });
  } catch (err) { next(err); }
});

// GET /import-jobs — list recent jobs for brand
router.get('/', async (req, res, next) => {
  try {
    const jobs = await prisma.importJob.findMany({
      where: { brandId: req.brandId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(jobs);
  } catch (err) { next(err); }
});

// POST /import-jobs/:id/cancel — cancel stuck job
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const job = await prisma.importJob.findFirst({
      where: { id: req.params.id, brandId: req.brandId },
    });
    if (!job) return res.status(404).json({ error: 'not found' });
    if (!['queued', 'processing'].includes(job.status)) {
      return res.status(422).json({ error: 'Job is not in a cancellable state' });
    }
    const updated = await prisma.importJob.update({
      where: { id: req.params.id },
      data: { status: 'failed' },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
