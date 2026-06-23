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
 * Rendered as a vertical stack of cards in the left rail. Per the black-and-gold
 * rule set, gold is reserved for the prize pool (the hero stat) — everything
 * else is light grey/white so the eye lands on the money.
 */
export function StatsBar({ state }: StatsBarProps) {
  const playersRemaining = state.players.filter((p) => !p.eliminated).length;
  const totalPlayers = state.players.length;
  const averageStack =
    playersRemaining > 0 ? Math.round(state.totalChips / playersRemaining) : 0;

  const rebuyMaster = [...state.players]
    .filter((p) => p.rebuyCount > 0)
    .sort((a, b) => b.rebuyCount - a.rebuyCount)[0];

  return (
    <div className="flex w-full flex-col gap-3">
      <Stat label="Средний стек" value={formatChips(averageStack)} />
      <Stat label="В игре" value={`${playersRemaining} / ${totalPlayers}`} />
      {/* Total chips in play (sum of all player stacks). Gold + glow as the
          hero stat. Contrast with the prize pool, which is money — this card
          is about the actual chips on the tables. */}
      <Stat
        label="Фишек в игре"
        value={formatChips(state.totalChips)}
        accent="text-gold glow-gold-soft"
      />
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
          accent={state.status === "running" ? "text-emerald-400" : "text-slate-300"}
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
  accent = "text-slate-100",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gold/20 bg-black/40 px-6 py-4 backdrop-blur-sm">
      <div className="font-heading text-sm font-medium uppercase tracking-[0.2em] text-gold/60 sm:text-base">
        {label}
      </div>
      <div className={`nums mt-1 font-numeric text-3xl font-bold ${accent} sm:text-4xl`}>
        {value}
      </div>
    </div>
  );
}
