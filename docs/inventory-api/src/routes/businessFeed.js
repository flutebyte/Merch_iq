const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getBusinessFeed } = require('../services/businessFeedQuery');

const router = express.Router();
router.use(requireAuth);

// GET /business-feed?limit=20
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const feed = await getBusinessFeed(req.brandId, limit);
    res.json(feed);
  } catch (err) { next(err); }
});

module.exports = router;
