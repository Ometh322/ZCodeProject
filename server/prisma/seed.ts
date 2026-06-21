/**
 * Database seed.
 *
 * Creates a single "active" tournament pre-loaded with the Regular blind
 * structure, so the app has something to show on first run instead of an empty
 * setup screen. Safe to re-run: it upserts based on a fixed seed id.
 */
import { PrismaClient } from "@prisma/client";
import { getPresetLevels } from "@poker-club/shared";

const prisma = new PrismaClient();

const SEED_TOURNAMENT_ID = "seed-tournament-active";

async function main() {
  const levels = getPresetLevels("regular");

  const tournament = await prisma.tournament.upsert({
    where: { id: SEED_TOURNAMENT_ID },
    update: {},
    create: {
      id: SEED_TOURNAMENT_ID,
      name: "Friday Night Hold'em",
      status: "setup",
      // Four purchase types, each split into chips (added to stack) and cost
      // (added to paidAmount). They are independent numbers.
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
      levels: {
        create: levels.map((l, i) => ({
          order: i,
          durationSec: l.durationSec,
          smallBlind: l.smallBlind,
          bigBlind: l.bigBlind,
          ante: l.ante,
          isBreak: l.isBreak,
        })),
      },
    },
  });

  // Ensure the seeded structure reflects the current preset definition, even on
  // later re-runs (e.g. after preset levels were tweaked in shared/presets.ts).
  await prisma.level.deleteMany({ where: { tournamentId: tournament.id } });
  await prisma.level.createMany({
    data: levels.map((l, i) => ({
      tournamentId: tournament.id,
      order: i,
      durationSec: l.durationSec,
      smallBlind: l.smallBlind,
      bigBlind: l.bigBlind,
      ante: l.ante,
      isBreak: l.isBreak,
    })),
  });

  console.log(`✓ Seeded tournament "${tournament.name}" with ${levels.length} levels`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
