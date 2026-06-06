require('dotenv').config();
const app = require('./app');
const prisma = require('./db');
const { initJobQueue } = require('./services/jobQueue');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await prisma.$connect();
    console.log('[db] connected');

    await initJobQueue();

    app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[startup] failed:', err);
    process.exit(1);
  }
}

start();
