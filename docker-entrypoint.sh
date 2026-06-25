#!/bin/sh
# Container entrypoint: ensures the SQLite database exists and is migrated
# before starting the server. Runs on every container start; both migrate
# deploy and seed are idempotent so re-runs are safe.
set -e

echo "[entrypoint] Applying Prisma migrations..."
cd /app/server && npx prisma migrate deploy

echo "[entrypoint] Seeding default tournament (idempotent)..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { getPresetLevels } = require('./shared/dist/presets.js');
const prisma = new PrismaClient();
const SEED_ID = 'seed-tournament-active';
(async () => {
  const levels = getPresetLevels('regular');
  const t = await prisma.tournament.upsert({
    where: { id: SEED_ID },
    update: {},
    create: {
      id: SEED_ID,
      name: 'Friday Night Hold\'em',
      status: 'setup',
      buyInChips: 10000,
      buyInCost: 5000,
      rebuyChips: 10000,
      rebuyCost: 5000,
      doubleRebuyChips: 20000,
      doubleRebuyCost: 10000,
      addonChips: 10000,
      addonCost: 5000,
      maxRebuys: 3,
      remainingSec: levels[0]?.durationSec ?? 0,
      levels: { create: levels.map((l, i) => ({
        order: i, durationSec: l.durationSec, smallBlind: l.smallBlind,
        bigBlind: l.bigBlind, ante: l.ante, isBreak: l.isBreak,
        breakTitle: l.breakTitle,
      })) },
    },
  });
  console.log('[entrypoint] Seed OK:', t.name);
})().catch(e => { console.error('[entrypoint] Seed error:', e.message); })
  .finally(() => prisma.\$disconnect());
"

echo "[entrypoint] Starting server..."
cd /app && exec npm start
