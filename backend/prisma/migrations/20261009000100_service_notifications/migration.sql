CREATE TABLE "notification_campaigns" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipientCutoff" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cursorUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_campaigns_dedupeKey_key" ON "notification_campaigns"("dedupeKey");
CREATE INDEX "notification_campaigns_status_nextAttemptAt_idx" ON "notification_campaigns"("status", "nextAttemptAt");
CREATE INDEX "notification_campaigns_status_lockedUntil_idx" ON "notification_campaigns"("status", "lockedUntil");

CREATE TABLE "weekly_recommendation_collections" (
    "weekKey" TEXT NOT NULL,
    "dishIds" TEXT[],
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_recommendation_collections_pkey" PRIMARY KEY ("weekKey")
);
