CREATE TYPE "AdminScope" AS ENUM ('GLOBAL', 'CANTEENS');
ALTER TABLE "admins" ADD COLUMN "scope" "AdminScope" NOT NULL DEFAULT 'CANTEENS';
CREATE TABLE "_AdminCanteens" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AdminCanteens_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_AdminCanteens_B_index" ON "_AdminCanteens"("B");
ALTER TABLE "_AdminCanteens" ADD CONSTRAINT "_AdminCanteens_A_fkey" FOREIGN KEY ("A") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AdminCanteens" ADD CONSTRAINT "_AdminCanteens_B_fkey" FOREIGN KEY ("B") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "admins" SET "scope" = 'GLOBAL' WHERE "canteenId" IS NULL;
INSERT INTO "_AdminCanteens" ("A", "B") SELECT "id", "canteenId" FROM "admins" WHERE "canteenId" IS NOT NULL;
ALTER TABLE "admins" DROP CONSTRAINT "admins_canteenId_fkey";
ALTER TABLE "admins" DROP COLUMN "canteenId";
