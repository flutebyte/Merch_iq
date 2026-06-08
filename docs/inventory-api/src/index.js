require('dotenv').config();
const app = require('./app');
const prisma = require('./db');
const { initJobQueue } = require('./services/jobQueue');

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
