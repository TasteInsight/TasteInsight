/*
  Warnings:

  - You are about to drop the column `defaultSortBy` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `newDishAlert` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `priceChangeAlert` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `reviewReplyAlert` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `showCalories` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `showNutrition` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `weeklyRecommendation` on the `user_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "defaultSortBy",
DROP COLUMN "newDishAlert",
DROP COLUMN "priceChangeAlert",
DROP COLUMN "reviewReplyAlert",
DROP COLUMN "showCalories",
DROP COLUMN "showNutrition",
DROP COLUMN "weeklyRecommendation",
ALTER COLUMN "tagPreferences" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "meatPreference" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "avoidIngredients" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "favoriteIngredients" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "canteenPreferences" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "allergens" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newDishAlert" BOOLEAN NOT NULL DEFAULT true,
    "priceChangeAlert" BOOLEAN NOT NULL DEFAULT false,
    "reviewReplyAlert" BOOLEAN NOT NULL DEFAULT true,
    "weeklyRecommendation" BOOLEAN NOT NULL DEFAULT true,
    "showCalories" BOOLEAN NOT NULL DEFAULT true,
    "showNutrition" BOOLEAN NOT NULL DEFAULT false,
    "defaultSortBy" TEXT NOT NULL DEFAULT 'rating',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
