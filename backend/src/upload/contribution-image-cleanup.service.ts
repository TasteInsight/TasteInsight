import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { UploadService } from './upload.service';

@Injectable()
export class ContributionImageCleanup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContributionImageCleanup.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.warn('Contribution image cleanup will retry'),
      );
    }, 300000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.active?.catch(() => undefined);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.active || this.stopping) return;
    this.active = this.cleanup(now);
    try {
      await this.active;
    } finally {
      this.active = undefined;
    }
  }

  private async cleanup(now: Date): Promise<void> {
    const due = await this.prisma.contributionImage.findMany({
      where: {
        storageType: this.upload.storageType,
        uploadId: null,
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: 'asc' },
      take: 50,
    });
    for (const image of due) {
      if (this.stopping) break;
      const expired = await this.prisma.contributionImage.updateMany({
        where: { id: image.id, uploadId: null, expiresAt: { lte: now } },
        data: { deletedAt: now },
      });
      if (!expired.count) continue;
      try {
        await this.upload.removeContributionImage(
          image.storageType,
          image.storageKey,
        );
        // Retain the tombstone so saved drafts cannot reuse an expired URL.
        await this.prisma.contributionImage.updateMany({
          where: { id: image.id, deletedAt: { not: null }, uploadId: null },
          data: { expiresAt: null },
        });
      } catch {
        await this.prisma.contributionImage.updateMany({
          where: { id: image.id, deletedAt: { not: null }, uploadId: null },
          data: { expiresAt: new Date(now.getTime() + 300000) },
        });
        this.logger.warn(`Contribution image ${image.id} cleanup will retry`);
      }
    }
  }
}
