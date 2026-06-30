import { useEffect } from "react";
import { useTournamentState } from "../useTournamentState";
import { useTournamentAlerts } from "../hooks/useTournamentAlerts";
import { useDisplaySizes } from "../hooks/useDisplaySizes";
import { Timer } from "../components/Timer";
import { BlindsCard } from "../components/BlindsCard";
import { StatsBar } from "../components/StatsBar";
import { formatBlinds, secondsUntilNextBreak } from "../format";
import type { DisplaySizes } from "../hooks/useDisplaySizes";
import type { Level } from "@poker-club/shared";

/**
 * Full-screen tournament display, meant to be left open on a TV or projector
 * in the club room. Read-only: it never emits control events, only renders
 * whatever the server pushes.
 *
 * The layout is a full-bleed three-column grid that fills the whole viewport.
 * The center column owns the full vertical story — name → emblem → level →
 * timer — pushed to the top so the name + logo sit high on the screen.
 *
 * Adaptive sizing: the center column is measured with a ResizeObserver and a
 * canvas text probe (`useDisplaySizes`). The headline font is scaled so the
 * longest possible blinds string ("500 000 / 1 000 000") provably fits on one
 * line at the measured width — no wrapping on any screen size.
 *
 * Themed in the black-and-gold Poker Lounge palette:
 *   - Tournament name + emblem: Playfair Display Bold with a gold gradient.
 *   - Section labels (BLINDS, СЛЕДУЮЩИЙ УРОВЕНЬ, …): Oswald condensed uppercase.
 *   - All numbers (timer, blinds, chips): Montserrat ExtraBold, tabular-nums.
 *   - Gold is reserved for accents only; body text stays light grey / white.
 *   - Background is charcoal (#0B0B10), not pure black, so gold reads richer.
 */
export function DisplayPage() {
  // If the admin logged in on this device, their auth token lives in
  // localStorage. We connect the socket with admin privileges so the Space-bar
  // pause/resume hotkey works — but only on a device that was previously
  // authenticated. Public kiosks have no token and stay read-only.
  const isAdminDevice = Boolean(localStorage.getItem("adminToken"));
  const { state, connected, send } = useTournamentState(isAdminDevice);
  const alerts = useTournamentAlerts(state);

  // Space-bar hotkey: toggle pause/resume. Ignored when typing in an input
  // (e.g. if an admin panel is somehow open on the same tab).
  useEffect(() => {
    if (!isAdminDevice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      e.preventDefault();
      const running = state?.status === "running";
      send(running ? "PAUSE" : "RESUME");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdminDevice, state?.status, send]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-gold">
        Загрузка турнира…
      </div>
    );
  }

  const currentLevel = state.levels[state.currentLevelIndex];
  const nextLevel = state.levels[state.currentLevelIndex + 1];
  const paused = state.status === "paused" || state.status === "setup";
  const untilBreak = secondsUntilNextBreak(state);

  // The blinds text currently shown — used as the width probe for sizing.
  const blindsText = currentLevel
    ? currentLevel.isBreak
      ? currentLevel.breakTitle || "Перерыв"
      : formatBlinds(currentLevel.smallBlind, currentLevel.bigBlind, currentLevel.isBreak)
    : "—";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-felt-dark">
      <ConnectionDot connected={connected} />

      <SoundToggle enabled={alerts.enabled} onEnable={alerts.enable} />

      {/* Three-column body: fills the whole viewport. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-6 pt-8 pb-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,3fr)_minmax(16rem,1fr)]">
        {/* Left column: vertical stats. */}
        <aside className="flex min-h-0 flex-col items-center justify-center gap-6 lg:items-stretch">
          <StatsBar state={state} />
        </aside>

        {/* Center column: measured container drives the adaptive font sizes. */}
        <CenterColumn
          blindsText={blindsText}
          name={state.name}
          logoUrl={state.logoImage ?? undefined}
          level={currentLevel}
          levelIndex={state.currentLevelIndex}
          levels={state.levels}
          nextLevel={nextLevel}
          secondsUntilBreak={untilBreak}
          remainingSeconds={state.remainingSeconds}
          paused={paused}
        />

        {/* Right column: next level + break + ante side panels. */}
        <aside className="flex min-h-0 flex-col items-stretch justify-center gap-4">
          <BlindsCard
            level={currentLevel}
            levelIndex={state.currentLevelIndex}
            levels={state.levels}
            nextLevel={nextLevel}
            secondsUntilBreak={untilBreak}
            layout="side"
          />
        </aside>
      </div>
    </div>
  );
}

/**
 * The measured center column. `useDisplaySizes` returns a ref to attach to the
 * wrapper div and a set of px sizes derived from the wrapper's current width.
 * Those sizes are passed down to the name, emblem, blinds headline and timer.
 */
function CenterColumn({
  blindsText,
  name,
  logoUrl,
  level,
  levelIndex,
  levels,
  nextLevel,
  secondsUntilBreak,
  remainingSeconds,
  paused,
}: {
  blindsText: string;
  name: string;
  logoUrl?: string;
  level: Level | undefined;
  levelIndex: number;
  levels: Level[];
  nextLevel: Level | undefined;
  secondsUntilBreak: number | null;
  remainingSeconds: number;
  paused: boolean;
}) {
  const { containerRef, sizes } = useDisplaySizes(blindsText);

  return (
    <main
      ref={containerRef}
      className="flex min-h-0 min-w-0 flex-col items-center justify-start gap-5 pt-2"
    >
      {/* Tournament name (Playfair Display Bold, gold gradient). Size derived
          from the center column width so long names don't wrap either. */}
      <h1
        className="text-gold-gradient glow-gold text-center font-display font-bold tracking-[0.08em]"
        style={{ fontSize: `${sizes.title}px` }}
      >
        {name}
      </h1>

      <ClubEmblem logoUrl={logoUrl} size={sizes.logo} labelSize={sizes.label} />

      <BlindsCard
        level={level}
        levelIndex={levelIndex}
        levels={levels}
        nextLevel={nextLevel}
        secondsUntilBreak={secondsUntilBreak}
        layout="center"
        centerFontSize={sizes.blinds}
        labelFontSize={sizes.label}
      />
      <Timer
        remainingSeconds={remainingSeconds}
        paused={paused}
        clockFontSize={sizes.timer}
        labelFontSize={sizes.label}
      />
    </main>
  );
}

/**
 * The Poker Lounge club emblem. If a logo image is uploaded it is shown framed
 * in a thin gold ring; otherwise a CSS-only emblem renders the club name in
 * Playfair Display Bold with the gold gradient, flanked by card suits.
 *
 * The size is driven by the adaptive `sizes.logo` value from useDisplaySizes
 * so the emblem scales with the available width.
 */
function ClubEmblem({
  logoUrl,
  size,
  labelSize,
}: {
  logoUrl?: string;
  size: number;
  labelSize: number;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Poker Lounge"
        className="rounded-full object-cover shadow-[0_0_0_3px_rgba(212,175,55,0.7),0_4px_24px_rgba(0,0,0,0.6)]"
        style={{ height: `${size}px`, width: `${size}px` }}
      />
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-8">
        <span
          className="glow-gold-soft text-gold"
          style={{ fontSize: `${labelSize * 1.6}px` }}
        >
          ♠
        </span>
        <span
          className="text-gold-gradient glow-gold font-display font-bold tracking-[0.2em]"
          style={{ fontSize: `${labelSize * 1.6}px` }}
        >
          POKER&nbsp;LOUNGE
        </span>
        <span
          className="glow-gold-soft text-gold"
          style={{ fontSize: `${labelSize * 1.6}px` }}
        >
          ♣
        </span>
      </div>
      <div
        className="mt-2 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
        style={{ width: `${size * 2}px` }}
      />
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div
      className={`fixed right-6 top-6 z-20 flex items-center gap-2 text-sm ${
        connected ? "text-gold" : "text-red-400"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full ${
          connected ? "bg-gold" : "animate-pulse bg-red-500"
        }`}
      />
      {connected ? "В сети" : "Нет связи"}
    </div>
  );
}

/**
 * Sound enable toggle. Until the operator clicks it (a user gesture), the
 * browser blocks all audio. After the click the AudioContext is unlocked for
 * the rest of the tab session. Rendered top-left so it doesn't fight the
 * connection dot top-right.
 */
function SoundToggle({
  enabled,
  onEnable,
}: {
  enabled: boolean;
  onEnable: () => void;
}) {
  return (
    <button
      onClick={onEnable}
      disabled={enabled}
      className={`fixed left-6 top-6 z-20 rounded-lg border px-4 py-2 text-sm font-medium transition ${
        enabled
          ? "cursor-default border-gold/40 bg-black/40 text-gold/70"
          : "animate-pulse border-gold bg-gold/20 text-gold hover:bg-gold/30"
      }`}
      title={
        enabled
          ? "Звуковые сигналы включены"
          : "Нажмите, чтобы включить звуковые сигналы"
      }
    >
      {enabled ? "🔊 Звук вкл" : "🔊 Включить звук"}
    </button>
  );
}

// Re-export the sizes type so consumers don't need to import from the hook.
export type { DisplaySizes };
