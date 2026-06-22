import type { Level } from "@poker-club/shared";
import { formatBlinds, formatChips, formatClock } from "../format";

interface BlindsCardProps {
  level: Level | undefined;
  levelIndex: number;
  totalLevels: number;
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
 */
export function BlindsCard({
  level,
  levelIndex,
  totalLevels,
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
    <CenterHeadline
      level={level}
      levelIndex={levelIndex}
      totalLevels={totalLevels}
    />
  );
}

/** Central headline: the active level's blinds, very large. */
function CenterHeadline({
  level,
  levelIndex,
  totalLevels,
}: {
  level: Level | undefined;
  levelIndex: number;
  totalLevels: number;
}) {
  const isBreak = level?.isBreak ?? false;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="font-display text-lg font-medium uppercase tracking-[0.35em] text-gold/80 sm:text-xl">
        Уровень {levelIndex + 1} / {totalLevels}
      </div>
      <div
        className={`text-center font-display font-semibold leading-none ${
          isBreak ? "text-gold-light" : "text-white"
        }`}
        style={{ fontSize: "clamp(3.5rem, 9vw, 8rem)" }}
      >
        {level ? formatBlinds(level.smallBlind, level.bigBlind, level.isBreak) : "—"}
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
    <div className="flex w-full flex-col gap-3">
      <SidePanel label="Следующий уровень">
        <span className="font-display text-2xl font-semibold text-white sm:text-3xl">
          {nextLevel
            ? formatBlinds(nextLevel.smallBlind, nextLevel.bigBlind, nextLevel.isBreak)
            : "Финал"}
        </span>
      </SidePanel>

      {secondsUntilBreak !== null && (
        <SidePanel label="Перерыв через">
          <span className="font-mono text-2xl font-bold text-gold sm:text-3xl">
            {formatClock(secondsUntilBreak)}
          </span>
        </SidePanel>
      )}

      {!isBreak && level && level.ante > 0 && (
        <SidePanel label="Анте">
          <span className="font-mono text-2xl font-bold text-gold sm:text-3xl">
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
    <div className="rounded-xl border border-gold/30 bg-black/50 px-5 py-3 backdrop-blur-sm">
      <div className="font-display text-xs font-medium uppercase tracking-[0.25em] text-gold/70">
        {label}
      </div>
      <div className="mt-1 text-right">{children}</div>
    </div>
  );
}
