import { useEffect, useRef, useState } from "react";
import type { TournamentState } from "@poker-club/shared";

/**
 * Sound alert engine for the display screen.
 *
 * Watches the live tournament state and plays an alert when:
 *   - remainingSeconds crosses 60 from above  → "1 минута"
 *   - remainingSeconds crosses 10 from above  → "10 секунд"
 *   - currentLevelIndex increases             → "новый уровень"
 *
 * Loudness: everything (synthesized tones AND custom uploaded files) is routed
 * through a master gain followed by a limiter-style DynamicsCompressor, so a
 * hall-compatible boost of ×1–×4 never clips the output. Custom files are
 * fetched and decoded with decodeAudioData — this is the only way to amplify
 * them, because HTMLAudioElement.volume is capped at 1.0 by the browser.
 *
 * Browser autoplay policy: audio cannot play until the page has received a
 * user gesture. The caller must render an "enable sound" button and call
 * `enable()` from its onClick. After a page reload the context may start
 * suspended again, so a passive pointerdown/keydown listener keeps calling
 * resume() until it sticks.
 */

type AlertType = "1min" | "10sec" | "level";

/** Master loudness multipliers available on the display (persisted per device). */
export const VOLUME_STEPS = [1, 2, 3, 4] as const;
const VOLUME_KEY = "pokerSoundVolume";

function readStoredVolume(): number {
  const raw = parseInt(localStorage.getItem(VOLUME_KEY) ?? "", 10);
  return VOLUME_STEPS.includes(raw as (typeof VOLUME_STEPS)[number]) ? raw : 2;
}

export interface TournamentAlerts {
  /** Whether sound alerts are currently enabled (after a user click). */
  enabled: boolean;
  /** Call from a click handler to unlock audio playback. */
  enable: () => void;
  /** Current master loudness multiplier (1–4). */
  volume: number;
  /** Cycles the multiplier 1 → 2 → 3 → 4 → 1. */
  cycleVolume: () => void;
}

/** Decoded custom alert files, cached by URL for the tab lifetime. */
const bufferCache = new Map<string, AudioBuffer>();

export function useTournamentAlerts(state: TournamentState | null): TournamentAlerts {
  const [enabled, setEnabled] = useState<boolean>(
    () => localStorage.getItem("pokerSoundEnabled") === "1",
  );
  const [volume, setVolume] = useState<number>(readStoredVolume);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);
  const prevRemainingRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  // Remembered custom sound URLs, kept in refs so the effect can read them
  // without re-subscribing on every state update.
  const soundUrlsRef = useRef<{
    "1min": string | null;
    "10sec": string | null;
    level: string | null;
  }>({ "1min": null, "10sec": null, level: null });

  // Keep the ref in sync with the latest state.
  soundUrlsRef.current = state
    ? {
        "1min": state.soundAlert1Min,
        "10sec": state.soundAlert10Sec,
        level: state.soundAlertLevel,
      }
    : { "1min": null, "10sec": null, level: null };

  volumeRef.current = volume;
  if (masterRef.current) masterRef.current.gain.value = volume;

  /** Lazily creates the context and the master gain → limiter → destination chain. */
  function ensureGraph(): { ctx: AudioContext; master: GainNode } | null {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current;
    if (!masterRef.current) {
      const master = ctx.createGain();
      // Limiter: lets quiet files be boosted well past 0 dBFS without clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.15;
      master.connect(limiter).connect(ctx.destination);
      master.gain.value = volumeRef.current;
      masterRef.current = master;
    }
    void ctx.resume();
    return { ctx, master: masterRef.current };
  }

  function enable() {
    // Creating the context inside the click handler satisfies the autoplay
    // gesture requirement. A resumed context is required for Safari.
    ensureGraph();
    setEnabled(true);
    localStorage.setItem("pokerSoundEnabled", "1");
  }

  function cycleVolume() {
    setVolume((v) => {
      const idx = VOLUME_STEPS.indexOf(v as (typeof VOLUME_STEPS)[number]);
      const next = VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length];
      localStorage.setItem(VOLUME_KEY, String(next));
      return next;
    });
  }

  // After a reload the persisted AudioContext can start suspended; any tap or
  // key press on the display (pause hotkey, volume button, ...) re-unlocks it.
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => void ctxRef.current?.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !state) return;

    const prevRemaining = prevRemainingRef.current;
    const prevLevel = prevLevelRef.current;
    const cur = state.remainingSeconds;
    const lvl = state.currentLevelIndex;

    // Level change alert (fired before the time alerts so it wins on the tick
    // where a new level just started).
    if (prevLevel !== null && lvl > prevLevel) {
      void playAlert("level", soundUrlsRef.current.level, ensureGraph);
    }

    // 1-minute and 10-second countdown alerts: fire on the tick that crosses
    // the threshold from above. We compare against the previous value so a
    // page load already inside the window doesn't trigger a stale alert.
    if (prevRemaining !== null && lvl === prevLevel) {
      if (prevRemaining > 60 && cur <= 60 && cur > 10) {
        void playAlert("1min", soundUrlsRef.current["1min"], ensureGraph);
      } else if (prevRemaining > 10 && cur <= 10 && cur >= 0) {
        void playAlert("10sec", soundUrlsRef.current["10sec"], ensureGraph);
      }
    }

    prevRemainingRef.current = cur;
    prevLevelRef.current = lvl;
  }, [enabled, state]);

  return { enabled, enable, volume, cycleVolume };
}

/**
 * Plays one alert. Prefers a custom uploaded file, decoded and routed through
 * the amplified master chain; falls back to a synthesized bell/tick whose
 * shape differs per type so the room can tell them apart.
 */
async function playAlert(
  type: AlertType,
  customUrl: string | null,
  ensureGraph: () => { ctx: AudioContext; master: GainNode } | null,
): Promise<void> {
  if (customUrl) {
    const graph = ensureGraph();
    if (graph) {
      try {
        await playDecoded(graph, customUrl);
        return;
      } catch {
        // Fall through to the plain element / synthesis below.
      }
    }
    try {
      const audio = new Audio(customUrl);
      await audio.play();
      return;
    } catch {
      // Fall through to synthesis if the file fails (e.g. removed from disk).
    }
  }
  const graph = ensureGraph();
  if (!graph) return;
  const { ctx, master } = graph;
  const t = ctx.currentTime;

  switch (type) {
    case "1min":
      // One calm but firm bell strike (A5).
      bellStrike(ctx, master, t, 880, 0.9);
      break;
    case "10sec":
      // Two sharp bright ticks.
      tick(ctx, master, t, 0);
      tick(ctx, master, t, 0.15);
      break;
    case "level":
      // Service-bell "ding-ding-ding" (E6) — the classic casino call.
      bellStrike(ctx, master, t, 1318.5, 0.45);
      bellStrike(ctx, master, t + 0.3, 1318.5, 0.45);
      bellStrike(ctx, master, t + 0.6, 1318.5, 0.6);
      break;
  }
}

/** Fetches, decodes and plays a custom file through the amplified master chain. */
async function playDecoded(
  graph: { ctx: AudioContext; master: GainNode },
  url: string,
): Promise<void> {
  let buffer = bufferCache.get(url);
  if (!buffer) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    buffer = await graph.ctx.decodeAudioData(await res.arrayBuffer());
    bufferCache.set(url, buffer);
  }
  const src = graph.ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(graph.master);
  src.start();
}

/**
 * A bell-like strike: a few inharmonic sine partials (like a real service
 * bell), higher partials decaying faster. Peak amplitude close to full scale —
 * the master limiter keeps the boosted sum from clipping.
 */
function bellStrike(
  ctx: AudioContext,
  dest: AudioNode,
  t0: number,
  freq: number,
  decaySec: number,
): void {
  const partials: Array<[ratio: number, amp: number]> = [
    [1, 1],
    [2.0, 0.55],
    [2.76, 0.32],
    [4.07, 0.16],
  ];
  const norm = partials.reduce((s, [, a]) => s + a, 0);
  for (const [ratio, amp] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    const peak = (0.9 * amp) / norm;
    // Higher partials ring out faster, like a struck metal bell.
    const decay = decaySec / (0.7 + 0.5 * ratio);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(gain).connect(dest);
    osc.start(t0);
    osc.stop(t0 + decay + 0.02);
  }
}

/** A short percussive tick for the 10-second countdown. */
function tick(ctx: AudioContext, dest: AudioNode, t: number, delaySec: number): void {
  const t0 = t + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1760, t0);
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.06);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.9, t0 + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
  osc.connect(gain).connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}
