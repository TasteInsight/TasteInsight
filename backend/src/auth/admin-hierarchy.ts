import { Prisma } from '@prisma/client';

export async function lockAdminHierarchy(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('tasteinsight.admin-hierarchy'))`;
}

export async function selfAndDescendantAdminIds(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  adminId: string,
): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM admins WHERE id = ${adminId}
      UNION
      SELECT child.id FROM admins child
      JOIN descendants parent ON child."managerId" = parent.id
    )
    SELECT id FROM descendants ORDER BY id
  `);
  return rows.map((row) => row.id);
}

export async function bumpAdminHierarchyVersions(
  tx: Prisma.TransactionClient,
  adminIds: string[],
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, "managerId" FROM admins WHERE id IN (${Prisma.join(adminIds)})
      UNION
      SELECT parent.id, parent."managerId" FROM admins parent
      JOIN ancestors child ON parent.id = child."managerId"
    )
    UPDATE admins SET "hierarchyVersion" = "hierarchyVersion" + 1
    WHERE id IN (SELECT id FROM ancestors)
    RETURNING id
  `);
}
