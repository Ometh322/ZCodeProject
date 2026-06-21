/** Small formatting helpers shared by display + admin UIs. */

/** 125 -> "02:05", 3600 -> "01:00:00". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** 1500 -> "1 500", 1250000 -> "1 250 000". Thin space as thousands separator. */
export function formatChips(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** Human label for the blinds of a level: "100 / 200", "BREAK", or "—". */
export function formatBlinds(
  small: number,
  big: number,
  isBreak?: boolean,
): string {
  if (isBreak || (!small && !big)) return "BREAK";
  return `${formatChips(small)} / ${formatChips(big)}`;
}
