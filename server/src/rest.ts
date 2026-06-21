import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { PRESET_LIST } from "@poker-club/shared";
import type { AddPlayerInput, UpdatePlayerInput, UpsertTournamentInput } from "@poker-club/shared";
import { login, requireAdmin } from "./auth.js";
import type { TimerEngine } from "./timerEngine.js";
import {
  addPlayer,
  applyAddon,
  applyDoubleRebuy,
  applyRebuy,
  loadState,
  removePlayer,
  setBackgroundImage,
  setLogoImage,
  updatePlayer,
  upsertTournament,
} from "./repository.js";

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
export function createApiRouter(engine: TimerEngine, upload: multer.Multer): Router {
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

  // Background image upload. multer saves the file to /uploads; we store the
  // relative URL on the tournament so the display page can <img> it.
  router.post(
    "/tournament/background",
    upload.single("image"),
    async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: "Image file required (field name: image)" });
        return;
      }
      const relativePath = `/uploads/${req.file.filename}`;
      try {
        await setBackgroundImage(relativePath);
        await engine.sync();
        res.json({ backgroundImage: relativePath });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  router.delete("/tournament/background", async (_req, res) => {
    try {
      await setBackgroundImage(null);
      await engine.sync();
      res.json({ backgroundImage: null });
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
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (_req, file, cb) => {
      if (/^image\//.test(file.mimetype)) cb(null, true);
      else cb(new Error("Только изображения (image/*)"));
    },
  });
}
