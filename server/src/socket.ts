import type { Server as IoServer, Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@poker-club/shared";
import type { TournamentState } from "@poker-club/shared";
import type { TimerEngine } from "./timerEngine.js";
import {
  addTime,
  jumpLevel,
  reset,
  setLevel,
  setStatus,
} from "./timerEngine.js";
import { socketAuth } from "./auth.js";

/**
 * Broadcaster: a thin wrapper around the Socket.IO server that the timer engine
 * uses to push events to every connected client (display + admin) without
 * knowing anything about transport details.
 */
export interface Broadcaster {
  stateFull(state: TournamentState): void;
  timerTick(remainingSeconds: number): void;
}

export function createBroadcaster(io: IoServer): Broadcaster {
  return {
    stateFull: (state) => io.emit(SERVER_EVENTS.STATE_FULL, state),
    timerTick: (remainingSeconds) => io.emit(SERVER_EVENTS.TIMER_TICK, remainingSeconds),
  };
}

/**
 * Wires up the Socket.IO server:
 *   - On connect: validate auth (admin sockets must carry a valid token; the
 *     public display socket is allowed through unauthenticated, it's read-only).
 *   - On connect: send a full state snapshot so the UI can render immediately.
 *   - Client control events: only honored when the socket is authenticated,
 *     then delegated to the timer engine which does the DB work and re-syncs.
 */
export function registerSocketHandlers(io: IoServer, engine: TimerEngine): void {
  io.on("connection", (socket: Socket) => {
    void handleConnection(io, engine, socket);
  });
}

async function handleConnection(
  _io: IoServer,
  engine: TimerEngine,
  socket: Socket,
): Promise<void> {
  // Send the current state to whoever just connected, authenticated or not.
  await engine.sync();

  // ---- Admin-only control events -----------------------------------------
  // Each handler re-checks auth so a public display socket cannot mutate state
  // even if a malicious client manually emits these events.

  const guard = async (): Promise<boolean> => {
    const ok = await socketAuth(socket);
    if (!ok) socket.emit("error", "Unauthorized");
    return ok;
  };

  socket.on(CLIENT_EVENTS.PAUSE, async () => {
    if (await guard()) await setStatus(engine, "paused");
  });

  socket.on(CLIENT_EVENTS.RESUME, async () => {
    if (await guard()) await setStatus(engine, "running");
  });

  socket.on(CLIENT_EVENTS.NEXT_LEVEL, async () => {
    if (await guard()) await jumpLevel(engine, +1);
  });

  socket.on(CLIENT_EVENTS.PREVIOUS_LEVEL, async () => {
    if (await guard()) await jumpLevel(engine, -1);
  });

  socket.on(CLIENT_EVENTS.SET_LEVEL, async (index: unknown) => {
    if (await guard() && typeof index === "number") await setLevel(engine, index);
  });

  socket.on(CLIENT_EVENTS.ADD_TIME, async (seconds: unknown) => {
    if (await guard() && typeof seconds === "number") await addTime(engine, seconds);
  });

  socket.on(CLIENT_EVENTS.RESET, async () => {
    if (await guard()) await reset(engine);
  });
}
