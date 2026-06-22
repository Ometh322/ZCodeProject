import { useTournamentState } from "../useTournamentState";
import { useTournamentAlerts } from "../hooks/useTournamentAlerts";
import { Timer } from "../components/Timer";
import { BlindsCard } from "../components/BlindsCard";
import { StatsBar } from "../components/StatsBar";
import { secondsUntilNextBreak } from "../format";

/**
 * Full-screen tournament display, meant to be left open on a TV or projector
 * in the club room. Read-only: it never emits control events, only renders
 * whatever the server pushes.
 *
 * The layout is a full-bleed three-column grid that fills the whole viewport
 * so every element stays readable on a large screen from across the room:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                 ИМЯ ТУРНИРА              [● в сети]       │  header strip
 *   ├──────────┬──────────────────────────┬────────────────────┤
 *   │ ЭМБЛЕМА  │       100 / 200          │  СЛЕД. УРОВЕНЬ     │
 *   │          │                          │  150 / 300         │
 *   │ Средний  │      ┌─────────┐         │                    │
 *   │ стек     │      │  14:23  │         │  ПЕРЕРЫВ ЧЕРЕЗ     │
 *   │ В игре   │      └─────────┘         │     45:00          │
 *   │ Призовой │                          │                    │
 *   │ фонд     │                          │  АНТЕ: 200         │
 *   └──────────┴──────────────────────────┴────────────────────┘
 *      left            center                    right
 *
 * Themed in the black-and-gold Poker Lounge palette with Cormorant Garamond
 * for the antiqua headings.
 */
export function DisplayPage() {
  const { state, connected } = useTournamentState(false);
  const alerts = useTournamentAlerts(state);

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
  const hasBackground = Boolean(state.backgroundImage);
  const untilBreak = secondsUntilNextBreak(state);

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden ${
        hasBackground ? "" : "bg-felt-dark"
      }`}
    >
      {/* Background image layer. Rendered behind the content with a dark scrim
          so text stays readable over busy imagery. */}
      {state.backgroundImage && (
        <>
          <img
            src={state.backgroundImage}
            alt=""
            className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-black/70" />
        </>
      )}

      <ConnectionDot connected={connected} />

      <SoundToggle enabled={alerts.enabled} onEnable={alerts.enable} />

      {/* Header strip: tournament name centered, full width. */}
      <header className="flex shrink-0 items-center justify-center px-6 pt-5 pb-2">
        <h1 className="text-center font-display text-6xl font-semibold tracking-[0.15em] text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-7xl lg:text-8xl">
          {state.name}
        </h1>
      </header>

      {/* Club emblem centered between the header and the three-column grid. */}
      <div className="flex shrink-0 justify-center pb-4">
        <ClubEmblem logoUrl={state.logoImage ?? undefined} />
      </div>

      {/* Three-column body: fills the remaining viewport height. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,3fr)_minmax(16rem,1fr)]">
        {/* Left column: vertical stats only (emblem moved above the grid). */}
        <aside className="flex min-h-0 flex-col items-center justify-center gap-6 lg:items-stretch">
          <StatsBar state={state} />
        </aside>

        {/* Center column: blinds (top) + timer (bottom), filling vertical space. */}
        <main className="flex min-h-0 flex-col items-center justify-center gap-6">
          <BlindsCard
            level={currentLevel}
            levelIndex={state.currentLevelIndex}
            totalLevels={state.levels.length}
            nextLevel={nextLevel}
            secondsUntilBreak={untilBreak}
            layout="center"
          />
          <Timer remainingSeconds={state.remainingSeconds} paused={paused} layout="center" />
        </main>

        {/* Right column: next level + break + ante side panels. */}
        <aside className="flex min-h-0 flex-col items-stretch justify-center gap-4">
          <BlindsCard
            level={currentLevel}
            levelIndex={state.currentLevelIndex}
            totalLevels={state.levels.length}
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
 * The Poker Lounge club emblem. If a logo image is uploaded it is shown framed
 * in a thin gold ring; otherwise a CSS-only emblem renders the club name in
 * Cormorant Garamond flanked by card suits.
 */
function ClubEmblem({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Poker Lounge"
        className="h-48 w-48 rounded-full object-cover shadow-[0_0_0_3px_rgba(212,175,55,0.7),0_4px_20px_rgba(0,0,0,0.6)] sm:h-56 sm:w-56 lg:h-64 lg:w-64"
      />
    );
  }
  return (
      <div className="flex flex-col items-center">
      <div className="flex items-center gap-6 text-gold">
        <span className="text-4xl sm:text-5xl">♠</span>
        <span className="font-display text-4xl font-semibold tracking-[0.2em] text-gold sm:text-5xl lg:text-6xl">
          POKER&nbsp;LOUNGE
        </span>
        <span className="text-4xl sm:text-5xl">♣</span>
      </div>
      <div className="mt-2 h-px w-96 bg-gradient-to-r from-transparent via-gold/60 to-transparent sm:w-[28rem]" />
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
