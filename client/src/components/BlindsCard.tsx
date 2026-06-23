import type { Level } from "@poker-club/shared";
import { formatBlinds, formatChips, formatClock } from "../format";

interface BlindsCardProps {
  level: Level | undefined;
  levelIndex: number;
  /** Full level array — needed to compute the game-level number (breaks don't
   *  consume a number) and the total count of playing levels. */
  levels: Level[];
  nextLevel: Level | undefined;
  /** Seconds until the next scheduled break, or null if none remains. */
  secondsUntilBreak: number | null;
  /**
   * Where this card is rendered on the display screen:
   *   - "center": the big blinds headline + level counter (central column).
   *   - "side":   the next-level / break / ante panels stacked vertically
   *               (right column). Used in the three-column display layout.
   * Defaults to "center" for backwards compatibility.
   */
  layout?: "center" | "side";
}

/**
 * Renders the active level information for the display screen.
 *
 * In the three-column layout this component is mounted twice: once as the big
 * headline (`layout="center"`) and once as the side rail of upcoming-level /
 * break / ante panels (`layout="side"`). Both share the level data, they just
 * project different slices of it.
 *
 * Typography follows the black-and-gold system: Oswald for the uppercase
 * labels, Montserrat ExtraBold with tabular-nums for all numbers, gold kept
 * for accents (current level, ante) while secondary info is light grey/white.
 *
 * Numbering: the "Уровень N / M" counter counts only playing levels — break
 * levels are skipped, so a break between level 3 and level 4 doesn't turn 4
 * into 5. On a break the headline shows the break's title instead of blinds.
 */
export function BlindsCard({
  level,
  levelIndex,
  levels,
  nextLevel,
  secondsUntilBreak,
  layout = "center",
}: BlindsCardProps) {
  if (layout === "side") {
    return (
      <SidePanels
        level={level}
        nextLevel={nextLevel}
        secondsUntilBreak={secondsUntilBreak}
      />
    );
  }
  return (
    <CenterHeadline level={level} levelIndex={levelIndex} levels={levels} />
  );
}

/** Central headline: the active level's blinds, very large. */
function CenterHeadline({
  level,
  levelIndex,
  levels,
}: {
  level: Level | undefined;
  levelIndex: number;
  levels: Level[];
}) {
  const isBreak = level?.isBreak ?? false;

  // Count playing levels only, for the "Уровень N / M" display.
  const totalGameLevels = levels.filter((l) => !l.isBreak).length;
  let gameNumber = 0;
  for (let i = 0; i <= levelIndex && i < levels.length; i++) {
    if (!levels[i].isBreak) gameNumber += 1;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {isBreak ? (
        <div className="font-heading text-xl font-medium uppercase tracking-[0.4em] text-gold sm:text-2xl">
          {level?.breakTitle || "Перерыв"}
        </div>
      ) : (
        <div className="font-heading text-xl font-medium uppercase tracking-[0.4em] text-gold sm:text-2xl">
          Уровень {gameNumber} <span className="text-gold/40">/</span>{" "}
          {totalGameLevels}
        </div>
      )}
      <div
        className={`nums font-numeric font-extrabold leading-none ${
          isBreak ? "text-gold glow-gold" : "text-white glow-gold-soft"
        }`}
        style={{ fontSize: "clamp(4rem, 11vw, 10rem)" }}
      >
        {isBreak
          ? level?.breakTitle || "Перерыв"
          : level
            ? formatBlinds(level.smallBlind, level.bigBlind, level.isBreak)
            : "—"}
      </div>
    </div>
  );
}

/** Right-rail panels: next level, time until break, ante — stacked vertically. */
function SidePanels({
  level,
  nextLevel,
  secondsUntilBreak,
}: {
  level: Level | undefined;
  nextLevel: Level | undefined;
  secondsUntilBreak: number | null;
}) {
  const isBreak = level?.isBreak ?? false;
  return (
    <div className="flex w-full flex-col gap-4">
      <SidePanel label="Следующий уровень">
        <span className="nums font-numeric text-4xl font-bold text-slate-100 sm:text-5xl">
          {nextLevel
            ? nextLevel.isBreak
              ? nextLevel.breakTitle || "Перерыв"
              : formatBlinds(nextLevel.smallBlind, nextLevel.bigBlind, nextLevel.isBreak)
            : "Финал"}
        </span>
      </SidePanel>

      {secondsUntilBreak !== null && (
        <SidePanel label="Перерыв через">
          <span className="nums font-numeric text-4xl font-bold text-slate-100 sm:text-5xl">
            {formatClock(secondsUntilBreak)}
          </span>
        </SidePanel>
      )}

      {!isBreak && level && level.ante > 0 && (
        <SidePanel label="Анте">
          <span className="nums font-numeric text-4xl font-bold text-gold sm:text-5xl">
            {formatChips(level.ante)}
          </span>
        </SidePanel>
      )}
    </div>
  );
}

function SidePanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gold/20 bg-black/40 px-6 py-4 text-center backdrop-blur-sm">
      <div className="font-heading text-sm font-medium uppercase tracking-[0.25em] text-gold/60 sm:text-base">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
