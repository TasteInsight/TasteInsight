-- AlterTable
ALTER TABLE "news" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "news_status_idx" ON "news"("status");
