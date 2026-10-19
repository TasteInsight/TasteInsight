import { DishUpload, Prisma } from '@prisma/client';
import { NotificationService } from '@/notifications/notification.service';

/** Apply the contribution rejection and its service notification atomically. */
export async function rejectContribution(
  tx: Prisma.TransactionClient,
  upload: DishUpload,
  reason: string,
  notifications?: NotificationService,
): Promise<void> {
  const revision = upload.revision + 1;
  await tx.dishUpload.update({
    where: { id: upload.id },
    data: { status: 'rejected', rejectReason: reason, revision },
  });
  if (upload.userId)
    await notifications?.create(tx, {
      userId: upload.userId,
      actorId: null,
      type: 'upload_rejected',
      targetType: 'dish_upload',
      targetId: upload.id,
      dedupeKey: `upload_rejected:${upload.id}:${revision}`,
    });
}
