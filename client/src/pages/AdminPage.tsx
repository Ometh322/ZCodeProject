import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Player, PresetDefinition } from "@poker-club/shared";
import { api } from "../api";
import { useTournamentState } from "../useTournamentState";
import { formatBlinds, formatChips, formatClock } from "../format";
import { ControlsBar } from "../components/ControlsBar";
import { LevelEditor } from "../components/LevelEditor";
import { PlayerTable } from "../components/PlayerTable";

/**
 * Admin control panel. Composes:
 *   1. Live status header — name, current level, timer, control bar.
 *   2. Tournament settings — name, pricing (4 purchase types × chips/cost), background.
 *   3. Level editor and player roster.
 *
 * Reads live state from the socket; persistent mutations go through REST and
 * the server re-syncs the socket, so the UI updates itself.
 */
export function AdminPage() {
  const { state, connected, send } = useTournamentState(true);
  const [presets, setPresets] = useState<PresetDefinition[]>([]);
  const [name, setName] = useState("");
  // Four purchase types, each with chips (added to stack) and cost (money).
  const [buyInChips, setBuyInChips] = useState("0");
  const [buyInCost, setBuyInCost] = useState("0");
  const [rebuyChips, setRebuyChips] = useState("0");
  const [rebuyCost, setRebuyCost] = useState("0");
  const [doubleRebuyChips, setDoubleRebuyChips] = useState("0");
  const [doubleRebuyCost, setDoubleRebuyCost] = useState("0");
  const [addonChips, setAddonChips] = useState("0");
  const [addonCost, setAddonCost] = useState("0");
  const [maxRebuys, setMaxRebuys] = useState("0");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getPresets().then(setPresets).catch(console.error);
  }, []);

  // Keep the settings form fields in sync with the live tournament.
  useEffect(() => {
    if (state) {
      setName(state.name);
      setBuyInChips(String(state.buyInChips));
      setBuyInCost(String(state.buyInCost));
      setRebuyChips(String(state.rebuyChips));
      setRebuyCost(String(state.rebuyCost));
      setDoubleRebuyChips(String(state.doubleRebuyChips));
      setDoubleRebuyCost(String(state.doubleRebuyCost));
      setAddonChips(String(state.addonChips));
      setAddonCost(String(state.addonCost));
      setMaxRebuys(String(state.maxRebuys));
    }
  }, [
    state?.id,
    state?.name,
    state?.buyInChips,
    state?.buyInCost,
    state?.rebuyChips,
    state?.rebuyCost,
    state?.doubleRebuyChips,
    state?.doubleRebuyCost,
    state?.addonChips,
    state?.addonCost,
    state?.maxRebuys,
  ]);

  function handleLogout() {
    api.logout();
    navigate("/login");
  }

  function buildPricing() {
    return {
      buyInChips: Number(buyInChips) || 0,
      buyInCost: Number(buyInCost) || 0,
      rebuyChips: Number(rebuyChips) || 0,
      rebuyCost: Number(rebuyCost) || 0,
      doubleRebuyChips: Number(doubleRebuyChips) || 0,
      doubleRebuyCost: Number(doubleRebuyCost) || 0,
      addonChips: Number(addonChips) || 0,
      addonCost: Number(addonCost) || 0,
      maxRebuys: Number(maxRebuys) || 0,
    };
  }

  async function saveSettings() {
    await api.saveTournament({
      name: name.trim() || "Без названия",
      ...buildPricing(),
    });
  }

  async function saveLevels(
    levels: Array<{
      durationSec: number;
      smallBlind: number;
      bigBlind: number;
      ante: number;
      isBreak: boolean;
      breakTitle: string | null;
    }>,
  ) {
    await api.saveTournament({
      name: name.trim() || "Без названия",
      ...buildPricing(),
      levels,
    });
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadBackground(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleClearBackground() {
    try {
      setUploadError(null);
      await api.clearBackground();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      await api.uploadLogo(file);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleClearLogo() {
    try {
      setLogoError(null);
      await api.clearLogo();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSoundUpload(
    type: "1min" | "10sec" | "level",
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadSound(type, file);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = "";
    }
  }

  async function handleClearSound(type: "1min" | "10sec" | "level") {
    try {
      await api.clearSound(type);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  if (!state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-xl text-slate-400">
        Загрузка…
      </div>
    );
  }

  const currentLevel = state.levels[state.currentLevelIndex];
  const backgroundUrl = state.backgroundImage ?? undefined;
  const logoUrl = state.logoImage ?? undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      {/* Header: live status + controls */}
      <header className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400" : "animate-pulse bg-red-500"
                }`}
              />
              {connected ? "Подключено" : "Переподключение…"}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{state.name}</h1>
            <div className="mt-1 text-slate-300">
              Уровень {state.currentLevelIndex + 1} / {state.levels.length}
              {currentLevel && (
                <span className="ml-2 font-mono">
                  · {formatBlinds(currentLevel.smallBlind, currentLevel.bigBlind, currentLevel.isBreak)}
                  {currentLevel.ante > 0 && ` · анте ${formatChips(currentLevel.ante)}`}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-4xl font-bold text-white">
              {formatClock(state.remainingSeconds)}
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 text-sm text-slate-400 hover:text-white"
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="mt-5">
          <ControlsBar state={state} send={send} />
        </div>
      </header>

      {/* Tournament settings */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-bold">Настройки турнира</h2>
        <label className="block max-w-md">
          <span className="mb-1 block text-sm text-slate-400">Название</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold"
          />
        </label>

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Покупки: фишки и стоимость
        </h3>
        {/* 2 rows × 4 columns: chips on top, cost below. Columns are
            Вход / Ребай / Двойной ребай / Аддон. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="w-24 pb-2 pr-3"></th>
                <th className="pb-2 pr-3">Вход</th>
                <th className="pb-2 pr-3">Ребай</th>
                <th className="pb-2 pr-3">Двойной ребай</th>
                <th className="pb-2 pr-3">Аддон</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-3 font-medium text-slate-400">Фишек</td>
                <td className="py-1 pr-3">
                  <NumCell value={buyInChips} onChange={setBuyInChips} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={rebuyChips} onChange={setRebuyChips} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={doubleRebuyChips} onChange={setDoubleRebuyChips} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={addonChips} onChange={setAddonChips} />
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-medium text-slate-400">Цена (₽)</td>
                <td className="py-1 pr-3">
                  <NumCell value={buyInCost} onChange={setBuyInCost} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={rebuyCost} onChange={setRebuyCost} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={doubleRebuyCost} onChange={setDoubleRebuyCost} />
                </td>
                <td className="py-1 pr-3">
                  <NumCell value={addonCost} onChange={setAddonCost} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 max-w-xs">
          <LabeledInput
            label="Макс. ребаев на игрока (0 = без лимита)"
            value={maxRebuys}
            onChange={setMaxRebuys}
            type="number"
          />
        </div>

        <div className="mt-5">
          <button
            onClick={saveSettings}
            className="rounded-lg bg-gold px-5 py-2 font-semibold text-black hover:brightness-110"
          >
            Сохранить настройки
          </button>
        </div>
      </section>

      {/* Background image */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-bold">Фон экрана турнира</h2>
        {uploadError && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {uploadError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-24 w-40 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {backgroundUrl ? (
              <img
                src={backgroundUrl}
                alt="Превью фона"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Нет фона
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              disabled={uploading}
              className="text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-black hover:file:brightness-110"
            />
            {state.backgroundImage && (
              <button
                onClick={handleClearBackground}
                className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm text-red-300 hover:bg-red-500/20"
              >
                Убрать фон
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Club logo */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-xl font-bold">Логотип клуба</h2>
        {logoError && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {logoError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-gold/30 bg-black/30">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Логотип"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Нет логотипа
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
              className="text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-black hover:file:brightness-110"
            />
            {state.logoImage && (
              <button
                onClick={handleClearLogo}
                className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm text-red-300 hover:bg-red-500/20"
              >
                Убрать логотип
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sound alerts */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-1 text-xl font-bold">Звуковые сигналы</h2>
        <p className="mb-4 text-xs text-slate-500">
          Загрузите свои звуки или оставьте пустым для синтезированного сигнала
          по умолчанию.
        </p>
        <div className="space-y-3">
          <SoundRow
            label="За 1 минуту до уровня"
            current={state.soundAlert1Min}
            onUpload={(e) => handleSoundUpload("1min", e)}
            onClear={() => handleClearSound("1min")}
          />
          <SoundRow
            label="За 10 секунд до уровня"
            current={state.soundAlert10Sec}
            onUpload={(e) => handleSoundUpload("10sec", e)}
            onClear={() => handleClearSound("10sec")}
          />
          <SoundRow
            label="Начало нового уровня"
            current={state.soundAlertLevel}
            onUpload={(e) => handleSoundUpload("level", e)}
            onClear={() => handleClearSound("level")}
          />
        </div>
      </section>

      <LevelEditor
        presets={presets}
        currentLevels={state.levels}
        onSave={saveLevels}
      />

      <PlayerTable
        state={state}
        onAdd={async (n) => {
          await api.addPlayer(n);
        }}
        onUpdate={async (id, patch: Partial<Player>) => {
          await api.updatePlayer(id, patch);
        }}
        onRemove={async (id) => {
          await api.removePlayer(id);
        }}
        onRebuy={async (id) => {
          await api.rebuy(id);
        }}
        onDoubleRebuy={async (id) => {
          await api.doubleRebuy(id);
        }}
        onAddon={async (id) => {
          await api.addon(id);
        }}
      />
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold"
      />
    </label>
  );
}

function NumCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-[8rem] rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white outline-none focus:border-gold"
    />
  );
}

/** One row of the sound alerts section: label + upload + optional clear. */
function SoundRow({
  label,
  current,
  onUpload,
  onClear,
}: {
  label: string;
  current: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-56 shrink-0 text-sm text-slate-300">{label}</span>
      <input
        type="file"
        accept="audio/*"
        onChange={onUpload}
        className="text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-gold file:px-3 file:py-1.5 file:font-semibold file:text-black hover:file:brightness-110"
      />
      <span className="text-xs text-slate-500">
        {current ? "загружен" : "по умолчанию"}
      </span>
      {current && (
        <button
          onClick={onClear}
          className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}
