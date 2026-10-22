ALTER TABLE "users" ALTER COLUMN "nickname"
  SET DEFAULT ('食友_'::text || substr((gen_random_uuid())::text, 25, 12));

UPDATE "users"
SET "nickname" = DEFAULT, "updatedAt" = CURRENT_TIMESTAMP
WHERE "nickname" = '新用户';
