import { PrismaClient } from "@prisma/client";

/**
 * Single shared PrismaClient instance.
 *
 * In dev (tsx watch) Node restarts the process on every change so there's no
 * risk of leaking connections across reloads; in production we still want one
 * client for the whole process. The global cache guards against the
 * well-known "N+1 PrismaClient instances during HMR" problem.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
