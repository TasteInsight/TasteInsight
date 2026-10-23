-- AlterTable
ALTER TABLE "experiments" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scene" TEXT NOT NULL DEFAULT 'home';

-- AlterTable
ALTER TABLE "experiment_group_items" ADD COLUMN     "strategyRevisionId" TEXT;

-- CreateTable
CREATE TABLE "recommendation_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "serviceVersion" TEXT NOT NULL,
    "artifactDigest" TEXT NOT NULL,
    "featureSchemaVersion" TEXT NOT NULL,
    "dimension" INTEGER,
    "deploymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "recommendation_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_indexes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'building',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "recommendation_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_projections" (
    "dishId" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 1,
    "payload" JSONB,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_projections_pkey" PRIMARY KEY ("dishId")
);

-- CreateTable
CREATE TABLE "recommendation_index_tasks" (
    "indexId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_index_tasks_pkey" PRIMARY KEY ("indexId","dishId")
);

-- CreateTable
CREATE TABLE "recommendation_strategies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "digest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "recommendation_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_scene_defaults" (
    "scene" TEXT NOT NULL,
    "strategyRevisionId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_scene_defaults_pkey" PRIMARY KEY ("scene")
);

-- CreateTable
CREATE TABLE "recommendation_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "experimentId" TEXT,
    "groupItemId" TEXT,
    "strategyRevisionId" TEXT,
    "modelVersionId" TEXT,
    "indexId" TEXT,
    "rankerVersionId" TEXT,
    "configDigest" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "featureSnapshot" JSONB NOT NULL,
    "fallbackReason" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_strategies_scene_status_idx" ON "recommendation_strategies"("scene", "status");

-- CreateIndex
CREATE INDEX "recommendation_deliveries_experimentId_createdAt_idx" ON "recommendation_deliveries"("experimentId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_deliveries_userId_requestId_idx" ON "recommendation_deliveries"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_deliveryId_dishId_eventType_key" ON "recommendation_feedback"("deliveryId", "dishId", "eventType");

-- AddForeignKey
ALTER TABLE "recommendation_indexes" ADD CONSTRAINT "recommendation_indexes_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "recommendation_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_index_tasks" ADD CONSTRAINT "recommendation_index_tasks_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "recommendation_indexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "recommendation_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
