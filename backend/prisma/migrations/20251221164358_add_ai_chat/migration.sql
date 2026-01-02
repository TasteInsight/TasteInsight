/*
  Warnings:

  - You are about to drop the `ai_recommendations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `recommend_feedbacks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ai_recommendations" DROP CONSTRAINT "ai_recommendations_dishId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ai_recommendations" DROP CONSTRAINT "ai_recommendations_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."recommend_feedbacks" DROP CONSTRAINT "recommend_feedbacks_dishId_fkey";

-- DropForeignKey
ALTER TABLE "public"."recommend_feedbacks" DROP CONSTRAINT "recommend_feedbacks_userId_fkey";

-- DropTable
DROP TABLE "public"."ai_recommendations";

-- DropTable
DROP TABLE "public"."recommend_feedbacks";

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scene" TEXT NOT NULL DEFAULT 'general_chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_sessions_userId_idx" ON "ai_sessions"("userId");

-- CreateIndex
CREATE INDEX "ai_sessions_createdAt_idx" ON "ai_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "ai_messages_sessionId_idx" ON "ai_messages"("sessionId");

-- CreateIndex
CREATE INDEX "ai_messages_createdAt_idx" ON "ai_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_key_key" ON "ai_configs"("key");

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
