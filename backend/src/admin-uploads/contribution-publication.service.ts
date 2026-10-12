import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';

@Injectable()
export class ContributionPublicationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContributionPublicationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private activeRun?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingQueueService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => {
      void this.retryPendingRefreshes().catch(() =>
        this.logger.error('Contribution refresh dispatch failed'),
      );
    }, 10000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.activeRun?.catch(() => undefined);
  }

  async retryPendingRefreshes(): Promise<void> {
    if (this.activeRun || this.stopping) return;
    this.activeRun = this.dispatch();
    try {
      await this.activeRun;
    } finally {
      this.activeRun = undefined;
    }
  }

  private async dispatch() {
    const pending = await this.prisma.dishUpload.findMany({
      where: { refreshPending: true, approvedDishId: { not: null } },
      select: { id: true, approvedDishId: true, revision: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    for (const upload of pending) {
      if (this.stopping) break;
      try {
        await this.embeddings.enqueueRefreshDish(upload.approvedDishId!, {
          uploadId: upload.id,
          revision: upload.revision,
        });
      } catch {
        this.logger.warn(
          `Contribution refresh remains pending for ${upload.id}`,
        );
      }
    }
  }
}
