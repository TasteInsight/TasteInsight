/*
  Warnings:

  - You are about to drop the column `floor` on the `dishes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dishes" DROP COLUMN "floor",
ADD COLUMN     "floorId" TEXT,
ADD COLUMN     "floorLevel" TEXT,
ADD COLUMN     "floorName" TEXT;

-- AlterTable
ALTER TABLE "windows" ADD COLUMN     "floorId" TEXT;

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "canteenId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "floors_canteenId_idx" ON "floors"("canteenId");

-- AddForeignKey
ALTER TABLE "windows" ADD CONSTRAINT "windows_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "canteens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
