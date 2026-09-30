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
  /** Custom display layout (drag-n-drop editor), or null for the default flex layout. */
  layoutConfig: LayoutConfig | null;
}

/**
 * A single block's placement on the display canvas: position and size in
 * pixels from the top-left corner of the screen. All values are whole
 * multiples of 8 (pixel-perfect, snapped by the layout editor). The block is
 * a FIXED rectangle — its content is scaled and centered to fit inside
 * (see FitBox), never the other way around.
 */
export interface LayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Custom display-screen layout produced by the drag-n-drop editor.
 * Keys address the six draggable blocks: the four center-column elements
 * plus the two side columns (stats rail and info panels).
 */
export interface LayoutConfig {
  name: LayoutItem;
  logo: LayoutItem;
  blinds: LayoutItem;
  timer: LayoutItem;
  stats: LayoutItem;
  panels: LayoutItem;
  /** Horizontal side margin of the canvas, px (multiple of 8). */
  marginX: number;
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

/**
 * A media file (logo / alert sound) embedded into a settings preset file as
 * base64, so a single JSON document carries the whole club setup.
 */
export interface PresetMedia {
  /** Original file name, kept for a readable export and extension detection. */
  filename: string;
  /** MIME type, e.g. "image/png" or "audio/wav". */
  mimeType: string;
  /** Raw file bytes, base64-encoded. */
  dataBase64: string;
}

/**
 * A portable settings snapshot ("preset file") that can be exported from and
 * imported back into the admin panel. Covers everything a club needs to clone
 * a setup onto another machine: tournament name, pricing, the full blind
 * structure, the display-screen layout and the uploaded logo/sound binaries.
 *
 * Deliberately NOT included: players, timer position, status and other live
 * game state — a preset configures a tournament, it does not clone a game.
 */
export interface TournamentPreset {
  /** Constant discriminator, makes the file self-describing. */
  format: "flash-poker-preset";
  /** Shape version — bump on breaking changes, import rejects unknown ones. */
  version: 1;
  /** ISO timestamp of the export moment. */
  exportedAt: string;
  /** Tournament name. */
  name: string;
  /** Purchase pricing: chips and cost for all four purchase types + rebuy cap. */
  pricing: {
    buyInChips: number;
    buyInCost: number;
    rebuyChips: number;
    rebuyCost: number;
    doubleRebuyChips: number;
    doubleRebuyCost: number;
    addonChips: number;
    addonCost: number;
    maxRebuys: number;
  };
  /** Full blind structure (levels + breaks, in order). Replaces on import. */
  levels: Array<
    Pick<Level, "durationSec" | "smallBlind" | "bigBlind" | "ante" | "isBreak" | "breakTitle">
  >;
  /** Saved display-screen layout, or null for the default layout. */
  layoutConfig: LayoutConfig | null;
  /** Embedded binaries; null entries mean "no custom file for this slot". */
  media: {
    logo: PresetMedia | null;
    sound1min: PresetMedia | null;
    sound10sec: PresetMedia | null;
    soundLevel: PresetMedia | null;
  };
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
