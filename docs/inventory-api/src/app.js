const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes          = require('./routes/auth');
const integrationRoutes   = require('./routes/integrations');
const brandRoutes         = require('./routes/brands');
const productRoutes       = require('./routes/products');
const stockLotRoutes      = require('./routes/stockLots');
const storageRoutes       = require('./routes/storage');
const inventoryEventRoutes = require('./routes/inventoryEvents');
const importJobRoutes     = require('./routes/importJobs');
const actionQueueRoutes   = require('./routes/actionQueue');
const businessFeedRoutes  = require('./routes/businessFeed');
const salesRecordRoutes   = require('./routes/salesRecords');
const salesIntelRoutes    = require('./routes/salesIntelligence');
const analyticsRoutes     = require('./routes/analytics');
const { errorHandler }    = require('./middleware/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Allow images from the API server (dev-uploads) and data URIs
      'img-src': ["'self'", 'data:', 'blob:', 'http://localhost:3001', 'https:'],
    },
  },
}));
// Allow multiple origins via comma-separated CORS_ORIGIN, or single origin.
// In dev you can set CORS_ORIGIN="http://localhost:3000,http://localhost:3002"
app.use(cors({
  origin: (incomingOrigin, callback) => {
    const configured = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
    // If no origin (e.g. server-to-server or same-origin), allow.
    if (!incomingOrigin) return callback(null, true);
    if (configured.includes(incomingOrigin)) return callback(null, true);
    // Not allowed
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
}));
// Capture raw body for webhook HMAC verification before JSON parsing
app.use('/integrations/shopify/webhooks', (req, res, next) => {
  let buf = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { buf += chunk; });
  req.on('end', () => { req.rawBody = buf; req.body = buf ? JSON.parse(buf) : {}; next(); });
});

// Raw binary for image uploads — must be before express.json so the body parser doesn't interfere
app.use('/storage/upload', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], limit: '20mb' }));
app.use(express.json({ limit: '10mb' }));
// CORP must be cross-origin so the browser (on localhost:3000) can load
// images served by the API (localhost:3001). Helmet sets same-origin by default.
app.use('/dev-uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../public/dev-uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth',              authRoutes);
app.use('/brands',            brandRoutes);
app.use('/products',          productRoutes);
app.use('/stock-lots',        stockLotRoutes);
app.use('/storage',           storageRoutes);
app.use('/inventory-events',  inventoryEventRoutes);
app.use('/import-jobs',       importJobRoutes);
app.use('/action-queue',      actionQueueRoutes);
app.use('/business-feed',     businessFeedRoutes);
app.use('/sales-records',     salesRecordRoutes);
app.use('/sales-intelligence', salesIntelRoutes);
app.use('/analytics',         analyticsRoutes);
app.use('/integrations',      integrationRoutes);

app.use(errorHandler);

module.exports = app;
