import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type TournamentState,
} from "@poker-club/shared";
import { api } from "./api";

/**
 * The single source of truth for the live tournament state on the client.
 *
 * - On mount it does an initial REST fetch (so the UI paints before the socket
 *   handshake completes), then connects a Socket.IO client.
 * - `state:full` snapshots fully replace state (sent on connect and after any
 *   structural change). `timer:tick` only patches the remaining-seconds field,
 *   which is what fires every second.
 * - `send()` emits control events to the server; only useful on the admin page
 *   where the socket carries a valid auth token.
 *
 * The socket is created once and reused. We never reconnect manually —
 * Socket.IO handles reconnection, and after a reconnect the server pushes a
 * fresh `state:full`, so the UI self-heals.
 */
export function useTournamentState(asAdmin = false) {
  const [state, setState] = useState<TournamentState | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initial paint: fetch the snapshot over REST (latency-tolerant, no auth
    // needed for the public read).
    api.getTournament().then(setState).catch(console.error);

    const token = localStorage.getItem("adminToken");
    const socket = io({
      // Empty path -> same origin (works through the Vite proxy in dev and
      // directly in prod when served by Express).
      auth: asAdmin && token ? { token } : {},
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(SERVER_EVENTS.STATE_FULL, (next: TournamentState) => {
      setState(next);
    });

    socket.on(SERVER_EVENTS.TIMER_TICK, (remainingSeconds: number) => {
      setState((prev) => (prev ? { ...prev, remainingSeconds } : prev));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [asAdmin]);

  /** Emits a control event (admin-only; ignored by the server without auth). */
  function send<E extends keyof typeof CLIENT_EVENTS>(
    event: E,
    payload?: unknown,
  ): void {
    const name = CLIENT_EVENTS[event] as string;
    socketRef.current?.emit(name, payload);
  }

  return { state, connected, send };
}
