-- CreateTable
CREATE TABLE "content_moderation_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'aliyun',
    "mode" TEXT NOT NULL DEFAULT 'machine',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_moderation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_moderation_tasks" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profilePatch" JSONB,
    "results" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "callbackDeadline" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_moderation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_moderation_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "animated" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_moderation_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_moderation_receipts" (
    "traceId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_moderation_receipts_pkey" PRIMARY KEY ("traceId")
);

-- CreateIndex
CREATE INDEX "content_moderation_tasks_status_nextAttemptAt_idx" ON "content_moderation_tasks"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "content_moderation_tasks_targetType_targetId_createdAt_idx" ON "content_moderation_tasks"("targetType", "targetId", "createdAt");
