ALTER TABLE "dish_uploads"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'create',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "targetDishId" TEXT,
  ADD COLUMN "changedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "clientRequestId" TEXT,
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "baseSnapshot" JSONB,
  ADD COLUMN "approvedSnapshot" JSONB,
  ADD COLUMN "refreshPending" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "dish_uploads_userId_clientRequestId_key"
  ON "dish_uploads"("userId", "clientRequestId");
CREATE INDEX "dish_uploads_targetDishId_idx" ON "dish_uploads"("targetDishId");
CREATE INDEX "dish_uploads_refreshPending_idx" ON "dish_uploads"("refreshPending");

CREATE TABLE "contribution_images" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageType" TEXT NOT NULL,
  "uploadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "contribution_images_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contribution_images_url_key" ON "contribution_images"("url");
CREATE INDEX "contribution_images_expiresAt_idx" ON "contribution_images"("expiresAt");
