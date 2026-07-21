const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { generateActionQueue, snoozeTask } = require('../services/actionQueueGenerator');

const router = express.Router();
router.use(requireAuth);

// GET /action-queue
router.get('/', async (req, res, next) => {
  try {
    const tasks = await generateActionQueue(req.brandId);
    res.json({ tasks, total: tasks.length });
  } catch (err) { next(err); }
});

// POST /action-queue/:taskId/snooze — snooze for 7 days
router.post('/:taskId/snooze', (req, res) => {
  snoozeTask(req.params.taskId, 7);
  res.json({ ok: true, snoozedDays: 7 });
});

module.exports = router;
