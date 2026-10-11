-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ALTER COLUMN "openId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "diningAlert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "likeAlert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "postReplyAlert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showMealPlans" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "postCommentId" TEXT,
ADD COLUMN     "postId" TEXT;

-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "ipDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "deliveryState" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolCode" TEXT NOT NULL DEFAULT 'tsinghua',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "studentSubjectDigest" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campus_oauth_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campus_oauth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_likes" (
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_likes_pkey" PRIMARY KEY ("userId","reviewId")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "post_comment_likes" (
    "userId" TEXT NOT NULL,
    "postCommentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comment_likes_pkey" PRIMARY KEY ("userId","postCommentId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rootId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_completions" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plan_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_invites" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "canteenId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_applications" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_identities_userId_idx" ON "user_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_issuer_subject_key" ON "user_identities"("provider", "issuer", "subject");

-- CreateIndex
CREATE INDEX "verification_challenges_target_purpose_createdAt_idx" ON "verification_challenges"("target", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "verification_challenges_ipDigest_createdAt_idx" ON "verification_challenges"("ipDigest", "createdAt");

-- CreateIndex
CREATE INDEX "verification_challenges_expiresAt_idx" ON "verification_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "student_verifications_userId_key" ON "student_verifications"("userId");

-- CreateIndex
CREATE INDEX "student_verifications_status_updatedAt_idx" ON "student_verifications"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "student_verifications_schoolCode_studentSubjectDigest_key" ON "student_verifications"("schoolCode", "studentSubjectDigest");

-- CreateIndex
CREATE UNIQUE INDEX "student_verifications_schoolCode_email_key" ON "student_verifications"("schoolCode", "email");

-- CreateIndex
CREATE UNIQUE INDEX "campus_oauth_attempts_stateDigest_key" ON "campus_oauth_attempts"("stateDigest");

-- CreateIndex
CREATE INDEX "campus_oauth_attempts_userId_createdAt_idx" ON "campus_oauth_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "campus_oauth_attempts_expiresAt_idx" ON "campus_oauth_attempts"("expiresAt");

-- CreateIndex
CREATE INDEX "review_likes_reviewId_idx" ON "review_likes"("reviewId");

-- CreateIndex
CREATE INDEX "comment_likes_commentId_idx" ON "comment_likes"("commentId");

-- CreateIndex
CREATE INDEX "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_status_deletedAt_createdAt_idx" ON "posts"("status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "post_comments_postId_createdAt_idx" ON "post_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "post_comments_parentCommentId_idx" ON "post_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "post_likes_postId_idx" ON "post_likes"("postId");

-- CreateIndex
CREATE INDEX "post_comment_likes_postCommentId_idx" ON "post_comment_likes"("postCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_userId_withdrawnAt_readAt_createdAt_idx" ON "notifications"("userId", "withdrawnAt", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_targetType_targetId_idx" ON "notifications"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "notifications_rootId_idx" ON "notifications"("rootId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_notificationId_key" ON "notification_outbox"("notificationId");

-- CreateIndex
CREATE INDEX "notification_outbox_status_nextAttemptAt_idx" ON "notification_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_completions_mealPlanId_date_key" ON "meal_plan_completions"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "dining_invites_status_startsAt_idx" ON "dining_invites"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "dining_invites_mealPlanId_date_key" ON "dining_invites"("mealPlanId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "dining_applications_inviteId_userId_key" ON "dining_applications"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_challenges" ADD CONSTRAINT "verification_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campus_oauth_attempts" ADD CONSTRAINT "campus_oauth_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment_likes" ADD CONSTRAINT "post_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment_likes" ADD CONSTRAINT "post_comment_likes_postCommentId_fkey" FOREIGN KEY ("postCommentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_postCommentId_fkey" FOREIGN KEY ("postCommentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_completions" ADD CONSTRAINT "meal_plan_completions_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_invites" ADD CONSTRAINT "dining_invites_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_invites" ADD CONSTRAINT "dining_invites_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_applications" ADD CONSTRAINT "dining_applications_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "dining_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_applications" ADD CONSTRAINT "dining_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


