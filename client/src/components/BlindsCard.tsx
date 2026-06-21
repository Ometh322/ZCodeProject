import type { Level } from "@poker-club/shared";
import { formatBlinds, formatChips, formatClock } from "../format";

interface BlindsCardProps {
  level: Level | undefined;
  levelIndex: number;
  totalLevels: number;
  nextLevel: Level | undefined;
  /** Seconds until the next scheduled break, or null if none remains. */
  secondsUntilBreak: number | null;
}

/**
 * Shows the active level's blinds (huge) with two side-by-side panels:
 * the upcoming level, and a countdown to the next scheduled break.
 * Themed in the black-and-gold Poker Lounge palette.
 */
export function BlindsCard({
  level,
  levelIndex,
  totalLevels,
  nextLevel,
  secondsUntilBreak,
}: BlindsCardProps) {
  const isBreak = level?.isBreak ?? false;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm font-semibold uppercase tracking-[0.3em] text-gold/80">
        Уровень {levelIndex + 1} / {totalLevels}
      </div>

      <div
        className={`text-center font-extrabold leading-none ${
          isBreak ? "text-gold-light" : "text-white"
        }`}
        style={{ fontSize: "clamp(4rem, 12vw, 10rem)" }}
      >
        {level ? formatBlinds(level.smallBlind, level.bigBlind, level.isBreak) : "—"}
      </div>

      {!isBreak && level && level.ante > 0 && (
        <div className="text-2xl font-semibold text-slate-300">
          Анте: <span className="text-gold">{formatChips(level.ante)}</span>
        </div>
      )}

      {/* Two side-by-side panels: next level + time until break. */}
      <div className="mt-2 flex w-full flex-wrap justify-center gap-4">
        <div className="min-w-[14rem] rounded-xl border border-gold/30 bg-black/50 px-8 py-3 text-center backdrop-blur-sm">
          <div className="text-xs font-semibold uppercase tracking-widest text-gold/70">
            Следующий уровень
          </div>
          <div className="mt-1 text-3xl font-bold text-white">
            {nextLevel
              ? formatBlinds(nextLevel.smallBlind, nextLevel.bigBlind, nextLevel.isBreak)
              : "Финал"}
          </div>
        </div>

        {secondsUntilBreak !== null && (
          <div className="min-w-[14rem] rounded-xl border border-gold/30 bg-black/50 px-8 py-3 text-center backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-widest text-gold/70">
              Перерыв через
            </div>
            <div className="mt-1 font-mono text-3xl font-bold text-gold">
              {formatClock(secondsUntilBreak)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
