import type { TournamentState } from "@poker-club/shared";
import { formatChips } from "../format";

interface StatsBarProps {
  state: TournamentState;
}

/**
 * The strip of secondary stats under the timer.
 *
 *   - Средний стек: totalChips (derived from live stacks) / players still in.
 *   - В игре: remaining / total players.
 *   - Призовой фонд: sum of every player's paidAmount (buy-in + rebuys + addons).
 *   - Ребай-мастер: player with the most rebuys this tournament (hidden if none).
 *
 * All values come straight from the server's `state:full` snapshot, so they
 * stay in sync across every screen the moment an admin makes a change.
 */
export function StatsBar({ state }: StatsBarProps) {
  const playersRemaining = state.players.filter((p) => !p.eliminated).length;
  const totalPlayers = state.players.length;
  const averageStack =
    playersRemaining > 0 ? Math.round(state.totalChips / playersRemaining) : 0;

  const prizePool = state.players.reduce((sum, p) => sum + p.paidAmount, 0);

  // Rebuy master: the player with the highest rebuyCount. Only shown when at
  // least one rebuy has been taken in the tournament.
  const rebuyMaster = [...state.players]
    .filter((p) => p.rebuyCount > 0)
    .sort((a, b) => b.rebuyCount - a.rebuyCount)[0];

  const showRebuyMaster = Boolean(rebuyMaster);

  return (
    <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
      <Stat label="Средний стек" value={formatChips(averageStack)} />
      <Stat label="В игре" value={`${playersRemaining} / ${totalPlayers}`} />
      <Stat
        label="Призовой фонд"
        value={formatChips(prizePool)}
        accent="text-gold"
      />
      {showRebuyMaster ? (
        <Stat
          label={`Шейх дня · ${rebuyMaster!.rebuyCount + rebuyMaster!.doubleRebuyCount * 2}`}
          value={rebuyMaster!.name}
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
    <div className="rounded-2xl border border-gold/25 bg-black/60 px-6 py-4 text-center backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-gold/70">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
