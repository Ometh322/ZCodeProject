import { formatClock } from "../format";

interface TimerProps {
  remainingSeconds: number;
  paused: boolean;
  /** Render variant; "center" sizes the clock for the three-column display. */
  layout?: "center";
}

/**
 * The big MM:SS clock that dominates the center of the display screen.
 *
 * Typography: Montserrat ExtraBold with tabular-nums so the digits don't shift
 * width while counting down (09 → 10 stays put). A restrained gold glow makes
 * it read as the screen's focal point. Pulses gold while paused; goes red in
 * the final minute of a level.
 */
export function Timer({ remainingSeconds, paused }: TimerProps) {
  const danger = !paused && remainingSeconds > 0 && remainingSeconds <= 60;
  // Normal: white with a soft glow. Paused: gold, pulsing. Danger: red.
  const clockClass = paused
    ? "text-gold glow-gold"
    : danger
      ? "text-red-500"
      : "text-white glow-gold-soft";

  return (
    <div className="flex flex-col items-center">
      <div
        className={`nums font-numeric font-extrabold leading-none tracking-tight ${clockClass} ${
          paused ? "animate-pulse" : ""
        }`}
        style={{ fontSize: "clamp(5rem, 13vw, 12rem)" }}
      >
        {formatClock(remainingSeconds)}
      </div>
      <div className="mt-3 font-heading text-xl font-medium uppercase tracking-[0.35em] text-gold/70 sm:text-2xl">
        {paused ? "Пауза" : danger ? "Финальная минута" : "До следующего уровня"}
      </div>
    </div>
  );
}
