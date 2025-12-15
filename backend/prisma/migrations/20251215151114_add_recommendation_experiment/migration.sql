-- CreateTable
CREATE TABLE "recommendation_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "requestId" TEXT,
    "position" INTEGER,
    "score" DOUBLE PRECISION,
    "experimentId" TEXT,
    "groupItemId" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trafficRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_group_items" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "weights" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiment_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_experiment_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "groupItemId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_embeddings" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dish_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_events_userId_idx" ON "recommendation_events"("userId");

-- CreateIndex
CREATE INDEX "recommendation_events_dishId_idx" ON "recommendation_events"("dishId");

-- CreateIndex
CREATE INDEX "recommendation_events_eventType_idx" ON "recommendation_events"("eventType");

-- CreateIndex
CREATE INDEX "recommendation_events_scene_idx" ON "recommendation_events"("scene");

-- CreateIndex
CREATE INDEX "recommendation_events_requestId_idx" ON "recommendation_events"("requestId");

-- CreateIndex
CREATE INDEX "recommendation_events_experimentId_idx" ON "recommendation_events"("experimentId");

-- CreateIndex
CREATE INDEX "recommendation_events_createdAt_idx" ON "recommendation_events"("createdAt");

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "experiments"("status");

-- CreateIndex
CREATE INDEX "experiments_startTime_endTime_idx" ON "experiments"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "experiment_group_items_experimentId_idx" ON "experiment_group_items"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_group_items_experimentId_name_key" ON "experiment_group_items"("experimentId", "name");

-- CreateIndex
CREATE INDEX "user_experiment_assignments_userId_idx" ON "user_experiment_assignments"("userId");

-- CreateIndex
CREATE INDEX "user_experiment_assignments_experimentId_idx" ON "user_experiment_assignments"("experimentId");

-- CreateIndex
CREATE INDEX "user_experiment_assignments_groupItemId_idx" ON "user_experiment_assignments"("groupItemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_experiment_assignments_userId_experimentId_key" ON "user_experiment_assignments"("userId", "experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "dish_embeddings_dishId_key" ON "dish_embeddings"("dishId");

-- CreateIndex
CREATE INDEX "dish_embeddings_dishId_idx" ON "dish_embeddings"("dishId");

-- CreateIndex
CREATE INDEX "dish_embeddings_version_idx" ON "dish_embeddings"("version");

-- AddForeignKey
ALTER TABLE "experiment_group_items" ADD CONSTRAINT "experiment_group_items_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
