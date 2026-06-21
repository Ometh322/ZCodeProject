-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "logoImage" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
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
    "bountyCount" INTEGER NOT NULL DEFAULT 0,
    "eliminationOrder" INTEGER,
    CONSTRAINT "Player_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("addonCount", "createdAt", "doubleRebuyCount", "eliminated", "eliminatedAtLevel", "id", "name", "paidAmount", "paidCash", "rebuyCount", "stack", "tournamentId") SELECT "addonCount", "createdAt", "doubleRebuyCount", "eliminated", "eliminatedAtLevel", "id", "name", "paidAmount", "paidCash", "rebuyCount", "stack", "tournamentId" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE INDEX "Player_tournamentId_eliminated_idx" ON "Player"("tournamentId", "eliminated");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
