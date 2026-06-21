import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";
import { prisma } from "./db.js";
import { config } from "./config.js";

/**
 * Simple password-based admin auth.
 *
 * Flow:
 *   1. POST /api/login { password } -> server compares (constant-time) against
 *      ADMIN_PASSWORD from env, mints an opaque random token, persists it with
 *      an expiry, and returns it.
 *   2. Every protected REST route carries `Authorization: Bearer <token>`.
 *   3. Socket.IO clients pass the same token via an `auth` handshake payload.
 *
 * Tokens are stored in the DB so they survive a server restart and can be
 * revoked by simply deleting the row.
 */

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function login(password: string): Promise<{ token: string; expiresAt: Date } | null> {
  if (!constantTimeEquals(password, config.adminPassword)) {
    return null;
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + config.tokenTtlSec * 1000);

  await prisma.adminSession.create({ data: { token, expiresAt } });
  // Opportunistically purge expired sessions so the table doesn't grow forever.
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  return { token, expiresAt };
}

/** Validates a bearer token and returns whether it is currently valid. */
export async function isValidToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session) return false;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }
  return true;
}

/** Extracts the bearer token from an Express Authorization header. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

/** Express middleware guarding admin-only REST routes. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await isValidToken(extractBearerToken(req));
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/**
 * Socket.IO auth hook.
 *
 * Pass the token in the client's connection options:
 *   io({ auth: { token: "..." } })
 */
export async function socketAuth(socket: Socket): Promise<boolean> {
  const token = (socket.handshake.auth as { token?: string }).token;
  return isValidToken(token);
}
