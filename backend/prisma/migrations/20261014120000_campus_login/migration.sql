ALTER TABLE "campus_oauth_attempts" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "campus_oauth_attempts" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'VERIFICATION',
  ADD COLUMN "loginVerifierDigest" TEXT,
  ADD COLUMN "ipDigest" TEXT;
CREATE INDEX "campus_oauth_attempts_purpose_ipDigest_createdAt_idx"
  ON "campus_oauth_attempts"("purpose", "ipDigest", "createdAt");
