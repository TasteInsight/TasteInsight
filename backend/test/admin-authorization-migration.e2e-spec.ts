import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

describe('administrator authorization migration (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('repairs legacy grants through retired managers and preserves independent roots and active accounts', async () => {
    const schema = `rbac_migration_${randomUUID().replaceAll('-', '')}`;
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}`);
        await tx.$executeRawUnsafe(
          'CREATE TABLE admins (id TEXT PRIMARY KEY, role TEXT, scope TEXT, "createdBy" TEXT, "deletedAt" TIMESTAMP)',
        );
        await tx.$executeRawUnsafe(
          'CREATE TABLE admin_permissions (id TEXT PRIMARY KEY, "adminId" TEXT, permission TEXT, UNIQUE("adminId",permission))',
        );
        await tx.$executeRawUnsafe(
          'CREATE TABLE "_AdminCanteens" ("A" TEXT, "B" TEXT, PRIMARY KEY("A","B"))',
        );
        await tx.$executeRawUnsafe(`INSERT INTO admins VALUES
        ('root','superadmin','GLOBAL',NULL,NULL),
        ('super-child','admin','GLOBAL','root',NULL),
        ('retired','admin','GLOBAL','root',CURRENT_TIMESTAMP),
        ('legacy-child','admin','GLOBAL','retired',NULL),
        ('legacy-leaf','admin','GLOBAL','legacy-child',NULL),
        ('scoped','admin','CANTEENS','root',NULL),
        ('scope-child','admin','GLOBAL','scoped',NULL),
        ('disjoint','admin','CANTEENS','scoped',NULL),
        ('independent','admin','GLOBAL',NULL,NULL),
        ('dependency-child','admin','GLOBAL','independent',NULL)`);
        const grants: Record<string, string[]> = {
          'super-child': ['log:view', 'news:view', 'news:create'],
          retired: ['log:view'],
          'legacy-child': ['log:view', 'dish:view', 'experiment:view'],
          'legacy-leaf': ['dish:view'],
          scoped: ['canteen:view', 'dish:view', 'dish:edit'],
          'scope-child': [
            'canteen:view',
            'dish:view',
            'dish:edit',
            'experiment:view',
            'experiment:edit',
          ],
          disjoint: ['dish:view'],
          independent: ['log:view', 'news:create'],
          'dependency-child': ['log:view', 'news:create'],
        };
        for (const [id, permissions] of Object.entries(grants)) {
          for (const permission of permissions) {
            await tx.$executeRaw`INSERT INTO admin_permissions VALUES (${`${id}-${permission}`}, ${id}, ${permission})`;
          }
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "_AdminCanteens" VALUES ('scoped','c1'),('disjoint','c2')`,
        );
        for (const name of [
          '20261020000100_admin_authorization_and_sessions',
          '20261020000200_admin_reporting_lines',
        ]) {
          const sql = readFileSync(
            resolve(__dirname, '../prisma/migrations', name, 'migration.sql'),
            'utf8',
          );
          const block = sql.indexOf('DO $$');
          const ddl = block < 0 ? sql : sql.slice(0, block);
          for (const statement of ddl
            .split(';')
            .filter((statement) => statement.trim()))
            await tx.$executeRawUnsafe(statement);
          if (block >= 0) await tx.$executeRawUnsafe(sql.slice(block));
        }
        const permissions = async (id: string) =>
          (
            await tx.$queryRaw<
              { permission: string }[]
            >`SELECT permission FROM admin_permissions WHERE "adminId" = ${id} ORDER BY permission`
          ).map((row) => row.permission);
        expect(await permissions('root')).toEqual([]);
        expect(await permissions('super-child')).toEqual([
          'log:view',
          'news:create',
          'news:view',
        ]);
        expect(await permissions('legacy-child')).toEqual(['log:view']);
        expect(await permissions('legacy-leaf')).toEqual([]);
        expect(await permissions('scope-child')).toEqual([
          'canteen:view',
          'dish:edit',
          'dish:view',
        ]);
        expect(await permissions('independent')).toEqual([
          'log:view',
          'news:create',
        ]);
        expect(await permissions('dependency-child')).toEqual(['log:view']);
        const [child] = await tx.$queryRaw<
          {
            scope: string;
            managerId: string;
            createdBy: string;
            deletedAt: Date | null;
          }[]
        >`SELECT scope, "managerId", "createdBy", "deletedAt" FROM admins WHERE id = 'scope-child'`;
        expect(child).toEqual({
          scope: 'CANTEENS',
          managerId: 'scoped',
          createdBy: 'scoped',
          deletedAt: null,
        });
        expect(
          await tx.$queryRaw`SELECT "B" FROM "_AdminCanteens" WHERE "A" = 'scope-child'`,
        ).toEqual([{ B: 'c1' }]);
        expect(
          await tx.$queryRaw`SELECT "B" FROM "_AdminCanteens" WHERE "A" = 'disjoint'`,
        ).toEqual([]);
        expect(
          await tx.$queryRaw`SELECT id FROM admins WHERE "deletedAt" IS NOT NULL`,
        ).toEqual([{ id: 'retired' }]);
        await tx.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
      },
      { timeout: 15000 },
    );
  });
});
