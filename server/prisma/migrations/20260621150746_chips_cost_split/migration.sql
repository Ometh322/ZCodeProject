-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'setup',
    "currentLevelIdx" INTEGER NOT NULL DEFAULT 0,
    "remainingSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "backgroundImage" TEXT,
    "buyInChips" INTEGER NOT NULL DEFAULT 0,
    "buyInCost" INTEGER NOT NULL DEFAULT 0,
    "rebuyChips" INTEGER NOT NULL DEFAULT 0,
    "rebuyCost" INTEGER NOT NULL DEFAULT 0,
    "doubleRebuyChips" INTEGER NOT NULL DEFAULT 0,
    "doubleRebuyCost" INTEGER NOT NULL DEFAULT 0,
    "addonChips" INTEGER NOT NULL DEFAULT 0,
    "addonCost" INTEGER NOT NULL DEFAULT 0,
    "maxRebuys" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "smallBlind" INTEGER NOT NULL,
    "bigBlind" INTEGER NOT NULL,
    "ante" INTEGER NOT NULL DEFAULT 0,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Level_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stack" INTEGER NOT NULL DEFAULT 0,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedAtLevel" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rebuyCount" INTEGER NOT NULL DEFAULT 0,
    "doubleRebuyCount" INTEGER NOT NULL DEFAULT 0,
    "addonCount" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "paidCash" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Level_tournamentId_order_idx" ON "Level"("tournamentId", "order");

-- CreateIndex
CREATE INDEX "Player_tournamentId_eliminated_idx" ON "Player"("tournamentId", "eliminated");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
