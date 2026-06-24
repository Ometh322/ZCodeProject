import { useLayoutEffect, useRef, useState } from "react";

/**
 * Measures the available width of the display center column and derives
 * font sizes that guarantee every key element fits on one line.
 *
 * Problem this solves: the blinds string (e.g. "50 000 / 100 000") and the
 * timer (MM:SS / HH:MM:SS) are rendered at a fixed `clamp()` size. On a narrow
 * screen or a very large blinds value that size overflows the center column and
 * wraps to two lines, which looks broken on a hall TV.
 *
 * Approach: measure the actual pixel width the center column gives us, then
 * scale the headline font so the longest possible text (the current blinds
 * string) fits within ~92% of that width with a small safety margin. The other
 * elements (timer, tournament name) scale proportionally off the same base.
 *
 * We do the measurement with a canvas-based text-width probe (2d context
 * measureText) rather than DOM feedback loops — one pass, no layout thrash.
 */
export interface DisplaySizes {
  /** Font size in px for the big blinds / break-title headline. */
  blinds: number;
  /** Font size in px for the MM:SS timer. */
  timer: number;
  /** Font size in px for the tournament name (h1). */
  title: number;
  /** Diameter in px for the club logo image. */
  logo: number;
  /** Font size in px for the "Уровень N" Oswald label. */
  label: number;
}

/** Minimum sizes so we never shrink below legibility on tiny screens. */
const MIN_BLINDS = 40;
const MIN_TIMER = 48;
const MIN_TITLE = 28;
const MIN_LOGO = 96;
const MIN_LABEL = 14;

export function useDisplaySizes(
  /** The blinds string currently shown, e.g. "10 000 / 20 000". Used to size
   *  the headline so it provably fits. */
  blindsText: string,
): {
  containerRef: React.MutableRefObject<HTMLElement | null>;
  sizes: DisplaySizes;
} {
  const containerRef = useRef<HTMLElement | null>(null);
  const [sizes, setSizes] = useState<DisplaySizes>({
    blinds: 96,
    timer: 96,
    title: 56,
    logo: 160,
    label: 20,
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Shared canvas for text-width probing (created lazily, reused).
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const compute = () => {
      const available = el.clientWidth;
      if (available <= 0) return;

      // Target: the blinds string should occupy at most ~92% of the column.
      const targetWidth = available * 0.92;

      // Find the largest font size whose rendered blinds text fits targetWidth.
      // Binary search between a sane min and a generous max.
      let lo = MIN_BLINDS;
      let hi = 240; // 15rem — bigger than any realistic screen needs
      let blindsPx = MIN_BLINDS;
      if (ctx) {
        while (lo <= hi) {
          const mid = (lo + hi) / 2;
          ctx.font = `800 ${mid}px Montserrat, sans-serif`;
          const w = ctx.measureText(blindsText || "100 000 / 200 000").width;
          if (w <= targetWidth) {
            blindsPx = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
      }

      // Derive the other sizes proportionally off the blinds size.
      const timerPx = Math.max(MIN_TIMER, blindsPx * 0.82);
      const titlePx = Math.max(MIN_TITLE, blindsPx * 0.58);
      const logoPx = Math.max(MIN_LOGO, blindsPx * 1.5);
      const labelPx = Math.max(MIN_LABEL, blindsPx * 0.22);

      setSizes({
        blinds: Math.round(blindsPx),
        timer: Math.round(timerPx),
        title: Math.round(titlePx),
        logo: Math.round(logoPx),
        label: Math.round(labelPx),
      });
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [blindsText]);

  return { containerRef, sizes };
}
