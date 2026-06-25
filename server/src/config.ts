import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Try to load .env from the repository root (server/src → two levels up).
// In production (Docker) there is no .env file — config comes from ENV vars
// passed by the container runtime — so a missing file is normal, not an error.
// We only log when a file IS found but fails to parse.
const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
const result = dotenv.config({ path: envPath, override: true });
if (result.error && result.error.code !== "ENOENT") {
  console.error("[config] Failed to parse .env at", envPath, result.error);
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  adminPassword: required("ADMIN_PASSWORD", "change-me"),
  /** Session token TTL in seconds. */
  tokenTtlSec: Number(process.env.ADMIN_TOKEN_TTL ?? 43200),
  /** Comma-separated list of allowed CORS origins. */
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
