import { useTournamentState } from "../useTournamentState";
import { Timer } from "../components/Timer";
import { BlindsCard } from "../components/BlindsCard";
import { StatsBar } from "../components/StatsBar";
import { secondsUntilNextBreak } from "../format";

/**
 * Full-screen tournament display, meant to be left open on a TV or projector
 * in the club room. Read-only: it never emits control events, only renders
 * whatever the server pushes.
 *
 * Layout (top to bottom): club emblem, tournament name, blinds + level, timer,
 * stats bar. Themed in the black-and-gold Poker Lounge palette.
 */
export function DisplayPage() {
  const { state, connected } = useTournamentState(false);

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
      className={`relative min-h-screen overflow-hidden ${
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
          <div className="pointer-events-none fixed inset-0 -z-10 bg-black/65" />
        </>
      )}

      <div
        className={`relative flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10 ${
          hasBackground ? "" : "bg-felt-dark"
        }`}
      >
        <ConnectionDot connected={connected} />

        <ClubEmblem logoUrl={state.logoImage ?? undefined} />

        <h1 className="text-center font-display text-4xl font-extrabold tracking-wide text-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-5xl">
          {state.name}
        </h1>

        <BlindsCard
          level={currentLevel}
          levelIndex={state.currentLevelIndex}
          totalLevels={state.levels.length}
          nextLevel={nextLevel}
          secondsUntilBreak={untilBreak}
        />

        <Timer remainingSeconds={state.remainingSeconds} paused={paused} />

        <div className="w-full max-w-5xl">
          <StatsBar state={state} />
        </div>
      </div>
    </div>
  );
}

/**
 * The Poker Lounge club emblem. If a logo image is uploaded it is shown framed
 * in a thin gold ring; otherwise a CSS-only emblem renders the club name in
 * Cinzel flanked by card suits.
 */
function ClubEmblem({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Poker Lounge"
        className="h-28 w-28 rounded-full object-cover shadow-[0_0_0_2px_rgba(212,175,55,0.7),0_4px_20px_rgba(0,0,0,0.6)] sm:h-32 sm:w-32"
      />
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 text-gold">
        <span className="text-3xl">♠</span>
        <span className="font-display text-2xl font-bold tracking-[0.25em] text-gold sm:text-3xl">
          POKER&nbsp;LOUNGE
        </span>
        <span className="text-3xl">♣</span>
      </div>
      <div className="mt-1 h-px w-56 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div
      className={`fixed right-6 top-6 flex items-center gap-2 text-sm ${
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
