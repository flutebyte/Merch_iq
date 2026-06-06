const PgBoss = require('pg-boss');

let boss;

async function initJobQueue() {
  boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  await boss.start();

  console.log('[queue] pg-boss started: confidence-score-update, import-process');
  return boss;
}

function getQueue() {
  if (!boss) throw new Error('Job queue not initialized');
  return boss;
}

module.exports = { initJobQueue, getQueue };
