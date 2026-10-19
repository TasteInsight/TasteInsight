import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentModerationTask, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { ModerationProviderService } from './providers/moderation-provider.service';
import { ModerationAssetsService } from './moderation-assets.service';
import { ModerationPublicationService } from './moderation-publication.service';
import { ModerationProvider } from './moderation.types';

type Result = {
  decision: 'pass' | 'review' | 'block' | 'pending';
  requestId?: string;
  reason?: string;
};
type Results = Record<string, Result>;

@Injectable()
export class ModerationWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(ModerationWorkerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ModerationProviderService,
    private readonly assets: ModerationAssetsService,
    private readonly publication: ModerationPublicationService,
    private readonly config: ConfigService,
  ) {}
  start() {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(
      () =>
        void this.tick().catch(() =>
          this.logger.error('Content moderation dispatch failed'),
        ),
      3000,
    );
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }
  async tick() {
    if (this.running || this.stopping) return;
    this.running = this.dispatch();
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }
  private async dispatch() {
    const now = new Date();
    // The callback delivery window is 30 minutes; overdue items enter the manual queue.
    await this.prisma.contentModerationTask.updateMany({
      where: {
        status: 'waiting',
        callbackDeadline: { lt: now },
      },
      data: {
        status: 'failed',
        reason: '图片检测回调超时，请人工复核',
        lockedUntil: null,
      },
    });
    const rows = await this.prisma.contentModerationTask.findMany({
      where: {
        OR: [
          {
            status: { in: ['queued', 'waiting', 'ready'] },
            nextAttemptAt: { lte: now },
          },
          { status: 'processing', lockedUntil: { lt: now } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    for (const row of rows) {
      if (this.stopping) break;
      await this.process(row);
    }
  }
  async process(row: ContentModerationTask) {
    const lock = new Date(Date.now() + 60000);
    const claimed = await this.prisma.contentModerationTask.updateMany({
      where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
      data: {
        status: 'processing',
        lockedUntil: lock,
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return;
    const claim = { id: row.id, status: 'processing', lockedUntil: lock };
    try {
      if (!(await this.publication.current(row))) {
        await this.prisma.contentModerationTask.updateMany({
          where: claim,
          data: { status: 'superseded', lockedUntil: null },
        });
        return;
      }
      if (row.status === 'ready') {
        // Keep ready as a persisted publication intent, including after a process restart.
        const ready = await this.prisma.contentModerationTask.updateMany({
          where: claim,
          data: { status: 'ready', lockedUntil: null },
        });
        if (ready.count) await this.publication.apply(row, true);
        return;
      }
      const provider = row.provider as ModerationProvider;
      const results = { ...(row.results as Results) };
      const scene =
        row.targetType === 'profile' ? 1 : row.targetType === 'post' ? 3 : 2;
      if (row.text.trim() && !results.text) {
        results.text = await this.providers.checkText(provider, {
          text: row.text,
          userId: row.userId,
          scene,
        });
        await this.saveResults(claim, results);
      }
      for (let index = 0; index < row.images.length; index++) {
        const key = `image:${index}`;
        if (results[key]) continue;
        const id = this.assets.assetId(row.images[index]);
        if (!id) {
          results[key] = {
            decision: 'review',
            reason: '历史或外部图片需要人工复核',
          };
        } else {
          const asset =
            await this.prisma.contentModerationAsset.findUniqueOrThrow({
              where: { id },
            });
          // Both default APIs inspect a single image; motion needs a human review.
          results[key] = asset.animated
            ? { decision: 'review', reason: '动图需要人工复核全部画面' }
            : await this.providers.checkImage(provider, {
                url: this.assets.preview(id),
                userId: row.userId,
                scene,
              });
        }
        await this.saveResults(claim, results);
      }
      // Receipts are persisted independently so a callback arriving before the
      // submit response is saved remains available after restarts.
      for (const result of Object.values(results)) {
        if (result.decision !== 'pending' || !result.requestId) continue;
        const receipt = await this.prisma.contentModerationReceipt.findUnique({
          where: { traceId: result.requestId },
        });
        if (receipt)
          result.decision = receipt.decision as 'pass' | 'review' | 'block';
      }
      const decisions = Object.values(results);
      const status = decisions.some((r) => r.decision === 'pending')
        ? 'waiting'
        : decisions.some((r) => r.decision === 'block')
          ? 'blocked'
          : decisions.some((r) => r.decision === 'review') ||
              row.mode === 'machine_and_manual' ||
              row.targetType === 'dishUpload'
            ? 'manual'
            : 'ready';
      const reason =
        decisions.find((r) => r.reason)?.reason ??
        (status === 'blocked' ? '内容安全检测发现违规内容' : null);
      const saved = await this.prisma.contentModerationTask.updateMany({
        where: claim,
        data: {
          status: status === 'blocked' ? 'manual' : status,
          results: results as unknown as Prisma.InputJsonObject,
          reason,
          lockedUntil: null,
          callbackDeadline:
            status === 'waiting'
              ? (row.callbackDeadline ?? new Date(Date.now() + 31 * 60 * 1000))
              : null,
          nextAttemptAt: new Date(
            Date.now() + (status === 'waiting' ? 10000 : 0),
          ),
        },
      });
      if (!saved.count) return;
      const current = await this.prisma.contentModerationTask.findUniqueOrThrow(
        { where: { id: row.id } },
      );
      if (status === 'blocked')
        await this.publication.apply(current, false, reason!);
      else if (status === 'ready') await this.publication.apply(current, true);
    } catch {
      // Preserve the last saved results. Unknown/transport errors always require human review.
      await this.prisma.contentModerationTask.updateMany({
        where: {
          id: row.id,
          OR: [
            { status: 'processing', lockedUntil: claim.lockedUntil },
            { status: 'ready' },
          ],
        },
        data: {
          status: 'failed',
          reason: '检测或发布未完成，请人工复核',
          lockedUntil: null,
        },
      });
    }
  }
  private async saveResults(
    claim: { id: string; status: string; lockedUntil: Date },
    results: Results,
  ) {
    const lockedUntil = new Date(Date.now() + 60000);
    const saved = await this.prisma.contentModerationTask.updateMany({
      where: claim,
      data: {
        results: results as unknown as Prisma.InputJsonObject,
        lockedUntil,
      },
    });
    if (!saved.count) throw new Error('Task superseded');
    claim.lockedUntil = lockedUntil;
  }

  async receive(traceId: string, decision: 'pass' | 'review' | 'block') {
    await this.prisma.contentModerationReceipt.upsert({
      where: { traceId },
      create: { traceId, decision },
      update: {},
    });
  }
}
