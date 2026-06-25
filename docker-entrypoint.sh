#!/bin/sh
# Container entrypoint: ensures the SQLite database exists and is migrated
# before starting the server. Runs on every container start; both migrate
# deploy and seed are idempotent so re-runs are safe.
set -e

echo "[entrypoint] Applying Prisma migrations..."
cd /app/server && npx prisma migrate deploy

echo "[entrypoint] Seeding default tournament (idempotent)..."
# Seed via a standalone Node script that talks to Prisma directly. The regular
# blind structure is inlined here so we don't depend on @poker-club/shared
# (whose compiled path differs between dev tsx and the production image).
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const SEED_ID = 'seed-tournament-active';

// Regular preset (20-min levels) inlined to avoid cross-workspace imports.
const level = (sb, dur, ante = 0) => ({ durationSec: dur, smallBlind: sb, bigBlind: sb * 2, ante, isBreak: false, breakTitle: null });
const BREAK = { durationSec: 300, smallBlind: 0, bigBlind: 0, ante: 0, isBreak: true, breakTitle: 'Перерыв' };
const levels = [
  level(10, 1200), level(15, 1200), level(25, 1200), level(50, 1200, 50), level(75, 1200, 75),
  BREAK,
  level(100, 1200, 100), level(150, 1200, 150), level(200, 1200, 200), level(300, 1200, 300),
  BREAK,
  level(400, 1200, 400), level(600, 1200, 600), level(800, 1200, 800), level(1000, 1200, 1000),
  BREAK,
  level(1500, 1200, 1500), level(2000, 1200, 2000), level(3000, 1200, 3000), level(5000, 1200, 5000),
];

(async () => {
  const t = await prisma.tournament.upsert({
    where: { id: SEED_ID },
    update: {},
    create: {
      id: SEED_ID,
      name: \"Friday Night Hold'em\",
      status: 'setup',
      buyInChips: 10000, buyInCost: 5000,
      rebuyChips: 10000, rebuyCost: 5000,
      doubleRebuyChips: 20000, doubleRebuyCost: 10000,
      addonChips: 10000, addonCost: 5000,
      maxRebuys: 3,
      remainingSec: levels[0].durationSec,
      levels: { create: levels.map((l, i) => ({ order: i, ...l })) },
    },
  });
  console.log('[entrypoint] Seed OK:', t.name, 'with', levels.length, 'levels');
})().catch(e => { console.error('[entrypoint] Seed error:', e.message); })
  .finally(() => prisma.\$disconnect());
"

echo "[entrypoint] Starting server..."
cd /app && exec npm start
