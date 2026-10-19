import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModerationAssetsService } from './moderation-assets.service';
import { ModerationSettingsService } from './moderation-settings.service';
import { ModerationPolicy, Submission } from './moderation.types';

@Injectable()
export class ModerationSubmissionService {
  constructor(
    private readonly settings: ModerationSettingsService,
    private readonly assets: ModerationAssetsService,
  ) {}

  policy(tx: Prisma.TransactionClient) {
    return this.settings.policy(tx);
  }

  async submit(
    tx: Prisma.TransactionClient,
    policy: ModerationPolicy,
    input: Submission,
  ): Promise<void> {
    // Supersede old tasks even when the unified policy has just been disabled.
    await tx.contentModerationTask.updateMany({
      where: {
        targetType: input.targetType,
        targetId: input.targetId,
        status: {
          in: ['queued', 'processing', 'waiting', 'ready', 'manual', 'failed'],
        },
      },
      data: { status: 'superseded', lockedUntil: null },
    });
    const managedImages = (input.images ?? []).filter((url) =>
      this.assets.assetId(url),
    );
    await this.assets.assertImages(tx, input.userId, managedImages);
    if (!policy.enabled) return;
    await tx.contentModerationTask.create({
      data: {
        ...input,
        images: input.images ?? [],
        profilePatch: input.profilePatch as Prisma.InputJsonObject | undefined,
        provider: policy.provider,
        mode: policy.mode,
        status: policy.mode === 'manual' ? 'manual' : 'queued',
      },
    });
  }

  async complete(
    tx: Prisma.TransactionClient,
    type: Submission['targetType'],
    id: string,
    version: string,
    approved: boolean,
    images: string[] = [],
  ) {
    if (approved) await this.assets.approve(tx, images);
    else await this.cancelReplies(tx, type, id);
    await tx.contentModerationTask.updateMany({
      where: {
        targetType: type,
        targetId: id,
        version,
        status: {
          in: ['queued', 'processing', 'waiting', 'ready', 'manual', 'failed'],
        },
      },
      data: { status: approved ? 'approved' : 'rejected', lockedUntil: null },
    });
  }

  private async cancelReplies(
    tx: Prisma.TransactionClient,
    type: Submission['targetType'],
    id: string,
  ) {
    if (type !== 'post' && type !== 'review') return;
    const rows =
      type === 'post'
        ? await tx.postComment.findMany({
            where: { postId: id },
            select: { id: true },
          })
        : await tx.comment.findMany({
            where: { reviewId: id },
            select: { id: true },
          });
    if (rows.length)
      await tx.contentModerationTask.updateMany({
        where: {
          targetType: type === 'post' ? 'postComment' : 'comment',
          targetId: { in: rows.map((row) => row.id) },
          status: {
            in: [
              'queued',
              'processing',
              'waiting',
              'ready',
              'manual',
              'failed',
            ],
          },
        },
        data: { status: 'superseded', lockedUntil: null },
      });
  }

  async cancel(
    tx: Prisma.TransactionClient,
    type: Submission['targetType'],
    id: string,
  ) {
    await this.cancelReplies(tx, type, id);
    await tx.contentModerationTask.updateMany({
      where: {
        targetType: type,
        targetId: id,
        status: {
          in: ['queued', 'processing', 'waiting', 'ready', 'manual', 'failed'],
        },
      },
      data: { status: 'superseded', lockedUntil: null },
    });
  }

  async assertApprovable(
    tx: Prisma.TransactionClient,
    type: Submission['targetType'],
    id: string,
    version: string,
  ) {
    const task = await tx.contentModerationTask.findFirst({
      where: { targetType: type, targetId: id, version },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (task && ['queued', 'processing', 'waiting'].includes(task.status))
      throw new ConflictException('内容安全检测进行中，请稍后审核');
    if (task?.status === 'rejected')
      throw new ConflictException('内容安全审核已拒绝，请修改内容后重新提交');
  }
}
