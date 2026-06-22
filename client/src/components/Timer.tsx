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
 * Pulses gold while paused so the room notices it is not a freeze but a
 * deliberate pause. Goes red in the final minute of a level.
 */
export function Timer({ remainingSeconds, paused }: TimerProps) {
  const danger = !paused && remainingSeconds > 0 && remainingSeconds <= 60;
  const color = paused ? "text-gold" : danger ? "text-red-500" : "text-white";

  return (
    <div className="flex flex-col items-center">
      <div
        className={`font-mono font-extrabold leading-none tracking-tight ${color} ${
          paused ? "animate-pulse" : ""
        }`}
        style={{ fontSize: "clamp(4rem, 11vw, 10rem)" }}
      >
        {formatClock(remainingSeconds)}
      </div>
      <div className="mt-3 font-display text-xl font-medium uppercase tracking-[0.3em] text-gold/70 sm:text-2xl">
        {paused ? "Пауза" : danger ? "Финальная минута" : "До следующего уровня"}
      </div>
    </div>
  );
}
