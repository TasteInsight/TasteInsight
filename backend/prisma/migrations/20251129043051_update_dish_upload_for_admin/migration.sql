-- DropForeignKey
ALTER TABLE "public"."dish_uploads" DROP CONSTRAINT "dish_uploads_userId_fkey";

-- AlterTable
ALTER TABLE "dish_uploads" ADD COLUMN     "adminId" TEXT,
ADD COLUMN     "parentDishId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_uploads" ADD CONSTRAINT "dish_uploads_parentDishId_fkey" FOREIGN KEY ("parentDishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
