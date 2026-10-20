import { SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const AUDIT_IN_TRANSACTION = 'audit-in-transaction';
export const AuditInTransaction = () => SetMetadata(AUDIT_IN_TRANSACTION, true);

export function grantSnapshot(admin: {
  scope: string;
  canteenIds: string[];
  permissions: { permission: string }[];
}) {
  return {
    scope: admin.scope,
    canteenIds: admin.canteenIds,
    permissions: admin.permissions.map((item) => item.permission).sort(),
  };
}

export async function logAdminChange(
  tx: Prisma.TransactionClient,
  adminId: string,
  action: string,
  targetId: string,
  details: Prisma.InputJsonObject,
) {
  await tx.operationLog.create({
    data: {
      adminId,
      action,
      targetType: 'admin',
      targetId,
      details,
      result: 'success',
    },
  });
}
