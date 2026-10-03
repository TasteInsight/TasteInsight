ALTER TABLE "admins" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "admins_deletedAt_idx" ON "admins"("deletedAt");

ALTER TABLE "dish_uploads" ADD COLUMN "parentUploadId" TEXT;
CREATE INDEX "dish_uploads_parentUploadId_idx" ON "dish_uploads"("parentUploadId");
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_parentUploadId_fkey"
  FOREIGN KEY ("parentUploadId") REFERENCES "dish_uploads"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_single_parent_check"
  CHECK ("parentDishId" IS NULL OR "parentUploadId" IS NULL);
