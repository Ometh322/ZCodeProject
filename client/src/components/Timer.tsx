import { formatClock } from "../format";

interface TimerProps {
  remainingSeconds: number;
  paused: boolean;
  /** Render variant; "center" sizes the clock for the three-column display. */
  layout?: "center";
  /** Clock font size in px, provided by the adaptive sizing hook. Falls back to
   *  clamp() when not supplied. */
  clockFontSize?: number;
  /** Caption font size in px. */
  labelFontSize?: number;
}

/**
 * The big MM:SS clock that dominates the center of the display screen.
 *
 * Typography: Montserrat ExtraBold with tabular-nums so the digits don't shift
 * width while counting down (09 → 10 stays put). A restrained gold glow makes
 * it read as the screen's focal point. Pulses gold while paused; goes red in
 * the final minute of a level.
 *
 * `whitespace-nowrap` guarantees the time never wraps even if the measured
 * width was optimistic.
 */
export function Timer({
  remainingSeconds,
  paused,
  clockFontSize,
  labelFontSize,
}: TimerProps) {
  const danger = !paused && remainingSeconds > 0 && remainingSeconds <= 60;
  // Normal: white with a soft glow. Paused: gold, pulsing. Danger: red.
  const clockClass = paused
    ? "text-gold glow-gold"
    : danger
      ? "text-red-500"
      : "text-white glow-gold-soft";

  const clockStyle = clockFontSize
    ? { fontSize: `${clockFontSize}px` }
    : { fontSize: "clamp(5rem, 13vw, 12rem)" };
  const captionStyle = labelFontSize
    ? { fontSize: `${labelFontSize}px` }
    : undefined;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`nums font-numeric font-extrabold leading-none tracking-tight whitespace-nowrap ${clockClass} ${
          paused ? "animate-pulse" : ""
        }`}
        style={clockStyle}
      >
        {formatClock(remainingSeconds)}
      </div>
      <div
        className="mt-3 font-heading font-medium uppercase tracking-[0.35em] text-gold/70"
        style={captionStyle ?? { fontSize: "clamp(1.25rem, 2vw, 1.5rem)" }}
      >
        {paused ? "Пауза" : danger ? "Финальная минута" : "До следующего уровня"}
      </div>
    </div>
  );
}
