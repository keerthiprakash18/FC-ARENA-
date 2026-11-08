CREATE TABLE "player_reward_wallets" (
 "userId" UUID NOT NULL PRIMARY KEY,
 "balance" INTEGER NOT NULL DEFAULT 0 CHECK ("balance" >= 0),
 "currentStreak" INTEGER NOT NULL DEFAULT 0 CHECK ("currentStreak" >= 0),
 "longestStreak" INTEGER NOT NULL DEFAULT 0 CHECK ("longestStreak" >= "currentStreak"),
 "lastClaimDay" DATE,
 "background" VARCHAR(32) NOT NULL DEFAULT 'CLASSIC',
 "badge" VARCHAR(32),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "player_reward_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "player_daily_check_ins" (
 "id" UUID NOT NULL PRIMARY KEY,
 "userId" UUID NOT NULL,
 "day" DATE NOT NULL,
 "streak" INTEGER NOT NULL CHECK ("streak" > 0),
 "baseCoins" INTEGER NOT NULL CHECK ("baseCoins" > 0),
 "bonusCoins" INTEGER NOT NULL CHECK ("bonusCoins" >= 0),
 "totalCoins" INTEGER NOT NULL CHECK ("totalCoins" = "baseCoins" + "bonusCoins"),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "player_daily_check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "player_reward_wallets"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_daily_check_ins_userId_day_key" ON "player_daily_check_ins"("userId", "day");
CREATE TABLE "arena_coin_entries" (
 "id" UUID NOT NULL PRIMARY KEY,
 "userId" UUID NOT NULL,
 "kind" VARCHAR(32) NOT NULL CHECK ("kind" IN ('CHECK_IN', 'COSMETIC_PURCHASE')),
 "reference" VARCHAR(80) NOT NULL,
 "delta" INTEGER NOT NULL CHECK ("delta" <> 0),
 "balanceAfter" INTEGER NOT NULL CHECK ("balanceAfter" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "arena_coin_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "player_reward_wallets"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "arena_coin_entries_userId_reference_key" ON "arena_coin_entries"("userId", "reference");
CREATE INDEX "arena_coin_entries_userId_createdAt_idx" ON "arena_coin_entries"("userId", "createdAt");
CREATE TABLE "player_owned_cosmetics" (
 "userId" UUID NOT NULL,
 "itemId" VARCHAR(32) NOT NULL,
 "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "player_owned_cosmetics_pkey" PRIMARY KEY ("userId", "itemId"),
 CONSTRAINT "player_owned_cosmetics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "player_reward_wallets"("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
