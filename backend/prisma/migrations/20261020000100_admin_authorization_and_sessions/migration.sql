ALTER TABLE "admins" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admins" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
UPDATE "admins" SET "mustChangePassword" = true WHERE "deletedAt" IS NULL;
CREATE INDEX "admins_createdBy_idx" ON "admins"("createdBy");

INSERT INTO "admin_permissions" ("id", "adminId", "permission")
SELECT 'log_view_' || p."id", p."adminId", 'log:view'
FROM "admin_permissions" p WHERE p."permission" = 'admin:view'
ON CONFLICT ("adminId", "permission") DO NOTHING;

DELETE FROM "admin_permissions" p USING "admins" a
WHERE p."adminId" = a."id" AND a."scope" = 'CANTEENS'
AND p."permission" IN (
  'student:review', 'post:view', 'post:approve', 'post:delete',
  'experiment:view', 'experiment:create', 'experiment:edit', 'experiment:delete'
);
