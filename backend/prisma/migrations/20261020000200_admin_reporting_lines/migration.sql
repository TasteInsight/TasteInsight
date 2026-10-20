ALTER TABLE "admins" ADD COLUMN "managerId" TEXT;
ALTER TABLE "admins" ADD COLUMN "hierarchyVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "admins" SET "managerId" = "createdBy";
CREATE INDEX "admins_managerId_idx" ON "admins"("managerId");
ALTER TABLE "admins" ADD CONSTRAINT "admins_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 按管理链收窄历史授权，保留账号状态和原创建关系。
DO $$
DECLARE
  node RECORD;
  parent RECORD;
  child_scope TEXT;
  removed INTEGER;
BEGIN
  FOR node IN
    WITH RECURSIVE hierarchy AS (
      SELECT id, "managerId", 0 AS depth FROM admins WHERE "managerId" IS NULL
      UNION ALL
      SELECT child.id, child."managerId", hierarchy.depth + 1
      FROM admins child JOIN hierarchy ON child."managerId" = hierarchy.id
    )
    SELECT id, "managerId" FROM hierarchy WHERE "managerId" IS NOT NULL ORDER BY depth
  LOOP
    SELECT scope, role INTO parent FROM admins WHERE id = node."managerId";
    SELECT scope::TEXT INTO child_scope FROM admins WHERE id = node.id;
    IF parent.scope = 'CANTEENS' THEN
      IF child_scope = 'GLOBAL' THEN
        DELETE FROM "_AdminCanteens" WHERE "A" = node.id;
        INSERT INTO "_AdminCanteens" ("A", "B")
          SELECT node.id, "B" FROM "_AdminCanteens" WHERE "A" = node."managerId";
      ELSE
        DELETE FROM "_AdminCanteens" child
          WHERE child."A" = node.id AND NOT EXISTS (
            SELECT 1 FROM "_AdminCanteens" allowed
            WHERE allowed."A" = node."managerId" AND allowed."B" = child."B"
          );
      END IF;
      UPDATE admins SET scope = 'CANTEENS' WHERE id = node.id;
    END IF;
    IF parent.role <> 'superadmin' THEN
      DELETE FROM admin_permissions child
        WHERE child."adminId" = node.id AND NOT EXISTS (
          SELECT 1 FROM admin_permissions allowed
          WHERE allowed."adminId" = node."managerId" AND allowed.permission = child.permission
        );
    END IF;
    DELETE FROM admin_permissions permission USING admins account
      WHERE permission."adminId" = node.id AND account.id = node.id AND account.scope = 'CANTEENS'
      AND permission.permission IN (
        'student:review', 'post:view', 'post:approve', 'post:delete',
        'experiment:view', 'experiment:create', 'experiment:edit', 'experiment:delete'
      );
    LOOP
      DELETE FROM admin_permissions permission USING (
        VALUES
          ('dish:create', 'canteen:view'),
          ('dish:edit', 'dish:view'),
          ('dish:edit', 'canteen:view'),
          ('dish:delete', 'dish:view'),
          ('canteen:create', 'canteen:view'),
          ('canteen:edit', 'canteen:view'),
          ('canteen:delete', 'canteen:view'),
          ('review:approve', 'dish:view'),
          ('review:approve', 'canteen:view'),
          ('review:delete', 'review:approve'),
          ('comment:approve', 'dish:view'),
          ('comment:approve', 'canteen:view'),
          ('comment:delete', 'comment:approve'),
          ('upload:approve', 'dish:view'),
          ('upload:approve', 'canteen:view'),
          ('news:create', 'news:view'),
          ('news:edit', 'news:view'),
          ('news:publish', 'news:view'),
          ('news:revoke', 'news:view'),
          ('news:delete', 'news:view'),
          ('admin:create', 'admin:view'),
          ('admin:create', 'canteen:view'),
          ('admin:edit', 'admin:view'),
          ('admin:delete', 'admin:view'),
          ('config:edit', 'config:view'),
          ('post:approve', 'post:view'),
          ('post:delete', 'post:view'),
          ('experiment:create', 'experiment:view'),
          ('experiment:edit', 'experiment:view'),
          ('experiment:delete', 'experiment:view')
      ) AS dependency(permission, required)
      WHERE permission."adminId" = node.id AND permission.permission = dependency.permission
        AND NOT EXISTS (
          SELECT 1 FROM admin_permissions required
          WHERE required."adminId" = node.id AND required.permission = dependency.required
        );
      GET DIAGNOSTICS removed = ROW_COUNT;
      EXIT WHEN removed = 0;
    END LOOP;
  END LOOP;
END $$;
