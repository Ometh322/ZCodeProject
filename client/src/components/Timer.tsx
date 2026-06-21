import { formatClock } from "../format";

interface TimerProps {
  remainingSeconds: number;
  paused: boolean;
}

/**
 * The big MM:SS clock that dominates the display screen.
 *
 * Pulses amber while paused so the room notices it is not a freeze but a
 * deliberate pause. Goes red in the final minute of a level.
 */
export function Timer({ remainingSeconds, paused }: TimerProps) {
  const danger = !paused && remainingSeconds > 0 && remainingSeconds <= 60;
  const color = paused
    ? "text-amber-400"
    : danger
      ? "text-red-500"
      : "text-white";

  return (
    <div className="flex flex-col items-center">
      <div
        className={`font-mono font-extrabold leading-none tracking-tight ${color} ${
          paused ? "animate-pulse" : ""
        }`}
        style={{ fontSize: "clamp(6rem, 18vw, 16rem)" }}
      >
        {formatClock(remainingSeconds)}
      </div>
      <div className="mt-2 text-2xl font-semibold uppercase tracking-[0.3em] text-slate-400">
        {paused ? "Пауза" : danger ? "Финальная минута" : "До следующего уровня"}
      </div>
    </div>
  );
}
