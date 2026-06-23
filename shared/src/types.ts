/**
 * Shared domain types used by both server and client.
 *
 * These mirror the Prisma models on the server and the state the display/admin
 * UIs render from. Keeping them in one place guarantees the wire format of every
 * Socket.IO event and REST response stays in sync.
 */

/** Lifecycle of a single tournament. */
export type TournamentStatus = "setup" | "running" | "paused" | "finished";

/** A single blinds level inside a tournament structure. */
export interface Level {
  id: string;
  /** 0-based position inside the structure. */
  order: number;
  /** Duration of this level in seconds. */
  durationSec: number;
  smallBlind: number;
  bigBlind: number;
  /** Ante for this level (0 when no ante). */
  ante: number;
  /** True when this is a scheduled break (no blinds shown). */
  isBreak: boolean;
  /** Optional custom title for a break level (e.g. "Обед"). Null = default "Перерыв". */
  breakTitle: string | null;
}

/** A registered player in the active tournament. */
export interface Player {
  id: string;
  name: string;
  /** Current chip count. */
  stack: number;
  eliminated: boolean;
  /** Order of the level at which the player was eliminated (null if still in). */
  eliminatedAtLevel: number | null;
  /** Number of single rebuys taken. */
  rebuyCount: number;
  /** Number of double rebuys taken. */
  doubleRebuyCount: number;
  /** Number of addons taken (typically 0 or 1). */
  addonCount: number;
  /**
   * Total cost the player owes (buy-in + rebuys + double rebuys + addon),
   * auto-calculated on the server from the tournament's pricing config. The UI
   * labels this "Стоимость" (cost). The player's outstanding debt is
   * `paidAmount - paidCash`.
   */
  paidAmount: number;
  /** Cash the player has actually handed to the cashier. Edited by the operator. */
  paidCash: number;
  /** Bounty tokens knocked out by this player. Edited by the operator via +/- . */
  bountyCount: number;
  /**
   * Global elimination rank: null while still in play, 1 = first eliminated,
   * last number = winner (last one standing). Assigned server-side on
   * elimination to avoid client races; the client reads but never sets it.
   */
  eliminationOrder: number | null;
}

/**
 * Full snapshot of the active tournament.
 *
 * Sent as the very first message when a client connects (`state:full`) and also
 * returned by the REST `GET /api/tournament` endpoint. Every incremental event
 * the client receives afterwards is just a delta on top of this shape.
 */
export interface TournamentState {
  id: string | null;
  name: string;
  status: TournamentStatus;
  levels: Level[];
  players: Player[];
  /** Index inside `levels` of the currently active level. */
  currentLevelIndex: number;
  /** Seconds remaining in the current level. */
  remainingSeconds: number;
  /** Total chips in play (sum of all player stacks; derived, read-only). */
  totalChips: number;
  startedAt: string | null;
  /** Relative URL of the uploaded background image, or null. */
  backgroundImage: string | null;
  /** Relative URL of the uploaded club logo, or null. */
  logoImage: string | null;
  /**
   * Relative URLs of optional custom sound files for the display alerts. When
   * null the client synthesizes a default tone via the Web Audio API.
   */
  soundAlert1Min: string | null;
  soundAlert10Sec: string | null;
  soundAlertLevel: string | null;

  // Four purchase types, each split into chips (added to stack) and cost
  // (added to paidAmount). They are independent: a rebuy can grant 10000 chips
  // while costing 5000.
  buyInChips: number;
  buyInCost: number;
  rebuyChips: number;
  rebuyCost: number;
  doubleRebuyChips: number;
  doubleRebuyCost: number;
  addonChips: number;
  addonCost: number;
  /** Maximum rebuys (single + double combined) per player. 0 = unlimited. */
  maxRebuys: number;
}

/** POST /api/login */
export interface LoginRequest {
  password: string;
}

/** POST /api/login response */
export interface LoginResponse {
  token: string;
  expiresAt: string;
}

/** Body for creating / updating the active tournament. */
export interface UpsertTournamentInput {
  name: string;
  /** Preset name to seed levels from, or null to keep manual editing. */
  preset?: PresetName | null;
  /** When provided, fully replaces the level structure. */
  levels?: Array<
    Pick<Level, "durationSec" | "smallBlind" | "bigBlind" | "ante" | "isBreak" | "breakTitle">
  >;
  /** Four purchase types, each split into chips / cost. All optional, default 0. */
  buyInChips?: number;
  buyInCost?: number;
  rebuyChips?: number;
  rebuyCost?: number;
  doubleRebuyChips?: number;
  doubleRebuyCost?: number;
  addonChips?: number;
  addonCost?: number;
  /** Maximum rebuys per player. 0 = unlimited. */
  maxRebuys?: number;
}

/** Body for adding a player. Stack is derived from the tournament's buyInChips. */
export interface AddPlayerInput {
  name: string;
}

/** Body for updating an existing player. */
export interface UpdatePlayerInput {
  name?: string;
  stack?: number;
  eliminated?: boolean;
  eliminatedAtLevel?: number | null;
  rebuyCount?: number;
  doubleRebuyCount?: number;
  addonCount?: number;
  /** Cash the player has handed to the cashier. */
  paidCash?: number;
  /** Bounty token count, edited via +/- in the roster. */
  bountyCount?: number;
}

/** Names of the built-in blind structure presets. */
export type PresetName = "regular" | "turbo" | "deepstack";

/** Public shape of a preset (used by both server seed and client UI). */
export interface PresetDefinition {
  name: PresetName;
  label: string;
  description: string;
  levels: Array<
    Pick<Level, "durationSec" | "smallBlind" | "bigBlind" | "ante" | "isBreak" | "breakTitle">
  >;
}
