import { RecommendationIndexProcessor } from '@/recommendation-platform/index-worker.module';
import { NewsSourcesProcessor } from '@/news-sources/news-sources.processor';
import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DishReviewStatsProcessor } from '@/dish-review-stats-queue/dish-review-stats.processor';
import { DishSyncProcessor } from '@/dish-sync-queue/dish-sync.processor';
import { EmbeddingQueueProcessor } from '@/embedding-queue/embedding-queue.processor';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { BackgroundWorkersModule } from './background-workers.module';

@Controller('health')
export class WorkerHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RecommendationCacheService,
    private readonly embedding: EmbeddingQueueProcessor,
    private readonly dishSync: DishSyncProcessor,
    private readonly reviewStats: DishReviewStatsProcessor,
    private readonly newsSources: NewsSourcesProcessor,
    private readonly recommendationIndex: RecommendationIndexProcessor,
  ) {}

  @Get()
  async getHealth(): Promise<{ status: 'ok' }> {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const workers = [
        this.embedding,
        this.dishSync,
        this.reviewStats,
        this.newsSources,
        this.recommendationIndex,
      ].map((processor) => processor.worker);
      if (
        workers.some(
          (worker) =>
            Boolean(worker.closing) || !worker.isRunning() || worker.isPaused(),
        ) ||
        !this.cache.isConnected()
      ) {
        throw new Error('Worker not ready');
      }
      await Promise.race([
        Promise.all([
          this.prisma.$queryRaw`SELECT 1`,
          this.cache.getRedisClient().ping(),
          ...workers.map(async (worker) => (await worker.client).info()),
        ]),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('Readiness timeout')),
            2000,
          );
        }),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }
}

@Module({
  imports: [BackgroundWorkersModule],
  controllers: [WorkerHealthController],
})
export class WorkerHealthModule {}
