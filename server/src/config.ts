import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Load .env from the repository root. This file is server/src/config.ts, so the
// root is two levels up. (Going up one level lands in server/, where only
// Prisma's DATABASE_URL lives — that's why ADMIN_PASSWORD never matched.)
const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
// `override: true` forces dotenv to replace any value already present in
// process.env. Without it, a stale value shipped by the parent shell (or an
// earlier dotenv load of a different file) silently wins and the .env value
// is ignored.
const result = dotenv.config({ path: envPath, override: true });
if (result.error) {
  console.error("[config] Failed to load .env from", envPath, result.error);
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
