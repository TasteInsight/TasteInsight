ALTER TABLE "admins" DROP CONSTRAINT "admins_canteenId_fkey";

ALTER TABLE "admins" ADD CONSTRAINT "admins_canteenId_fkey"
  FOREIGN KEY ("canteenId") REFERENCES "canteens"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
