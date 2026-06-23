import { useEffect, useRef, useState } from "react";
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
 * freely editable and rows can be added/removed/reordered. The structure can
 * also be exported to / imported from a JSON file.
 *
 * Numbering: break rows show "Перерыв" in the # column (they don't consume a
 * game-level number); playing levels are numbered 1, 2, 3 … counting only
 * non-break rows.
 */
type DraftLevel = Pick<
  Level,
  "durationSec" | "smallBlind" | "bigBlind" | "ante" | "isBreak" | "breakTitle"
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
  breakTitle: null,
};

/** Shape of a level entry in the exported/imported JSON file. */
interface LevelJsonEntry {
  number: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** Duration in minutes (human-friendly). */
  durationMin: number;
  isBreak: boolean;
  /** Present only when isBreak is true. */
  breakTitle?: string;
}

export function LevelEditor({ presets, currentLevels, onSave }: LevelEditorProps) {
  const [draft, setDraft] = useState<DraftLevel[]>(
    currentLevels.map((l) => ({
      durationSec: l.durationSec,
      smallBlind: l.smallBlind,
      bigBlind: l.bigBlind,
      ante: l.ante,
      isBreak: l.isBreak,
      breakTitle: l.breakTitle,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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
        breakTitle: l.breakTitle,
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

  /** Builds a game-level number for the row at `index` (breaks don't count). */
  function gameNumber(index: number): number | null {
    if (draft[index]?.isBreak) return null;
    let n = 0;
    for (let i = 0; i <= index; i++) if (!draft[i].isBreak) n += 1;
    return n;
  }

  /* ----------------------------- JSON export ----------------------------- */
  function handleExport() {
    const data: LevelJsonEntry[] = draft.map((l, i) => {
      const entry: LevelJsonEntry = {
        number: i + 1, // сплошная нумерация всех уровней (вкл. перерывы)
        smallBlind: l.smallBlind,
        bigBlind: l.bigBlind,
        ante: l.ante,
        durationMin: Math.round(l.durationSec / 60),
        isBreak: l.isBreak,
      };
      if (l.isBreak) entry.breakTitle = l.breakTitle ?? "Перерыв";
      return entry;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `levels-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ----------------------------- JSON import ----------------------------- */
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Ожидается массив уровней");
        const next: DraftLevel[] = parsed.map(
          (item: Record<string, unknown>, i: number) => {
            // `number` is ignored on import — it's derived from array position.
            void i;
            const isBreak = Boolean(item.isBreak);
            return {
              durationSec: Math.max(0, Math.round(Number(item.durationMin ?? 0) * 60)),
              smallBlind: isBreak ? 0 : Number(item.smallBlind ?? 0) || 0,
              bigBlind: isBreak ? 0 : Number(item.bigBlind ?? 0) || 0,
              ante: isBreak ? 0 : Number(item.ante ?? 0) || 0,
              isBreak,
              breakTitle: isBreak
                ? typeof item.breakTitle === "string" && item.breakTitle
                  ? item.breakTitle
                  : "Перерыв"
                : null,
            };
          },
        );
        setDraft(next);
        setDirty(true);
      } catch (err) {
        alert(
          "Не удалось импортировать JSON: " +
            (err instanceof Error ? err.message : String(err)),
        );
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.onerror = () => alert("Не удалось прочитать файл");
    reader.readAsText(file);
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
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={handleExport}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
            title="Скачать структуру в JSON-файл"
          >
            ⬇ Экспорт JSON
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
            title="Загрузить структуру из JSON-файла"
          >
            ⬆ Импорт JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
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
              <th className="pb-2 pr-3">Название паузы</th>
              <th className="pb-2 pr-3">Превью</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row, i) => {
              const gnum = gameNumber(i);
              return (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-slate-400">
                    {gnum ?? "Перерыв"}
                  </td>
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
                  <td className="py-2 pr-3">
                    {row.isBreak ? (
                      <input
                        type="text"
                        value={row.breakTitle ?? ""}
                        placeholder="Перерыв"
                        onChange={(e) =>
                          updateRow(i, { breakTitle: e.target.value || null })
                        }
                        className="w-32 rounded border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-gold"
                      />
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-slate-300">
                    {row.isBreak
                      ? row.breakTitle || "Перерыв"
                      : formatBlinds(row.smallBlind, row.bigBlind, row.isBreak)}
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
                              breakTitle: e.target.checked
                                ? row.breakTitle ?? "Перерыв"
                                : null,
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
              );
            })}
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
