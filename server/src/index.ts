import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server as IoServer } from "socket.io";
import { config } from "./config.js";
import { createApiRouter, createUploadMiddleware } from "./rest.js";
import { createBroadcaster, registerSocketHandlers } from "./socket.js";
import { TimerEngine } from "./timerEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production (compiled) the client build lives at ../../client/dist relative
// to dist/index.js; in dev (tsx) relative to src/index.ts. Both resolve to the
// same path.
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
// Uploaded background images live next to the server source under server/uploads.
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

/**
 * Server bootstrap.
 *
 *   Express app  -> REST API (/api/*)
 *   HTTP server  -> shared transport
 *   Socket.IO    -> real-time state sync for the display + admin panels
 *
 * The same TimerEngine instance is shared between the REST layer (via sync())
 * and the Socket.IO layer (via control events), so there's a single authority
 * for "what is the tournament doing right now".
 */
async function main(): Promise<void> {
  // Ensure the uploads directory exists before multer tries to write into it.
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: config.corsOrigin,
      // Display clients connect without credentials; admin sends a Bearer token.
      credentials: false,
    }),
  );

  // Serve uploaded background images publicly (the display screen must be able
  // to load them without auth).
  app.use("/uploads", express.static(UPLOADS_DIR));

  const upload = createUploadMiddleware(UPLOADS_DIR);

  // Tiny health probe useful for the display kiosk to detect a dead server.
  app.get("/health", (_req, res) => res.json({ ok: true }));

  const httpServer = http.createServer(app);
  const io = new IoServer(httpServer, {
    cors: { origin: config.corsOrigin, methods: ["GET", "POST"] },
  });

  const broadcaster = createBroadcaster(io);
  const engine = new TimerEngine(broadcaster);

  app.use("/api", createApiRouter(engine, upload));

  registerSocketHandlers(io, engine);
  engine.start();

  // Serve the built client in production. In dev, Vite serves the client on
  // its own port and proxies /api here, so static serving is a no-op.
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: unknown non-API routes fall back to index.html so client-side
  // routing (/display, /admin, /login) works on hard refresh.
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/socket.io") ||
      req.path.startsWith("/uploads")
    ) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
      if (err) next();
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`♠ Poker Club server listening on http://localhost:${config.port}`);
    console.log(`   Display: http://localhost:${config.port}/display`);
    console.log(`   Admin:   http://localhost:${config.port}/admin`);
  });

  // Graceful shutdown.
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    engine.stop();
    io.close();
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
