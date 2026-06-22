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
 * Playback:
 *   - If the tournament has a custom sound file for that alert, it is played
 *     via an <audio> element.
 *   - Otherwise a short tone is synthesized with the Web Audio API (no asset
 *     files needed). Each alert type has a distinct tone shape.
 *
 * Browser autoplay policy: audio cannot play until the page has received a
 * user gesture. The caller must render an "enable sound" button and call
 * `enable()` from its onClick — that creates the AudioContext inside the
 * gesture handler, after which all subsequent alerts work. The enabled state
 * is persisted in localStorage so it survives reloads (the context is still
 * recreated on each page load, but no second click is needed because Chrome
 * remembers the gesture within the tab session).
 */

type AlertType = "1min" | "10sec" | "level";

export interface TournamentAlerts {
  /** Whether sound alerts are currently enabled (after a user click). */
  enabled: boolean;
  /** Call from a click handler to unlock audio playback. */
  enable: () => void;
}

export function useTournamentAlerts(state: TournamentState | null): TournamentAlerts {
  const [enabled, setEnabled] = useState<boolean>(
    () => localStorage.getItem("pokerSoundEnabled") === "1",
  );
  const ctxRef = useRef<AudioContext | null>(null);
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

  function enable() {
    // Creating the context inside the click handler satisfies the autoplay
    // gesture requirement. A resumed context is required for Safari.
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) ctxRef.current = new Ctor();
    }
    void ctxRef.current?.resume();
    setEnabled(true);
    localStorage.setItem("pokerSoundEnabled", "1");
  }

  useEffect(() => {
    if (!enabled || !state) return;

    const prevRemaining = prevRemainingRef.current;
    const prevLevel = prevLevelRef.current;
    const cur = state.remainingSeconds;
    const lvl = state.currentLevelIndex;

    // Level change alert (fired before the time alerts so it wins on the tick
    // where a new level just started).
    if (prevLevel !== null && lvl > prevLevel) {
      void playAlert("level", ctxRef.current, soundUrlsRef.current.level);
    }

    // 1-minute and 10-second countdown alerts: fire on the tick that crosses
    // the threshold from above. We compare against the previous value so a
    // page load already inside the window doesn't trigger a stale alert.
    if (prevRemaining !== null && lvl === prevLevel) {
      if (prevRemaining > 60 && cur <= 60 && cur > 10) {
        void playAlert("1min", ctxRef.current, soundUrlsRef.current["1min"]);
      } else if (prevRemaining > 10 && cur <= 10 && cur >= 0) {
        void playAlert("10sec", ctxRef.current, soundUrlsRef.current["10sec"]);
      }
    }

    prevRemainingRef.current = cur;
    prevLevelRef.current = lvl;
  }, [enabled, state]);

  return { enabled, enable };
}

/**
 * Plays one alert. Prefers a custom uploaded file; falls back to a synthesized
 * tone whose shape differs per type so the room can tell them apart.
 */
async function playAlert(
  type: AlertType,
  ctx: AudioContext | null,
  customUrl: string | null,
): Promise<void> {
  if (customUrl) {
    try {
      const audio = new Audio(customUrl);
      await audio.play();
      return;
    } catch {
      // Fall through to synthesis if the file fails (e.g. removed from disk).
    }
  }
  if (!ctx) return;

  switch (type) {
    case "1min":
      // Single short beep, medium pitch.
      beep(ctx, { freq: 880, durationMs: 250 });
      break;
    case "10sec":
      // Two quick high beeps.
      beep(ctx, { freq: 1320, durationMs: 130, startMs: 0 });
      beep(ctx, { freq: 1320, durationMs: 130, startMs: 180 });
      break;
    case "level":
      // Ascending two-note chime.
      beep(ctx, { freq: 660, durationMs: 180, startMs: 0 });
      beep(ctx, { freq: 990, durationMs: 320, startMs: 180 });
      break;
  }
}

/** Schedules one oscillator beep into the given AudioContext. */
function beep(
  ctx: AudioContext,
  opts: { freq: number; durationMs: number; startMs?: number },
): void {
  const { freq, durationMs, startMs = 0 } = opts;
  const t0 = ctx.currentTime + startMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Envelope: quick attack, exponential decay, avoid click at the edges.
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}
