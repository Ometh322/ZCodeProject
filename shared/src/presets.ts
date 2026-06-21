import type { PresetDefinition, PresetName } from "./types.js";

/**
 * Built-in blind structure presets.
 *
 * Progressions follow common small-stakes club conventions:
 *   - Big blind roughly doubles every 2 levels early on, then accelerates.
 *   - Antes kick in around level 4-5.
 *   - A scheduled break is inserted after every 3-4 levels (isBreak = true).
 *
 * Durations are in seconds (Regular = 20 min, Turbo = 10 min, Deep = 30 min).
 */

/** Helper to build a regular blinds level. */
function level(
  smallBlind: number,
  durationSec: number,
  ante = 0,
): PresetDefinition["levels"][number] {
  return {
    durationSec,
    smallBlind,
    bigBlind: smallBlind * 2,
    ante,
    isBreak: false,
  };
}

/** 5-minute break level. */
const BREAK: PresetDefinition["levels"][number] = {
  durationSec: 5 * 60,
  smallBlind: 0,
  bigBlind: 0,
  ante: 0,
  isBreak: true,
};

const REGULAR: PresetDefinition = {
  name: "regular",
  label: "Regular",
  description: "20-минутные уровни, плавный рост блайндов. Классическая структура.",
  levels: [
    level(10, 20 * 60),
    level(15, 20 * 60),
    level(25, 20 * 60),
    level(50, 20 * 60, 50),
    level(75, 20 * 60, 75),
    BREAK,
    level(100, 20 * 60, 100),
    level(150, 20 * 60, 150),
    level(200, 20 * 60, 200),
    level(300, 20 * 60, 300),
    BREAK,
    level(400, 20 * 60, 400),
    level(600, 20 * 60, 600),
    level(800, 20 * 60, 800),
    level(1000, 20 * 60, 1000),
    BREAK,
    level(1500, 20 * 60, 1500),
    level(2000, 20 * 60, 2000),
    level(3000, 20 * 60, 3000),
    level(5000, 20 * 60, 5000),
  ],
};

const TURBO: PresetDefinition = {
  name: "turbo",
  label: "Turbo",
  description: "10-минутные уровни, агрессивный рост. Быстрые турниры.",
  levels: [
    level(10, 10 * 60),
    level(25, 10 * 60),
    level(50, 10 * 60, 25),
    level(100, 10 * 60, 100),
    BREAK,
    level(200, 10 * 60, 200),
    level(400, 10 * 60, 400),
    level(600, 10 * 60, 600),
    level(1000, 10 * 60, 1000),
    BREAK,
    level(1500, 10 * 60, 1500),
    level(2500, 10 * 60, 2500),
    level(4000, 10 * 60, 4000),
    level(6000, 10 * 60, 6000),
    BREAK,
    level(8000, 10 * 60, 8000),
    level(12000, 10 * 60, 12000),
    level(20000, 10 * 60, 20000),
  ],
};

const DEEPSTACK: PresetDefinition = {
  name: "deepstack",
  label: "Deep Stack",
  description: "30-минутные уровни, медленный старт. Игра навыка, а не удачи.",
  levels: [
    level(5, 30 * 60),
    level(10, 30 * 60),
    level(15, 30 * 60),
    level(25, 30 * 60, 25),
    level(50, 30 * 60, 50),
    BREAK,
    level(75, 30 * 60, 75),
    level(100, 30 * 60, 100),
    level(150, 30 * 60, 150),
    level(200, 30 * 60, 200),
    BREAK,
    level(300, 30 * 60, 300),
    level(400, 30 * 60, 400),
    level(600, 30 * 60, 600),
    level(800, 30 * 60, 800),
    BREAK,
    level(1000, 30 * 60, 1000),
    level(1500, 30 * 60, 1500),
    level(2500, 30 * 60, 2500),
    level(4000, 30 * 60, 4000),
    level(6000, 30 * 60, 6000),
  ],
};

export const PRESETS: Record<PresetName, PresetDefinition> = {
  regular: REGULAR,
  turbo: TURBO,
  deepstack: DEEPSTACK,
};

export const PRESET_LIST: PresetDefinition[] = [REGULAR, TURBO, DEEPSTACK];

/** Returns a deep clone of a preset's level array so callers can mutate freely. */
export function getPresetLevels(name: PresetName): PresetDefinition["levels"] {
  return PRESETS[name].levels.map((l) => ({ ...l }));
}
