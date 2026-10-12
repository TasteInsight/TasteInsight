import { Prisma } from '@prisma/client';

export async function withdrawDishNotifications(
  tx: Prisma.TransactionClient,
  dishIds: string[],
  reason: 'deleted' | 'offline' = 'deleted',
): Promise<void> {
  if (!dishIds.length) return;
  if (reason === 'deleted') {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM reviews WHERE "dishId" IN (${Prisma.join(dishIds)}) ORDER BY id FOR UPDATE
    `);
  }
  await tx.notificationCampaign.updateMany({
    where: {
      targetId: { in: dishIds },
      type: { in: ['new_dish', 'price_change'] },
      status: { in: ['pending', 'processing'] },
    },
    data: { status: 'cancelled', lockedUntil: null, leaseToken: null },
  });
  await tx.$executeRaw(Prisma.sql`
    WITH withdrawn AS (
      UPDATE notifications n SET "withdrawnAt" = CURRENT_TIMESTAMP
      WHERE n."withdrawnAt" IS NULL AND (
        (n."targetType" = 'dish' AND n."targetId" IN (${Prisma.join(dishIds)}))
        ${
          reason === 'deleted'
            ? Prisma.sql`OR (n."targetType" IN ('review', 'comment') AND COALESCE(n."rootId", n."targetId") IN (
          SELECT id FROM reviews WHERE "dishId" IN (${Prisma.join(dishIds)})
        ))`
            : Prisma.empty
        }
      ) RETURNING id
    )
    UPDATE notification_outbox SET status = 'cancelled', "lockedUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "notificationId" IN (SELECT id FROM withdrawn) AND status IN ('pending', 'processing')
  `);
}
