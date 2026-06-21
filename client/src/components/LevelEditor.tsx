import { useEffect, useState } from "react";
import type {
  Level,
  PresetDefinition,
  PresetName,
} from "@poker-club/shared";
import { formatBlinds, formatClock } from "../format";

/**
 * Editable blind structure.
 *
 * The levels are edited in a local draft and pushed to the server only on
 * "Save". This keeps the wire format clean (one PUT per edit session) and lets
 * the operator experiment without each keystroke resetting the live timer.
 *
 * Presets populate the draft from shared definitions; once loaded every row is
 * freely editable and rows can be added/removed.
 */
type DraftLevel = Pick<
  Level,
  "durationSec" | "smallBlind" | "bigBlind" | "ante" | "isBreak"
>;

interface LevelEditorProps {
  presets: PresetDefinition[];
  currentLevels: Level[];
  onSave: (levels: DraftLevel[]) => Promise<void>;
}

const EMPTY_LEVEL: DraftLevel = {
  durationSec: 20 * 60,
  smallBlind: 0,
  bigBlind: 0,
  ante: 0,
  isBreak: false,
};

export function LevelEditor({ presets, currentLevels, onSave }: LevelEditorProps) {
  const [draft, setDraft] = useState<DraftLevel[]>(
    currentLevels.map((l) => ({
      durationSec: l.durationSec,
      smallBlind: l.smallBlind,
      bigBlind: l.bigBlind,
      ante: l.ante,
      isBreak: l.isBreak,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync the draft when the server-side structure changes externally
  // (e.g. another admin loads a preset).
  useEffect(() => {
    setDraft(
      currentLevels.map((l) => ({
        durationSec: l.durationSec,
        smallBlind: l.smallBlind,
        bigBlind: l.bigBlind,
        ante: l.ante,
        isBreak: l.isBreak,
      })),
    );
    setDirty(false);
  }, [currentLevels]);

  function loadPreset(name: PresetName) {
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    setDraft(preset.levels.map((l) => ({ ...l })));
    setDirty(true);
  }

  function updateRow(index: number, patch: Partial<DraftLevel>) {
    setDraft((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              ...patch,
              // Keep big blind in sync with small blind by default (2x) unless
              // the operator is editing a break or has manually overridden it.
              bigBlind:
                patch.smallBlind !== undefined && !row.isBreak
                  ? patch.smallBlind * 2
                  : patch.bigBlind ?? row.bigBlind,
            }
          : row,
      ),
    );
    setDirty(true);
  }

  function addRow() {
    setDraft((prev) => [...prev, { ...EMPTY_LEVEL }]);
    setDirty(true);
  }

  function removeRow(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  /** Moves a level up (-1) or down (+1) within the structure. No-op at edges. */
  function moveRow(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Структура блайндов</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Пресет:</span>
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPreset(p.name)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">Мин</th>
              <th className="pb-2 pr-3">Малый</th>
              <th className="pb-2 pr-3">Большой</th>
              <th className="pb-2 pr-3">Анте</th>
              <th className="pb-2 pr-3">Превью</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                <td className="py-2 pr-3">
                  <NumInput
                    value={Math.round(row.durationSec / 60)}
                    onChange={(v) => updateRow(i, { durationSec: v * 60 })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <NumInput
                    value={row.smallBlind}
                    disabled={row.isBreak}
                    onChange={(v) => updateRow(i, { smallBlind: v })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <NumInput
                    value={row.bigBlind}
                    disabled={row.isBreak}
                    onChange={(v) => updateRow(i, { bigBlind: v })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <NumInput
                    value={row.ante}
                    disabled={row.isBreak}
                    onChange={(v) => updateRow(i, { ante: v })}
                  />
                </td>
                <td className="py-2 pr-3 font-mono text-slate-300">
                  {formatBlinds(row.smallBlind, row.bigBlind, row.isBreak)}
                  <span className="ml-2 text-xs text-slate-500">
                    {formatClock(row.durationSec)}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveRow(i, -1)}
                        disabled={i === 0}
                        className="rounded px-1 text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Переместить вверх"
                        title="Переместить вверх"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveRow(i, 1)}
                        disabled={i === draft.length - 1}
                        className="rounded px-1 text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Переместить вниз"
                        title="Переместить вниз"
                      >
                        ▼
                      </button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={row.isBreak}
                        onChange={(e) =>
                          updateRow(i, {
                            isBreak: e.target.checked,
                            smallBlind: e.target.checked ? 0 : row.smallBlind,
                            bigBlind: e.target.checked ? 0 : row.bigBlind,
                            ante: e.target.checked ? 0 : row.ante,
                          })
                        }
                      />
                      Перерыв
                    </label>
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-300"
                      aria-label="Удалить уровень"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={addRow}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          + Добавить уровень
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-gold px-6 py-2 font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Сохранение…" : "Сохранить структуру"}
        </button>
      </div>
    </section>
  );
}

function NumInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-gold disabled:opacity-40"
    />
  );
}
