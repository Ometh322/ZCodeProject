import { useState } from "react";
import * as XLSX from "xlsx";
import type { Player, TournamentState } from "@poker-club/shared";
import { formatChips } from "../format";

interface PlayerTableProps {
  state: TournamentState;
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Player>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRebuy: (id: string) => Promise<void>;
  onDoubleRebuy: (id: string) => Promise<void>;
  onAddon: (id: string) => Promise<void>;
  /** Clear the entire roster (with confirmation handled by the caller). */
  onClearAll: () => Promise<void>;
}

/**
 * Player roster. Registration takes only a name — the server grants the
 * tournament's startingStack automatically. Each row shows:
 *   - name (inline editable)
 *   - current stack (inline editable)
 *   - rebuy / addon buttons (shown while pricing is configured and the player
 *     is still in; rebuys respect maxRebuys)
 *   - Стоимость (paidAmount): buy-in + rebuys + addon, computed server-side
 *   - Внесено (paidCash): what the player has handed the cashier — editable
 *   - Долг: paidAmount − paidCash, red when the player still owes money
 */
export function PlayerTable({
  state,
  onAdd,
  onUpdate,
  onRemove,
  onRebuy,
  onDoubleRebuy,
  onAddon,
  onClearAll,
}: PlayerTableProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rebuyConfigured = state.rebuyChips > 0;
  const doubleRebuyConfigured = state.doubleRebuyChips > 0;
  const addonConfigured = state.addonChips > 0;
  const anyRebuyConfigured =
    rebuyConfigured || doubleRebuyConfigured || addonConfigured;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setError(null);
      await onAdd(newName.trim());
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function guarded(fn: () => Promise<void>) {
    try {
      setError(null);
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Export the full roster to an .xlsx file with all player fields. */
  function handleExportExcel() {
    if (state.players.length === 0) return;
    const rows = state.players.map((p, i) => ({
      "№": i + 1,
      "Игрок": p.name,
      "Стек": p.stack,
      "Стоимость": p.paidAmount,
      "Внесено": p.paidCash,
      "Долг": p.paidAmount - p.paidCash,
      "Ребаи": p.rebuyCount,
      "Двойные ребаи": p.doubleRebuyCount,
      "Аддоны": p.addonCount,
      "Баунти": p.bountyCount,
      "Выбыл": p.eliminated ? "Да" : "Нет",
      "Место": p.eliminationOrder ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Игроки");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `players-${date}.xlsx`);
  }

  async function handleClearAll() {
    if (state.players.length === 0) return;
    if (
      !confirm(
        `Удалить ВСЕХ игроков (${state.players.length})? Это действие необратимо.`,
      )
    )
      return;
    await guarded(() => onClearAll());
  }

  // Keep players in their registration order (the server returns them by
  // createdAt). We only group eliminated players at the bottom — we do NOT
  // re-sort by stack, otherwise a rebuy/addon would jump the player up the
  // list, disorienting the operator mid-tournament.
  const sorted = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return 0;
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Игроки{" "}
          <span className="text-base font-normal text-slate-400">
            ({state.players.filter((p) => !p.eliminated).length} в игре)
          </span>
        </h2>
        {state.players.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
              title="Выгрузить список игроков в Excel"
            >
              ⬇ Excel
            </button>
            <button
              onClick={handleClearAll}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
              title="Удалить всех игроков"
            >
              🗑 Очистить
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Имя игрока"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="rounded-lg bg-gold px-4 py-2 font-semibold text-black hover:brightness-110"
        >
          Добавить
        </button>
      </form>
      <p className="mb-4 -mt-2 text-xs text-slate-500">
        Новый игрок получает входной набор: {formatChips(state.buyInChips)} фишек · {formatChips(state.buyInCost)} ₽
      </p>

      {error && (
        <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="pb-2 pr-3">Игрок</th>
              <th className="pb-2 pr-3">Стек</th>
              <th className="pb-2 pr-3">Стоимость</th>
              <th className="pb-2 pr-3">Внесено</th>
              <th className="pb-2 pr-3">Долг</th>
              <th className="pb-2 pr-3">Баунти</th>
              <th className="pb-2 pr-3">Место</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-slate-500">
                  Пока никого нет — добавьте игроков выше.
                </td>
              </tr>
            )}
            {sorted.map((p) => {
              const rebuyLimitReached =
                state.maxRebuys > 0 &&
                p.rebuyCount + p.doubleRebuyCount >= state.maxRebuys;
              const debt = p.paidAmount - p.paidCash;
              return (
                <tr
                  key={p.id}
                  className={`border-t border-white/5 ${
                    p.eliminated ? "opacity-40" : ""
                  }`}
                >
                  <td className="py-2 pr-3">
                    <input
                      defaultValue={p.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== p.name) void onUpdate(p.id, { name: v });
                      }}
                      className="w-full bg-transparent px-1 py-0.5 text-white outline-none focus:bg-black/30"
                    />
                    {(p.rebuyCount > 0 || p.doubleRebuyCount > 0 || p.addonCount > 0) && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {p.rebuyCount > 0 && `Ребаи: ${p.rebuyCount}`}
                        {p.rebuyCount > 0 && p.doubleRebuyCount > 0 && " · "}
                        {p.doubleRebuyCount > 0 && `Двойные: ${p.doubleRebuyCount}`}
                        {(p.rebuyCount > 0 || p.doubleRebuyCount > 0) && p.addonCount > 0 && " · "}
                        {p.addonCount > 0 && `Аддон: ${p.addonCount}`}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      defaultValue={p.stack}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.stack) void onUpdate(p.id, { stack: v });
                      }}
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-white outline-none focus:border-gold focus:bg-black/30"
                    />
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-300">
                    {formatChips(p.paidAmount)}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      defaultValue={p.paidCash}
                      min={0}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value));
                        if (v !== p.paidCash) void onUpdate(p.id, { paidCash: v });
                      }}
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-white outline-none focus:border-gold focus:bg-black/30"
                    />
                  </td>
                  <td
                    className={`py-2 pr-3 font-mono font-semibold ${
                      debt > 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {debt > 0 ? formatChips(debt) : "Оплачено"}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          onUpdate(p.id, { bountyCount: Math.max(0, p.bountyCount - 1) })
                        }
                        className="h-6 w-6 rounded bg-white/10 text-slate-300 hover:bg-white/20"
                        aria-label="Убрать баунти"
                        title="−1 баунти"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-mono text-gold">
                        {p.bountyCount}
                      </span>
                      <button
                        onClick={() => onUpdate(p.id, { bountyCount: p.bountyCount + 1 })}
                        className="h-6 w-6 rounded bg-white/10 text-slate-300 hover:bg-white/20"
                        aria-label="Добавить баунти"
                        title="+1 баунти"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-center font-mono text-slate-300">
                    {p.eliminationOrder !== null ? (
                      <span className="rounded bg-gold/15 px-2 py-0.5 font-bold text-gold">
                        {ordinal(p.eliminationOrder)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {anyRebuyConfigured && !p.eliminated && (
                        <>
                          {rebuyConfigured && (
                            <ActionButton
                              disabled={rebuyLimitReached}
                              onClick={() => guarded(() => onRebuy(p.id))}
                              tone="blue"
                              title={
                                rebuyLimitReached
                                  ? `Лимит ребаев (${state.maxRebuys})`
                                  : `Ребай (+${formatChips(state.rebuyChips)} фишек, +${formatChips(state.rebuyCost)} ₽)`
                              }
                            >
                              Ребай
                            </ActionButton>
                          )}
                          {doubleRebuyConfigured && (
                            <ActionButton
                              disabled={rebuyLimitReached}
                              onClick={() => guarded(() => onDoubleRebuy(p.id))}
                              tone="indigo"
                              title={`Двойной ребай (+${formatChips(state.doubleRebuyChips)} фишек, +${formatChips(state.doubleRebuyCost)} ₽)`}
                            >
                              2× Ребай
                            </ActionButton>
                          )}
                          {addonConfigured && (
                            <ActionButton
                              onClick={() => guarded(() => onAddon(p.id))}
                              tone="purple"
                              title={`Аддон (+${formatChips(state.addonChips)} фишек, +${formatChips(state.addonCost)} ₽)`}
                            >
                              Аддон
                            </ActionButton>
                          )}
                        </>
                      )}
                      <button
                        onClick={() =>
                          onUpdate(p.id, {
                            eliminated: !p.eliminated,
                            eliminatedAtLevel: !p.eliminated
                              ? state.currentLevelIndex
                              : null,
                          })
                        }
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          p.eliminated
                            ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                            : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        }`}
                      >
                        {p.eliminated ? "Вернуть" : "Вылет"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Удалить «${p.name}»?`)) void onRemove(p.id);
                        }}
                        className="rounded px-2 py-1 text-xs text-slate-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "blue" | "indigo" | "purple";
  title?: string;
}) {
  const cls = {
    blue: "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30",
    indigo: "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30",
    purple: "bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/30",
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium ${cls} disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

/** 1 -> "1-е", 2 -> "2-е", 21 -> "21-е". Russian ordinal suffix. */
function ordinal(n: number): string {
  return `${n}-е`;
}
