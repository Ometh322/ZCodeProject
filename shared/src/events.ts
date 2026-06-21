/**
 * Socket.IO event names shared between server and client.
 *
 * Grouped into:
 *   - SERVER_  events the server emits to clients (display + admin)
 *   - CLIENT_  control events the admin client emits to the server
 *
 * Keeping them as a single source of truth avoids the classic "typo in one
 * string breaks the whole sync" footgun.
 */

export const SERVER_EVENTS = {
  /** Full state snapshot (sent on connect and after structural changes). */
  STATE_FULL: "state:full",
  /** Periodic 1-second tick carrying the new remainingSeconds. */
  TIMER_TICK: "timer:tick",
  /** Active level changed (auto-advance or manual next/prev/setLevel). */
  LEVEL_CHANGED: "level:changed",
  /** Status changed (setup -> running -> paused -> finished). */
  STATUS_CHANGED: "status:changed",
  /** Player list changed (add / update / remove / re-enty). */
  PLAYERS_UPDATED: "players:updated",
  /** Tournament metadata changed (name, totalChips, levels structure). */
  TOURNAMENT_UPDATED: "tournament:updated",
} as const;

export const CLIENT_EVENTS = {
  PAUSE: "pause",
  RESUME: "resume",
  /** Jump to next level. */
  NEXT_LEVEL: "next:level",
  /** Jump to previous level. */
  PREVIOUS_LEVEL: "previous:level",
  /** Jump to an arbitrary level index. */
  SET_LEVEL: "set:level",
  /** Add seconds to the current level (negative values allowed to subtract). */
  ADD_TIME: "add:time",
  /** Reset the whole tournament back to setup with the current structure. */
  RESET: "reset",
} as const;

export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];
export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
