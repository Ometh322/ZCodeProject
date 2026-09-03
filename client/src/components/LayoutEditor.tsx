import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LayoutConfig, LayoutItem } from "@poker-club/shared";
import { api } from "../api";

/**
 * Drag-n-drop + resize layout editor for the display screen.
 *
 * Design rules (per the club's pixel-perfect brief):
 *   - 8-pixel grid: every drag snaps to multiples of 8px; all coordinates are
 *     whole integers, so the saved layout renders identically on every screen.
 *   - Resize: each selected element has a bottom-right handle; dragging it
 *     changes a visual scale multiplier in 5% steps (CSS transform, so the
 *     document flow is never disturbed).
 *   - The visual grid overlay (8px fine lines, stronger every 64px) makes the
 *     snapping legible while arranging elements.
 *   - The bottom toolbar exposes numeric X/Y / size-% fields per element plus
 *     the side margin — two-way synced with dragging.
 *
 * Elements: the four center-column blocks (name, logo, blinds, timer) and the
 * two side rails (stats, info panels). In edit mode they all live on one
 * absolute-positioned canvas rooted at the screen container.
 */

const GRID = 8;
const SCALE_STEP = 0.05;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

const ELEMENT_KEYS = [
  "name",
  "logo",
  "blinds",
  "timer",
  "stats",
  "panels",
] as const;
type ElementKey = (typeof ELEMENT_KEYS)[number];

const ELEMENT_LABELS: Record<ElementKey, string> = {
  name: "Название",
  logo: "Логотип",
  blinds: "Блайнды",
  timer: "Таймер",
  stats: "Статистика",
  panels: "Панели",
};

const snap = (v: number): number => Math.round(v / GRID) * GRID;
const snapScale = (v: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(v / SCALE_STEP) * SCALE_STEP));

const DEFAULT_ITEM: LayoutItem = { x: 0, y: 0, scale: 1 };

/** Backfills a persisted config so every field exists (older saves may lack
 *  scale or the side-column keys). */
function normalizeConfig(raw: LayoutConfig | null): LayoutConfig {
  const item = (v: Partial<LayoutItem> | undefined): LayoutItem => ({
    x: v?.x ?? DEFAULT_ITEM.x,
    y: v?.y ?? DEFAULT_ITEM.y,
    scale: v?.scale ?? 1,
  });
  return {
    name: item(raw?.name),
    logo: item(raw?.logo),
    blinds: item(raw?.blinds),
    timer: item(raw?.timer),
    stats: item(raw?.stats),
    panels: item(raw?.panels),
    marginX: raw?.marginX ?? 24,
  };
}

interface LayoutEditorProps {
  /** Persisted config (null = first visit, positions measured from the flow). */
  initial: LayoutConfig | null;
  /** Rendered blocks by key. */
  children: Record<ElementKey, ReactNode>;
  /** Ref for the positioning canvas (the screen container). */
  containerRef: React.RefObject<HTMLElement | null>;
  onExit: () => void;
}

export function LayoutEditor({
  initial,
  children,
  containerRef,
  onExit,
}: LayoutEditorProps) {
  const [items, setItems] = useState<Record<ElementKey, LayoutItem>>(() => {
    const cfg = normalizeConfig(initial);
    return {
      name: cfg.name,
      logo: cfg.logo,
      blinds: cfg.blinds,
      timer: cfg.timer,
      stats: cfg.stats,
      panels: cfg.panels,
    };
  });
  const [marginX, setMarginX] = useState(initial?.marginX ?? 24);
  const [selected, setSelected] = useState<ElementKey>("name");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // First visit without a persisted config: render children in the normal flow,
  // measure, then switch to the absolute canvas.
  const [ready, setReady] = useState(initial !== null);
  const measured = useRef(false);

  useLayoutEffect(() => {
    if (measured.current) return;
    measured.current = true;
    if (initial) return;

    const container = containerRef.current;
    if (!container) {
      setReady(true);
      return;
    }

    const els = container.querySelectorAll<HTMLElement>("[data-layout-el]");
    setItems((prev) => {
      const next = { ...prev };
      els.forEach((el) => {
        const key = el.dataset.layoutEl as ElementKey;
        if (key) {
          next[key] = { ...next[key], x: snap(el.offsetLeft), y: snap(el.offsetTop) };
        }
      });
      return next;
    });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveItem = useCallback(
    (key: ElementKey, dx: number, dy: number, base: LayoutItem) => {
      const container = containerRef.current;
      const maxX = container ? container.clientWidth : 1920;
      setItems((prev) => {
        const x = Math.min(Math.max(0, snap(base.x + dx)), snap(maxX));
        const y = Math.max(0, snap(base.y + dy));
        return { ...prev, [key]: { ...prev[key], x, y } };
      });
    },
    [containerRef],
  );

  const scaleItem = useCallback((key: ElementKey, dScale: number, base: LayoutItem) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], scale: snapScale(base.scale + dScale) },
    }));
  }, []);

  const setField = (key: ElementKey, field: "x" | "y" | "scale", raw: string) => {
    const v = Number(raw);
    if (Number.isNaN(v)) return;
    setItems((prev) => ({
      ...prev,
      [key]:
        field === "scale"
          ? { ...prev[key], scale: snapScale(v) }
          : { ...prev[key], [field]: snap(v) },
    }));
  };

  async function handleSave() {
    setSaving("saving");
    try {
      await api.saveLayout({ ...items, marginX: snap(marginX) });
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1500);
    } catch {
      setSaving("error");
    }
  }

  async function handleReset() {
    if (!confirm("Сбросить макет к значениям по умолчанию?")) return;
    setSaving("saving");
    try {
      await api.resetLayout();
      setSaving("idle");
      onExit();
    } catch {
      setSaving("error");
    }
  }

  return (
    <>
      {/* Grid overlay: fine 8px lines, stronger every 64px. */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(253,200,108,0.05) 0 1px, transparent 1px 8px)," +
            "repeating-linear-gradient(to bottom, rgba(253,200,108,0.05) 0 1px, transparent 1px 8px)," +
            "repeating-linear-gradient(to right, rgba(253,200,108,0.12) 0 1px, transparent 1px 64px)," +
            "repeating-linear-gradient(to bottom, rgba(253,200,108,0.12) 0 1px, transparent 1px 64px)",
        }}
      />

      {/* Blocks. Before the measuring pass completes, render statically so
          offsetLeft/offsetTop reflect the real flow. */}
      {!ready
        ? ELEMENT_KEYS.map((key) => (
            <div key={key} data-layout-el>
              {children[key]}
            </div>
          ))
        : ELEMENT_KEYS.map((key) => (
            <DraggableBox
              key={key}
              item={items[key]}
              selected={selected === key}
              onSelect={() => setSelected(key)}
              onDrag={(dx, dy, base) => moveItem(key, dx, dy, base)}
              onResize={(dScale, base) => scaleItem(key, dScale, base)}
            >
              {children[key]}
            </DraggableBox>
          ))}

      {/* Toolbar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-black/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-x-5 gap-y-2">
          <span className="font-heading text-xs uppercase tracking-widest text-gold/70">
            Макет · шаг 8px
          </span>

          {ELEMENT_KEYS.map((key) => (
            <div
              key={key}
              className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs ${
                selected === key ? "bg-gold/20" : ""
              }`}
            >
              <button
                onClick={() => setSelected(key)}
                className={`w-20 text-left ${
                  selected === key ? "text-gold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {ELEMENT_LABELS[key]}
              </button>
              <input
                type="number"
                step={8}
                min={0}
                value={items[key].x}
                onChange={(e) => setField(key, "x", e.target.value)}
                className="w-14 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-smoke"
                aria-label={`${ELEMENT_LABELS[key]} X`}
              />
              <input
                type="number"
                step={8}
                min={0}
                value={items[key].y}
                onChange={(e) => setField(key, "y", e.target.value)}
                className="w-14 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-smoke"
                aria-label={`${ELEMENT_LABELS[key]} Y`}
              />
              <input
                type="number"
                step={5}
                min={50}
                max={300}
                value={Math.round(items[key].scale * 100)}
                onChange={(e) => setField(key, "scale", String(Number(e.target.value) / 100))}
                className="w-16 rounded border border-gold/25 bg-black/40 px-1.5 py-1 text-gold"
                aria-label={`${ELEMENT_LABELS[key]} размер %`}
                title="Размер, %"
              />
            </div>
          ))}

          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Отступ
            <input
              type="number"
              step={8}
              min={0}
              value={marginX}
              onChange={(e) => setMarginX(snap(Number(e.target.value) || 0))}
              className="w-16 rounded border border-white/15 bg-black/40 px-1.5 py-1 text-smoke"
            />
          </label>

          <div className="ml-auto flex gap-2">
            <button
              onClick={onExit}
              className="rounded border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
            >
              ✕ Выйти
            </button>
            <button
              onClick={handleReset}
              className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
            >
              ↺ Сбросить
            </button>
            <button
              onClick={handleSave}
              disabled={saving === "saving"}
              className="rounded bg-gold px-4 py-1.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
            >
              {saving === "saving"
                ? "Сохранение…"
                : saving === "saved"
                  ? "✓ Сохранено"
                  : saving === "error"
                    ? "Ошибка!"
                    : "💾 Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * One absolutely-positioned, draggable + resizable wrapper.
 * Drag moves {x, y} (8px snap); the bottom-right handle changes scale (5%
 * steps) via CSS transform so the flow is never disturbed.
 */
function DraggableBox({
  item,
  selected,
  onSelect,
  onDrag,
  onResize,
  children,
}: {
  item: LayoutItem;
  selected: boolean;
  onSelect: () => void;
  onDrag: (dx: number, dy: number, base: LayoutItem) => void;
  onResize: (dScale: number, base: LayoutItem) => void;
  children: ReactNode;
}) {
  const startRef = useRef<{
    px: number;
    py: number;
    base: LayoutItem;
    mode: "move" | "resize";
  } | null>(null);

  function begin(e: React.PointerEvent<HTMLDivElement>, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    startRef.current = { px: e.clientX, py: e.clientY, base: item, mode };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    begin(e, "move");
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = startRef.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (s.mode === "move") {
      onDrag(dx, dy, s.base);
    } else {
      // Horizontal drag maps to scale: 200px ≈ +100%.
      onResize(dx / 200, s.base);
    }
  }

  function endDrag() {
    startRef.current = null;
  }

  return (
    <div
      data-layout-el
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      className={`absolute z-10 cursor-grab touch-none select-none active:cursor-grabbing ${
        selected ? "outline-2 outline-dashed outline-gold/80" : ""
      }`}
      style={{
        left: `${item.x}px`,
        top: `${item.y}px`,
        transform: `scale(${item.scale})`,
        transformOrigin: "top left",
      }}
    >
      {children}
      {/* Resize handle — visible on the selected block. */}
      {selected && (
        <div
          onPointerDown={(e) => begin(e, "resize")}
          className="absolute -bottom-1 -right-1 h-4 w-4 cursor-nwse-resize rounded-sm border border-black/50 bg-gold"
          title="Изменить размер"
        />
      )}
    </div>
  );
}
