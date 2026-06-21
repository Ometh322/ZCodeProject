import type { Level } from "@poker-club/shared";
import { formatBlinds, formatChips } from "../format";

interface BlindsCardProps {
  level: Level | undefined;
  levelIndex: number;
  totalLevels: number;
  nextLevel: Level | undefined;
}

/**
 * Shows the active level's blinds (huge) and a peek at the upcoming level so
 * players can plan rebuys and breaks. Breaks render as a "BREAK" panel.
 */
export function BlindsCard({
  level,
  levelIndex,
  totalLevels,
  nextLevel,
}: BlindsCardProps) {
  const isBreak = level?.isBreak ?? false;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
        Уровень {levelIndex + 1} / {totalLevels}
      </div>

      <div
        className={`text-center font-extrabold leading-none ${
          isBreak ? "text-amber-400" : "text-white"
        }`}
        style={{ fontSize: "clamp(4rem, 12vw, 10rem)" }}
      >
        {level ? formatBlinds(level.smallBlind, level.bigBlind, level.isBreak) : "—"}
      </div>

      {!isBreak && level && level.ante > 0 && (
        <div className="text-2xl font-semibold text-slate-300">
          Анте: <span className="text-white">{formatChips(level.ante)}</span>
        </div>
      )}

      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-8 py-3 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Следующий уровень
        </div>
        <div className="mt-1 text-3xl font-bold text-slate-100">
          {nextLevel
            ? formatBlinds(nextLevel.smallBlind, nextLevel.bigBlind, nextLevel.isBreak)
            : "Финал"}
        </div>
      </div>
    </div>
  );
}
