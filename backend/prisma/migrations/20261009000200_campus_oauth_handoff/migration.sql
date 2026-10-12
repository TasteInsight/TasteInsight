ALTER TABLE "campus_oauth_attempts"
ADD COLUMN "clientOrigin" TEXT,
ADD COLUMN "proof" JSONB,
ADD COLUMN "handoffDigest" TEXT,
ADD COLUMN "handoffExpiresAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);
