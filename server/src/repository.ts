import { prisma } from "./db.js";
import type {
  Level,
  Player,
  TournamentState,
  UpdatePlayerInput,
  UpsertTournamentInput,
} from "@poker-club/shared";
import { getPresetLevels } from "@poker-club/shared";

/**
 * Tournament repository.
 *
 * Encapsulates all Prisma access for the active tournament. A tournament is
 * considered "active" when its status is one of setup / running / paused —
 * there should only ever be one of those at a time. Queries below rely on
 * that invariant and always target the first non-finished tournament found.
 */

const ACTIVE_STATUS = ["setup", "running", "paused"];

export async function getActiveTournament(): Promise<{
  id: string;
} | null> {
  const t = await prisma.tournament.findFirst({
    where: { status: { in: ACTIVE_STATUS } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return t;
}

/** Pricing fields relevant for cost calculations (the `*Cost` half only). */
type CostPricing = {
  buyInCost: number;
  rebuyCost: number;
  doubleRebuyCost: number;
  addonCost: number;
};

/**
 * Recomputes a player's `paidAmount` (total money owed) from the tournament's
 * cost pricing and the player's purchase counters:
 *   buyIn + rebuys×rebuy + doubleRebuys×doubleRebuy + addons×addon
 */
function computePaidAmount(
  rebuyCount: number,
  doubleRebuyCount: number,
  addonCount: number,
  pricing: CostPricing,
): number {
  return (
    pricing.buyInCost +
    rebuyCount * pricing.rebuyCost +
    doubleRebuyCount * pricing.doubleRebuyCost +
    addonCount * pricing.addonCost
  );
}

/** Loads the active tournament together with its levels/players into a wire snapshot. */
export async function loadState(): Promise<TournamentState | null> {
  const t = await prisma.tournament.findFirst({
    where: { status: { in: ACTIVE_STATUS } },
    orderBy: { createdAt: "desc" },
    include: {
      levels: { orderBy: { order: "asc" } },
      players: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) return null;

  const levels: Level[] = t.levels.map((l) => ({
    id: l.id,
    order: l.order,
    durationSec: l.durationSec,
    smallBlind: l.smallBlind,
    bigBlind: l.bigBlind,
    ante: l.ante,
    isBreak: l.isBreak,
  }));

  const players: Player[] = t.players.map((p) => ({
    id: p.id,
    name: p.name,
    stack: p.stack,
    eliminated: p.eliminated,
    eliminatedAtLevel: p.eliminatedAtLevel,
    rebuyCount: p.rebuyCount,
    doubleRebuyCount: p.doubleRebuyCount,
    addonCount: p.addonCount,
    paidAmount: p.paidAmount,
    paidCash: p.paidCash,
    bountyCount: p.bountyCount,
    eliminationOrder: p.eliminationOrder,
  }));

  // Total chips in play is derived from the actual stacks.
  const totalChips = players.reduce((sum, p) => sum + p.stack, 0);

  return {
    id: t.id,
    name: t.name,
    status: t.status as TournamentState["status"],
    levels,
    players,
    currentLevelIndex: t.currentLevelIdx,
    remainingSeconds: t.remainingSec,
    totalChips,
    startedAt: t.startedAt?.toISOString() ?? null,
    backgroundImage: t.backgroundImage,
    logoImage: t.logoImage,
    buyInChips: t.buyInChips,
    buyInCost: t.buyInCost,
    rebuyChips: t.rebuyChips,
    rebuyCost: t.rebuyCost,
    doubleRebuyChips: t.doubleRebuyChips,
    doubleRebuyCost: t.doubleRebuyCost,
    addonChips: t.addonChips,
    addonCost: t.addonCost,
    maxRebuys: t.maxRebuys,
  };
}

/**
 * Creates the active tournament (or replaces the existing one) from the given
 * input. When `preset` is provided the level structure is seeded from the
 * shared preset definitions; when `levels` is provided it fully overrides.
 */
export async function upsertTournament(input: UpsertTournamentInput): Promise<TournamentState> {
  const existing = await prisma.tournament.findFirst({
    where: { status: { in: ACTIVE_STATUS } },
    orderBy: { createdAt: "desc" },
  });

  const levels =
    input.levels ??
    (input.preset ? getPresetLevels(input.preset) : existing ? undefined : getPresetLevels("regular"));

  const pricing = {
    buyInChips: input.buyInChips ?? 0,
    buyInCost: input.buyInCost ?? 0,
    rebuyChips: input.rebuyChips ?? 0,
    rebuyCost: input.rebuyCost ?? 0,
    doubleRebuyChips: input.doubleRebuyChips ?? 0,
    doubleRebuyCost: input.doubleRebuyCost ?? 0,
    addonChips: input.addonChips ?? 0,
    addonCost: input.addonCost ?? 0,
    maxRebuys: input.maxRebuys ?? 0,
  };

  if (existing) {
    await prisma.tournament.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        ...pricing,
        ...(levels
          ? {
              levels: {
                deleteMany: {},
                create: levels.map((l, i) => ({
                  order: i,
                  durationSec: l.durationSec,
                  smallBlind: l.smallBlind,
                  bigBlind: l.bigBlind,
                  ante: l.ante,
                  isBreak: l.isBreak,
                })),
              },
            }
          : {}),
      },
    });
    // If the structure was rebuilt, snap the timer back to the first level.
    if (levels) {
      await prisma.tournament.update({
        where: { id: existing.id },
        data: {
          currentLevelIdx: 0,
          remainingSec: levels[0]?.durationSec ?? 0,
        },
      });
    }
    // Reprice existing players if costs changed.
    await repriceAllPlayers(existing.id);
  } else {
    if (!levels) throw new Error("Cannot create tournament without a level structure");
    await prisma.tournament.create({
      data: {
        name: input.name,
        status: "setup",
        currentLevelIdx: 0,
        remainingSec: levels[0]?.durationSec ?? 0,
        ...pricing,
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
  }

  const state = await loadState();
  if (!state) throw new Error("Failed to load tournament after upsert");
  return state;
}

/** Recomputes paidAmount for every player after pricing changes. */
async function repriceAllPlayers(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      buyInCost: true,
      rebuyCost: true,
      doubleRebuyCost: true,
      addonCost: true,
    },
  });
  if (!tournament) return;
  const players = await prisma.player.findMany({ where: { tournamentId } });
  for (const p of players) {
    const paidAmount = computePaidAmount(
      p.rebuyCount,
      p.doubleRebuyCount,
      p.addonCount,
      tournament,
    );
    if (paidAmount !== p.paidAmount) {
      await prisma.player.update({ where: { id: p.id }, data: { paidAmount } });
    }
  }
}

export async function addPlayer(name: string): Promise<TournamentState> {
  const t = await prisma.tournament.findFirst({
    where: { status: { in: ACTIVE_STATUS } },
    orderBy: { createdAt: "desc" },
    select: { id: true, buyInChips: true, buyInCost: true },
  });
  if (!t) throw new Error("No active tournament");
  // A new player automatically gets the buy-in purchase: chips granted on
  // registration, cost recorded against their account.
  await prisma.player.create({
    data: {
      tournamentId: t.id,
      name,
      stack: t.buyInChips,
      paidAmount: t.buyInCost,
    },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

export async function updatePlayer(
  playerId: string,
  patch: UpdatePlayerInput,
): Promise<TournamentState> {
  // Local patch type extends the wire input with server-derived fields the
  // client must not set directly (paidAmount, eliminationOrder).
  type PlayerPatch = UpdatePlayerInput & {
    paidAmount?: number;
    eliminationOrder?: number | null;
  };

  let data: PlayerPatch = { ...patch };

  // Always load the player up front: we need the current `eliminated` flag to
  // detect the false→true elimination transition, and the tournament pricing
  // if a cost recompute is needed.
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      tournament: {
        select: {
          id: true,
          buyInCost: true,
          rebuyCost: true,
          doubleRebuyCost: true,
          addonCost: true,
        },
      },
    },
  });
  if (!player) throw new Error("Игрок не найден");

  // Elimination rank: assigned server-side on the false→true transition.
  // 1 = first out, N = last out. Cleared when a player is restored.
  if (patch.eliminated === true && !player.eliminated) {
    const eliminatedCount = await prisma.player.count({
      where: { tournamentId: player.tournamentId, eliminated: true },
    });
    data.eliminationOrder = eliminatedCount + 1;
  } else if (patch.eliminated === false && player.eliminated) {
    data.eliminationOrder = null;
  }

  // If rebuy/addon counts are being edited directly, recompute the paid amount.
  if (
    patch.rebuyCount !== undefined ||
    patch.doubleRebuyCount !== undefined ||
    patch.addonCount !== undefined
  ) {
    const rebuyCount = patch.rebuyCount ?? player.rebuyCount;
    const doubleRebuyCount = patch.doubleRebuyCount ?? player.doubleRebuyCount;
    const addonCount = patch.addonCount ?? player.addonCount;
    data.paidAmount = computePaidAmount(
      rebuyCount,
      doubleRebuyCount,
      addonCount,
      player.tournament,
    );
  }
  await prisma.player.update({ where: { id: playerId }, data });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

/**
 * Applies a single rebuy: increments rebuyCount, adds rebuyChips to the stack,
 * recomputes paidAmount. Respects the tournament's maxRebuys limit (combined
 * single + double count).
 */
export async function applyRebuy(
  playerId: string,
  chipsToAdd: number,
): Promise<TournamentState> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      tournament: {
        select: {
          buyInCost: true,
          rebuyCost: true,
          doubleRebuyCost: true,
          addonCost: true,
          maxRebuys: true,
        },
      },
    },
  });
  if (!player) throw new Error("Игрок не найден");

  const combined = player.rebuyCount + player.doubleRebuyCount;
  if (player.tournament.maxRebuys > 0 && combined >= player.tournament.maxRebuys) {
    throw new Error(`Достигнут лимит ребаев (${player.tournament.maxRebuys})`);
  }

  const newRebuy = player.rebuyCount + 1;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      rebuyCount: newRebuy,
      stack: player.stack + chipsToAdd,
      paidAmount: computePaidAmount(
        newRebuy,
        player.doubleRebuyCount,
        player.addonCount,
        player.tournament,
      ),
    },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

/**
 * Applies a double rebuy: increments doubleRebuyCount, adds doubleRebuyChips to
 * the stack, recomputes paidAmount.
 */
export async function applyDoubleRebuy(
  playerId: string,
  chipsToAdd: number,
): Promise<TournamentState> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      tournament: {
        select: {
          buyInCost: true,
          rebuyCost: true,
          doubleRebuyCost: true,
          addonCost: true,
          maxRebuys: true,
        },
      },
    },
  });
  if (!player) throw new Error("Игрок не найден");

  const combined = player.rebuyCount + player.doubleRebuyCount;
  if (player.tournament.maxRebuys > 0 && combined >= player.tournament.maxRebuys) {
    throw new Error(`Достигнут лимит ребаев (${player.tournament.maxRebuys})`);
  }

  const newDouble = player.doubleRebuyCount + 1;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      doubleRebuyCount: newDouble,
      stack: player.stack + chipsToAdd,
      paidAmount: computePaidAmount(
        player.rebuyCount,
        newDouble,
        player.addonCount,
        player.tournament,
      ),
    },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

/** Applies an addon: increments addonCount, adds addonChips, recomputes paidAmount. */
export async function applyAddon(
  playerId: string,
  chipsToAdd: number,
): Promise<TournamentState> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      tournament: {
        select: {
          buyInCost: true,
          rebuyCost: true,
          doubleRebuyCost: true,
          addonCost: true,
        },
      },
    },
  });
  if (!player) throw new Error("Игрок не найден");

  const newAddon = player.addonCount + 1;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      addonCount: newAddon,
      stack: player.stack + chipsToAdd,
      paidAmount: computePaidAmount(
        player.rebuyCount,
        player.doubleRebuyCount,
        newAddon,
        player.tournament,
      ),
    },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

/** Sets the background image path on the active tournament. */
export async function setBackgroundImage(relativePath: string | null): Promise<TournamentState> {
  const t = await getActiveTournament();
  if (!t) throw new Error("No active tournament");
  await prisma.tournament.update({
    where: { id: t.id },
    data: { backgroundImage: relativePath },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

/** Sets the club logo image path on the active tournament. */
export async function setLogoImage(relativePath: string | null): Promise<TournamentState> {
  const t = await getActiveTournament();
  if (!t) throw new Error("No active tournament");
  await prisma.tournament.update({
    where: { id: t.id },
    data: { logoImage: relativePath },
  });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}

export async function removePlayer(playerId: string): Promise<TournamentState> {
  await prisma.player.delete({ where: { id: playerId } });
  const state = await loadState();
  if (!state) throw new Error("Failed to load state");
  return state;
}
