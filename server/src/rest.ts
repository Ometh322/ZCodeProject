import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { PRESET_LIST } from "@poker-club/shared";
import type {
  AddPlayerInput,
  PresetMedia,
  TournamentPreset,
  UpdatePlayerInput,
  UpsertTournamentInput,
} from "@poker-club/shared";
import { login, requireAdmin } from "./auth.js";
import type { TimerEngine } from "./timerEngine.js";
import {
  addPlayer,
  applyAddon,
  applyDoubleRebuy,
  applyRebuy,
  loadState,
  removeAllPlayers,
  removePlayer,
  setLayoutConfig,
  setLogoImage,
  setSoundAlert,
  updatePlayer,
  upsertTournament,
} from "./repository.js";
import type { SoundAlertType } from "./repository.js";
import type { LayoutConfig } from "@poker-club/shared";

/**
 * REST surface.
 *
 * Public:
 *   POST /api/login                       { password } -> { token, expiresAt }
 *   GET  /api/tournament                  current state snapshot
 *   GET  /api/presets                     list built-in blind structures
 *
 * Admin (bearer token required):
 *   PUT  /api/tournament                  create/replace active tournament + pricing
 *   POST /api/tournament/background       upload background image (multipart/form-data)
 *   DELETE /api/tournament/background     clear background image
 *   POST /api/tournament/players          add a player (auto buy-in)
 *   PATCH /api/players/:id                update a player (name / stack / eliminated / paidCash)
 *   POST /api/players/:id/rebuy           apply a single rebuy (adds rebuyChips, costs rebuyCost)
 *   POST /api/players/:id/double-rebuy    apply a double rebuy (adds doubleRebuyChips, costs doubleRebuyCost)
 *   POST /api/players/:id/addon           apply an addon (adds addonChips, costs addonCost)
 *   DELETE /api/players/:id               remove a player
 *
 * Every admin mutation calls `engine.sync()` afterwards so the change is fanned
 * out to all connected display screens over Socket.IO in real time.
 *
 * Timer control (start/pause/next-level/etc.) happens over Socket.IO, not REST.
 */
export function createApiRouter(
  engine: TimerEngine,
  upload: multer.Multer,
  uploadsDir: string,
): Router {
  const router = Router();

  // --- Auth ----------------------------------------------------------------
  router.post("/login", async (req, res) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    const result = await login(password);
    if (!result) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    res.json({ token: result.token, expiresAt: result.expiresAt.toISOString() });
  });

  // --- Public reads --------------------------------------------------------
  router.get("/presets", (_req, res) => {
    res.json(PRESET_LIST);
  });

  router.get("/tournament", async (_req, res) => {
    const state = await loadState();
    res.json(state);
  });

  // --- Admin mutations -----------------------------------------------------
  router.use(requireAdmin);

  router.put("/tournament", async (req, res) => {
    const input = req.body as UpsertTournamentInput;
    if (!input?.name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    try {
      await upsertTournament(input);
      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Club logo upload — same pattern as the background, stored under a separate
  // column so the display screen can show it as the club emblem.
  router.post(
    "/tournament/logo",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: "Image file required (field name: image)" });
        return;
      }
      const relativePath = `/uploads/${req.file.filename}`;
      try {
        await setLogoImage(relativePath);
        await engine.sync();
        res.json({ logoImage: relativePath });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  router.delete("/tournament/logo", async (_req, res) => {
    try {
      await setLogoImage(null);
      await engine.sync();
      res.json({ logoImage: null });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Custom alert sound upload — :type is one of "1min" / "10sec" / "level".
  router.post(
    "/tournament/sound/:type",
    upload.single("audio"),
    async (req, res) => {
      const type = req.params.type as SoundAlertType;
      if (!["1min", "10sec", "level"].includes(type)) {
        res.status(400).json({ error: "Unknown sound type" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Audio file required (field name: audio)" });
        return;
      }
      const relativePath = `/uploads/${req.file.filename}`;
      try {
        await setSoundAlert(type, relativePath);
        await engine.sync();
        res.json({ type, path: relativePath });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  router.delete("/tournament/sound/:type", async (req, res) => {
    const type = req.params.type as SoundAlertType;
    if (!["1min", "10sec", "level"].includes(type)) {
      res.status(400).json({ error: "Unknown sound type" });
      return;
    }
    try {
      await setSoundAlert(type, null);
      await engine.sync();
      res.json({ type, path: null });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Custom display layout (drag-n-drop editor): save block geometry.
  router.put("/tournament/layout", async (req, res) => {
    const cfg = req.body as LayoutConfig;
    const isItem = (v: unknown): v is { x: number; y: number; w: number; h: number } =>
      Boolean(v) &&
      typeof v === "object" &&
      ["x", "y", "w", "h"].every((f) => typeof (v as Record<string, unknown>)[f] === "number");
    const valid =
      cfg &&
      typeof cfg === "object" &&
      ["name", "logo", "blinds", "timer", "stats", "panels"].every((k) =>
        isItem((cfg as unknown as Record<string, unknown>)[k]),
      );
    if (!valid) {
      res.status(400).json({ error: "Invalid layout config" });
      return;
    }
    try {
      await setLayoutConfig(cfg);
      await engine.sync();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Reset the display layout back to the default flex flow.
  router.delete("/tournament/layout", async (_req, res) => {
    try {
      await setLayoutConfig(null);
      await engine.sync();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Settings preset file (export / import) ------------------------------
  // One JSON document with everything needed to clone the club setup on
  // another machine: name, pricing, blinds, layout and the logo/sound files
  // embedded as base64. Live game state (players, timer) is never included.

  router.get("/tournament/preset", async (_req, res) => {
    const state = await loadState();
    if (!state) {
      res.status(404).json({ error: "No active tournament" });
      return;
    }
    try {
      const preset: TournamentPreset = {
        format: "flash-poker-preset",
        version: 1,
        exportedAt: new Date().toISOString(),
        name: state.name,
        pricing: {
          buyInChips: state.buyInChips,
          buyInCost: state.buyInCost,
          rebuyChips: state.rebuyChips,
          rebuyCost: state.rebuyCost,
          doubleRebuyChips: state.doubleRebuyChips,
          doubleRebuyCost: state.doubleRebuyCost,
          addonChips: state.addonChips,
          addonCost: state.addonCost,
          maxRebuys: state.maxRebuys,
        },
        levels: state.levels.map((l) => ({
          durationSec: l.durationSec,
          smallBlind: l.smallBlind,
          bigBlind: l.bigBlind,
          ante: l.ante,
          isBreak: l.isBreak,
          breakTitle: l.breakTitle,
        })),
        layoutConfig: state.layoutConfig,
        media: {
          logo: await readPresetMedia(uploadsDir, state.logoImage),
          sound1min: await readPresetMedia(uploadsDir, state.soundAlert1Min),
          sound10sec: await readPresetMedia(uploadsDir, state.soundAlert10Sec),
          soundLevel: await readPresetMedia(uploadsDir, state.soundAlertLevel),
        },
      };
      res.json(preset);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/tournament/preset", async (req, res) => {
    const problems = validatePreset(req.body);
    if (problems.length > 0) {
      res.status(400).json({ error: `Invalid preset file: ${problems.join("; ")}` });
      return;
    }
    const preset = req.body as TournamentPreset;
    try {
      // Persist embedded media first so the tournament row can point at the
      // newly written files; a missing entry clears the slot.
      const logo = await writePresetMedia(uploadsDir, preset.media.logo, "image");
      const sound1min = await writePresetMedia(uploadsDir, preset.media.sound1min, "audio");
      const sound10sec = await writePresetMedia(uploadsDir, preset.media.sound10sec, "audio");
      const soundLevel = await writePresetMedia(uploadsDir, preset.media.soundLevel, "audio");

      await upsertTournament({ name: preset.name, levels: preset.levels, ...preset.pricing });
      await setLayoutConfig(preset.layoutConfig ?? null);
      await setLogoImage(logo);
      await setSoundAlert("1min", sound1min);
      await setSoundAlert("10sec", sound10sec);
      await setSoundAlert("level", soundLevel);

      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/tournament/players", async (req, res) => {
    const input = req.body as AddPlayerInput;
    if (!input?.name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    try {
      await addPlayer(input.name);
      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.patch("/players/:id", async (req, res) => {
    const patch = req.body as UpdatePlayerInput;
    try {
      await updatePlayer(req.params.id, patch);
      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Single rebuy: adds rebuyChips to the stack, increments rebuyCount.
  router.post("/players/:id/rebuy", async (req, res) => {
    try {
      const state = await rebuyWithChips(req.params.id);
      await engine.sync();
      res.json(state);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Double rebuy: adds doubleRebuyChips to the stack, increments doubleRebuyCount.
  router.post("/players/:id/double-rebuy", async (req, res) => {
    try {
      const state = await doubleRebuyWithChips(req.params.id);
      await engine.sync();
      res.json(state);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Addon: adds addonChips to the stack, increments addonCount.
  router.post("/players/:id/addon", async (req, res) => {
    try {
      const state = await addonWithChips(req.params.id);
      await engine.sync();
      res.json(state);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.delete("/players/:id", async (req, res) => {
    try {
      await removePlayer(req.params.id);
      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Clear the entire roster of the active tournament.
  router.delete("/tournament/players", async (_req, res) => {
    try {
      await removeAllPlayers();
      await engine.sync();
      res.json(await loadState());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

/** Looks up the active tournament's rebuyChips and applies a single rebuy. */
async function rebuyWithChips(playerId: string) {
  const { prisma } = await import("./db.js");
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["setup", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
    select: { rebuyChips: true },
  });
  if (!tournament) throw new Error("Нет активного турнира");
  if (tournament.rebuyChips <= 0) throw new Error("Ребай не настроен (укажите фишки)");
  return applyRebuy(playerId, tournament.rebuyChips);
}

/** Looks up the active tournament's doubleRebuyChips and applies a double rebuy. */
async function doubleRebuyWithChips(playerId: string) {
  const { prisma } = await import("./db.js");
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["setup", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
    select: { doubleRebuyChips: true },
  });
  if (!tournament) throw new Error("Нет активного турнира");
  if (tournament.doubleRebuyChips <= 0) throw new Error("Двойной ребай не настроен (укажите фишки)");
  return applyDoubleRebuy(playerId, tournament.doubleRebuyChips);
}

/** Looks up the active tournament's addonChips and applies an addon. */
async function addonWithChips(playerId: string) {
  const { prisma } = await import("./db.js");
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["setup", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
    select: { addonChips: true },
  });
  if (!tournament) throw new Error("Нет активного турнира");
  if (tournament.addonChips <= 0) throw new Error("Аддон не настроен (укажите фишки)");
  return applyAddon(playerId, tournament.addonChips);
}

// Re-export so callers (index.ts) can build a multer instance from the same
// config if they want; kept here because the storage path is a REST concern.
export function createUploadMiddleware(uploadsDir: string): multer.Multer {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB — images; audio is far smaller
    fileFilter: (_req, file, cb) => {
      // Accept both image uploads (background, logo) and audio uploads (alert
      // sounds). Anything else is rejected with a clear error.
      if (/^image\//.test(file.mimetype) || /^audio\//.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Только изображения (image/*) или аудио (audio/*)"));
      }
    },
  });
}

// --- Preset file helpers ----------------------------------------------------

/** Extension → MIME map used when embedding uploaded files into a preset. */
const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

/**
 * Reads an uploaded file behind a `/uploads/...` relative URL into a preset
 * media entry. Returns null when the slot is empty or the file went missing
 * (e.g. a volume was wiped) — a half-broken export is better than a failed one.
 */
async function readPresetMedia(
  uploadsDir: string,
  relativeUrl: string | null,
): Promise<PresetMedia | null> {
  if (!relativeUrl) return null;
  const filename = path.basename(relativeUrl);
  try {
    const data = await fs.promises.readFile(path.join(uploadsDir, filename));
    return {
      filename,
      mimeType: MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
      dataBase64: data.toString("base64"),
    };
  } catch {
    return null;
  }
}

/**
 * Writes an embedded media entry back to the uploads dir under a fresh unique
 * name (never overwrites existing files) and returns its `/uploads/...` URL.
 * `kind` guards against swapped files, e.g. a sound in the logo slot.
 */
async function writePresetMedia(
  uploadsDir: string,
  media: PresetMedia | null,
  kind: "image" | "audio",
): Promise<string | null> {
  if (!media) return null;
  if (!/^image\//.test(media.mimeType) && !/^audio\//.test(media.mimeType)) {
    throw new Error(`Недопустимый тип файла в пресете: ${media.mimeType}`);
  }
  if (kind === "image" && !/^image\//.test(media.mimeType)) {
    throw new Error("В слоте логотипа ожидается изображение");
  }
  if (kind === "audio" && !/^audio\//.test(media.mimeType)) {
    throw new Error("В слоте звука ожидается аудиофайл");
  }
  // 8 MB decoded — same cap as direct uploads.
  if (media.dataBase64.length > 8 * 1024 * 1024 * 1.34) {
    throw new Error(`Файл ${media.filename} больше 8 МБ`);
  }
  const ext = path.extname(media.filename) || ".bin";
  const name = `preset-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, name), Buffer.from(media.dataBase64, "base64"));
  return `/uploads/${name}`;
}

/** Structural validation of an uploaded preset document; returns problems. */
function validatePreset(v: unknown): string[] {
  const problems: string[] = [];
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return ["не JSON-объект"];
  if (p.format !== "flash-poker-preset") problems.push("это не файл настроек ФЛЭШ");
  if (p.version !== 1) problems.push(`неподдерживаемая версия: ${String(p.version)}`);
  if (typeof p.name !== "string" || !p.name) problems.push("пустое название турнира");
  const pricing = p.pricing as Record<string, unknown> | undefined;
  const pricingKeys = [
    "buyInChips",
    "buyInCost",
    "rebuyChips",
    "rebuyCost",
    "doubleRebuyChips",
    "doubleRebuyCost",
    "addonChips",
    "addonCost",
    "maxRebuys",
  ];
  if (!pricing || !pricingKeys.every((k) => typeof pricing[k] === "number")) {
    problems.push("некорректный блок цен");
  }
  if (
    !Array.isArray(p.levels) ||
    p.levels.length === 0 ||
    !(p.levels as Array<Record<string, unknown>>).every(
      (l) =>
        typeof l.durationSec === "number" &&
        typeof l.smallBlind === "number" &&
        typeof l.bigBlind === "number" &&
        typeof l.ante === "number" &&
        typeof l.isBreak === "boolean" &&
        (l.breakTitle === null || typeof l.breakTitle === "string"),
    )
  ) {
    problems.push("некорректная структура уровней");
  }
  const media = p.media as Record<string, unknown> | undefined;
  if (!media || typeof media !== "object") {
    problems.push("нет блока media");
  } else {
    for (const key of ["logo", "sound1min", "sound10sec", "soundLevel"]) {
      const m = media[key] as Record<string, unknown> | null | undefined;
      if (
        m !== null &&
        m !== undefined &&
        !(typeof m.filename === "string" && typeof m.mimeType === "string" && typeof m.dataBase64 === "string")
      ) {
        problems.push(`некорректный файл в слоте ${key}`);
      }
    }
  }
  return problems;
}
