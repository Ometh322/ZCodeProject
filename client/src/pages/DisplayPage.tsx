import { useTournamentState } from "../useTournamentState";
import { Timer } from "../components/Timer";
import { BlindsCard } from "../components/BlindsCard";
import { StatsBar } from "../components/StatsBar";

/**
 * Full-screen tournament display, meant to be left open on a TV or projector
 * in the club room. Read-only: it never emits control events, only renders
 * whatever the server pushes.
 *
 * Layout (top to bottom): tournament name, blinds + level, timer, stats bar.
 */
export function DisplayPage() {
  const { state, connected } = useTournamentState(false);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-slate-400">
        Загрузка турнира…
      </div>
    );
  }

  const currentLevel = state.levels[state.currentLevelIndex];
  const nextLevel = state.levels[state.currentLevelIndex + 1];
  const paused = state.status === "paused" || state.status === "setup";
  const hasBackground = Boolean(state.backgroundImage);

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${
        hasBackground ? "" : "bg-felt"
      }`}
    >
      {/* Background image layer. Rendered absolutely behind the content with a
          dark scrim so text stays readable over busy imagery. */}
      {state.backgroundImage && (
        <>
          <img
            src={state.backgroundImage}
            alt=""
            className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-black/55" />
        </>
      )}

      <div
        className={`relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-10 ${
          hasBackground ? "" : "bg-felt"
        }`}
      >
        <ConnectionDot connected={connected} />

        <h1 className="text-center text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">
          {state.name}
        </h1>

        <BlindsCard
          level={currentLevel}
          levelIndex={state.currentLevelIndex}
          totalLevels={state.levels.length}
          nextLevel={nextLevel}
        />

        <Timer remainingSeconds={state.remainingSeconds} paused={paused} />

        <div className="w-full max-w-5xl">
          <StatsBar state={state} />
        </div>
      </div>
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div
      className={`fixed right-6 top-6 flex items-center gap-2 text-sm ${
        connected ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full ${
          connected ? "bg-emerald-400" : "animate-pulse bg-red-500"
        }`}
      />
      {connected ? "В сети" : "Нет связи"}
    </div>
  );
}
