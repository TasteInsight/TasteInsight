/*
  Warnings:

  - You are about to drop the column `floor` on the `dish_uploads` table. All the data in the column will be lost.
  - Added the required column `canteenId` to the `dish_uploads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dish_uploads" DROP COLUMN "floor",
ADD COLUMN     "canteenId" TEXT NOT NULL,
ADD COLUMN     "windowId" TEXT;

-- AddForeignKey
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "canteens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
