import { prisma } from "./db.js";
import type { TournamentStatus } from "@poker-club/shared";
import { getActiveTournament, loadState } from "./repository.js";
import type { Broadcaster } from "./socket.js";

/**
 * Authoritative tournament timer engine.
 *
 * Design notes
 * ------------
 * The server is the single source of truth for the clock. The display page
 * never counts down on its own — it just renders whatever `timer:tick` event
 * the server pushes. This guarantees every screen in the room shows the same
 * time even if one of them briefly drops the connection.
 *
 * The engine runs one process-wide `setInterval`. On each tick it loads the
 * active tournament, decrements the remaining time if the tournament is
 * `running`, auto-advances the level when it hits zero, and broadcasts the
 * relevant event(s).
 *
 * Pause / resume / manual level changes happen out-of-band (via Socket.IO
 * control events); they mutate the DB directly and then ask the engine to
 * `sync()` so the next tick reads the new values.
 */

const TICK_MS = 1000;

export class TimerEngine {
  private interval: NodeJS.Timeout | null = null;
  private broadcast: Broadcaster;
  /** In-memory cache of the last remaining seconds we announced, to dedupe ticks. */
  private lastRemaining: number | null = null;

  constructor(broadcast: Broadcaster) {
    this.broadcast = broadcast;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => void this.tick(), TICK_MS);
    // Don't keep the process alive solely for the timer (lets SIGINT shut down cleanly).
    this.interval.unref?.();
    void this.sync();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Forces a re-read of the DB state and pushes a full snapshot to all clients.
   * Called after any mutation (pause/resume/level change/etc.) so the UI
   * updates immediately instead of waiting for the next 1s tick.
   */
  async sync(): Promise<void> {
    const state = await loadState();
    this.lastRemaining = state?.remainingSeconds ?? null;
    if (state) this.broadcast.stateFull(state);
  }

  private async tick(): Promise<void> {
    const t = await prisma.tournament.findFirst({
      where: { status: "running" },
      orderBy: { createdAt: "desc" },
      include: { levels: { orderBy: { order: "asc" } } },
    });

    // Nothing running -> nothing to count down.
    if (!t) {
      this.lastRemaining = null;
      return;
    }

    const remaining = Math.max(0, t.remainingSec - 1);
    const advancedToNext = remaining === 0;
    let nextIdx = t.currentLevelIdx;
    let nextRemaining = remaining;

    if (advancedToNext) {
      // Auto-advance to the next level, or finish the tournament if this was the last.
      if (nextIdx + 1 < t.levels.length) {
        nextIdx += 1;
        nextRemaining = t.levels[nextIdx].durationSec;
      } else {
        // Last level elapsed -> tournament is over.
        await prisma.tournament.update({
          where: { id: t.id },
          data: { status: "finished", finishedAt: new Date(), remainingSec: 0 },
        });
        const final = await loadState();
        if (final) this.broadcast.stateFull(final);
        return;
      }
    }

    await prisma.tournament.update({
      where: { id: t.id },
      data: { remainingSec: nextRemaining, currentLevelIdx: nextIdx },
    });

    if (advancedToNext) {
      // Structural change -> push a full snapshot (covers level change + new timer).
      const state = await loadState();
      if (state) this.broadcast.stateFull(state);
      this.lastRemaining = state?.remainingSeconds ?? null;
    } else if (remaining !== this.lastRemaining) {
      // Ordinary 1s decrement.
      this.broadcast.timerTick(remaining);
      this.lastRemaining = remaining;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Mutations invoked by Socket.IO control events. Each one mutates the DB and */
/* then calls `engine.sync()` so the new state is broadcast immediately.      */
/* -------------------------------------------------------------------------- */

export async function setStatus(
  engine: TimerEngine,
  status: TournamentStatus,
): Promise<void> {
  const t = await getActiveTournament();
  if (!t) return;
  const patch: Record<string, unknown> = { status };
  if (status === "running" && !(await hasStartedAt(t.id))) {
    patch.startedAt = new Date();
  }
  await prisma.tournament.update({ where: { id: t.id }, data: patch });
  await engine.sync();
}

async function hasStartedAt(id: string): Promise<boolean> {
  const row = await prisma.tournament.findUnique({ where: { id }, select: { startedAt: true } });
  return row?.startedAt !== null;
}

export async function jumpLevel(
  engine: TimerEngine,
  delta: number,
): Promise<void> {
  await setLevelIndex(engine, (current, len) => clamp(current + delta, 0, len - 1));
}

export async function setLevel(
  engine: TimerEngine,
  index: number,
): Promise<void> {
  await setLevelIndex(engine, (_, len) => clamp(index, 0, len - 1));
}

async function setLevelIndex(
  engine: TimerEngine,
  resolve: (current: number, len: number) => number,
): Promise<void> {
  const t = await getActiveTournament();
  if (!t) return;
  const full = await prisma.tournament.findUnique({
    where: { id: t.id },
    include: { levels: { orderBy: { order: "asc" } } },
  });
  if (!full || full.levels.length === 0) return;

  const target = resolve(full.currentLevelIdx, full.levels.length);
  const level = full.levels[target];
  await prisma.tournament.update({
    where: { id: t.id },
    data: { currentLevelIdx: target, remainingSec: level.durationSec },
  });
  await engine.sync();
}

export async function addTime(engine: TimerEngine, seconds: number): Promise<void> {
  const t = await getActiveTournament();
  if (!t) return;
  const full = await prisma.tournament.findUnique({
    where: { id: t.id },
    select: { remainingSec: true },
  });
  if (!full) return;
  await prisma.tournament.update({
    where: { id: t.id },
    data: { remainingSec: Math.max(0, full.remainingSec + seconds) },
  });
  await engine.sync();
}

export async function reset(engine: TimerEngine): Promise<void> {
  const t = await getActiveTournament();
  if (!t) return;
  const full = await prisma.tournament.findUnique({
    where: { id: t.id },
    include: { levels: { orderBy: { order: "asc" } } },
  });
  if (!full) return;
  await prisma.tournament.update({
    where: { id: t.id },
    data: {
      status: "setup",
      currentLevelIdx: 0,
      remainingSec: full.levels[0]?.durationSec ?? 0,
      startedAt: null,
      finishedAt: null,
    },
  });
  await engine.sync();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
