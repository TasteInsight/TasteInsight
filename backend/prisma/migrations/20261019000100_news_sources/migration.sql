ALTER TABLE "news" ADD COLUMN "sourceName" TEXT, ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "sourcePublishedAt" TIMESTAMP(3);
CREATE TABLE "news_sources" (
 "id" TEXT NOT NULL PRIMARY KEY, "mpId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "canteenId" TEXT, "createdBy" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
 "intervalMinutes" INTEGER NOT NULL DEFAULT 30, "keyword" TEXT NOT NULL DEFAULT '',
 "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "syncLeaseUntil" TIMESTAMP(3),
 "lastSyncAt" TIMESTAMP(3), "lastError" TEXT, "lastImportedCount" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "news_sources_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "news_sources_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "news_sources_mpId_key" ON "news_sources"("mpId");
CREATE INDEX "news_sources_enabled_nextSyncAt_idx" ON "news_sources"("enabled", "nextSyncAt");
CREATE INDEX "news_sources_canteenId_idx" ON "news_sources"("canteenId");
CREATE TABLE "news_imports" (
 "sourceId" TEXT NOT NULL, "articleId" TEXT NOT NULL, "newsId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sourceId", "articleId"),
 CONSTRAINT "news_imports_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "news_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "news_imports_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "news_imports_newsId_key" ON "news_imports"("newsId");
