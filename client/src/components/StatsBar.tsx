import type { TournamentState } from "@poker-club/shared";
import { formatChips } from "../format";

interface StatsBarProps {
  state: TournamentState;
}

/**
 * Secondary stats for the display screen.
 *
 *   - Средний стек: totalChips (derived from live stacks) / players still in.
 *   - В игре: remaining / total players.
 *   - Призовой фонд: sum of every player's paidAmount (buy-in + rebuys + addons).
 *   - Шейх дня / Статус: player with the most rebuys, or the tournament status.
 *
 * Rendered as a vertical stack of cards — it lives in the left rail of the
 * three-column display, so each stat gets its own full-width row.
 */
export function StatsBar({ state }: StatsBarProps) {
  const playersRemaining = state.players.filter((p) => !p.eliminated).length;
  const totalPlayers = state.players.length;
  const averageStack =
    playersRemaining > 0 ? Math.round(state.totalChips / playersRemaining) : 0;
  const prizePool = state.players.reduce((sum, p) => sum + p.paidAmount, 0);

  const rebuyMaster = [...state.players]
    .filter((p) => p.rebuyCount > 0)
    .sort((a, b) => b.rebuyCount - a.rebuyCount)[0];

  return (
    <div className="flex w-full flex-col gap-3">
      <Stat label="Средний стек" value={formatChips(averageStack)} />
      <Stat label="В игре" value={`${playersRemaining} / ${totalPlayers}`} />
      <Stat label="Призовой фонд" value={formatChips(prizePool)} accent="text-gold" />
      {rebuyMaster ? (
        <Stat
          label={`Шейх дня · ${rebuyMaster.rebuyCount + rebuyMaster.doubleRebuyCount * 2}`}
          value={rebuyMaster.name}
          accent="text-gold-light"
        />
      ) : (
        <Stat
          label="Статус"
          value={statusLabel(state.status)}
          accent={state.status === "running" ? "text-emerald-400" : "text-gold"}
        />
      )}
    </div>
  );
}

function statusLabel(status: TournamentState["status"]): string {
  switch (status) {
    case "setup":
      return "Подготовка";
    case "running":
      return "Идёт";
    case "paused":
      return "Пауза";
    case "finished":
      return "Завершён";
  }
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gold/25 bg-black/60 px-5 py-3 backdrop-blur-sm">
      <div className="font-display text-xs font-medium uppercase tracking-[0.2em] text-gold/70">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-2xl font-bold ${accent} sm:text-3xl`}>
        {value}
      </div>
    </div>
  );
}
