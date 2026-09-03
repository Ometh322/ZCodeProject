import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A fixed-size block that scales AND centers its content to fit inside.
 *
 * The block rectangle is authoritative: whatever it contains (long blinds
 * strings, big timers, stat rails) is rendered at natural size on an
 * untransformed inner layer, measured, then uniformly scaled by
 * `min(w / contentW, h / contentH)` and centered. When the content changes
 * (level advanced, blinds grew, a stat updated) the ResizeObserver re-measures
 * and re-fits automatically — so every tournament level stays inside its block.
 *
 * transform doesn't affect layout, so the measured content size is stable and
 * the observe → scale cycle can't loop.
 */
export function FitBox({
  w,
  h,
  children,
  className = "",
  debug = false,
}: {
  w: number;
  h: number;
  children: ReactNode;
  className?: string;
  /** Draw the block outline — used by the layout editor. */
  debug?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const fit = () => {
      const cw = el.scrollWidth;
      const ch = el.scrollHeight;
      if (cw === 0 || ch === 0) return;
      const k = Math.min(w / cw, h / ch);
      setScale(k);
    };

    fit();
    // Re-fit whenever the content's natural size changes (new blinds value,
    // longer prize pool, etc.) — keeps every level inside the block.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  return (
    <div
      className={`relative overflow-hidden ${className} ${
        debug ? "border border-dashed border-gold/40" : ""
      }`}
      style={{ width: `${w}px`, height: `${h}px` }}
    >
      <div
        ref={innerRef}
        className="absolute left-1/2 top-1/2 whitespace-nowrap"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
