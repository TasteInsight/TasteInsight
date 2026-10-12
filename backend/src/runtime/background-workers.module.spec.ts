import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';
import { EmbeddingQueueProcessor } from '@/embedding-queue/embedding-queue.processor';
import { EMBEDDING_QUEUE } from '@/embedding-queue/embedding-queue.constants';
import { DishSyncQueueModule } from '@/dish-sync-queue/dish-sync-queue.module';
import { DishSyncProcessor } from '@/dish-sync-queue/dish-sync.processor';
import { DISH_SYNC_QUEUE } from '@/dish-sync-queue/dish-sync.constants';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue/dish-review-stats-queue.module';
import { DishReviewStatsProcessor } from '@/dish-review-stats-queue/dish-review-stats.processor';
import { DISH_REVIEW_STATS_QUEUE } from '@/dish-review-stats-queue/dish-review-stats.constants';
import { NotificationsModule } from '@/notifications/notifications.module';
import { NotificationCampaignService } from '@/notifications/notification-campaign.service';
import { NotificationDispatcher } from '@/notifications/notification-dispatcher.service';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { BackgroundWorkersModule } from './background-workers.module';
import {
  WorkerHealthController,
  WorkerHealthModule,
} from './worker-health.module';

describe('background worker composition', () => {
  const workers = [
    EmbeddingQueueProcessor,
    DishSyncProcessor,
    DishReviewStatsProcessor,
    NotificationCampaignService,
    NotificationDispatcher,
  ];

  it.each([
    EmbeddingQueueModule,
    DishSyncQueueModule,
    DishReviewStatsQueueModule,
    NotificationsModule,
    RecommendationModule,
  ])('%p is provider-only and does not start background work', (module) => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? [],
    ).toEqual([]);
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module);
    for (const worker of workers) expect(providers).not.toContain(worker);
  });

  it('registers consumers and schedulers only in the background root', () => {
    expect(
      Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        BackgroundWorkersModule,
      ) ?? [],
    ).toEqual([]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BackgroundWorkersModule),
    ).toEqual(workers);
  });

  it.each([
    EmbeddingQueueModule,
    DishSyncQueueModule,
    DishReviewStatsQueueModule,
  ])('%p exposes its existing queue for the worker consumer', (module) => {
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, module)).toContain(
      BullModule,
    );
  });

  it('waits for every queue consumer to drain during module destruction', async () => {
    let finishJob!: () => void;
    const embedding = {
      worker: {
        close: jest.fn(
          () => new Promise<void>((resolve) => (finishJob = resolve)),
        ),
      },
    };
    const dishSync = {
      worker: { close: jest.fn().mockResolvedValue(undefined) },
    };
    const reviewStats = {
      worker: { close: jest.fn().mockResolvedValue(undefined) },
    };
    const module = new BackgroundWorkersModule(
      embedding as any,
      dishSync as any,
      reviewStats as any,
    );
    let closed = false;
    const shutdown = module.onModuleDestroy().then(() => (closed = true));
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(dishSync.worker.close).toHaveBeenCalledTimes(1);
    expect(reviewStats.worker.close).toHaveBeenCalledTimes(1);
    finishJob();
    await shutdown;
    expect(closed).toBe(true);
  });

  it('can close after startup stops before consumers are registered', async () => {
    const notStarted = Object.defineProperty({}, 'worker', {
      get: () => {
        throw new Error('Worker has not yet been initialized');
      },
    });
    const module = new BackgroundWorkersModule(
      notStarted as any,
      notStarted as any,
      notStarted as any,
    );
    await expect(module.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('resolves actual worker dependencies and drains before shared connection shutdown', async () => {
    const shutdown: string[] = [];
    const prisma = {
      experiment: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      onApplicationShutdown: () => shutdown.push('database'),
    };
    const ping = jest.fn().mockResolvedValue('PONG');
    const builder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        BullModule.forRoot({
          connection: { host: '127.0.0.1', port: 6379, lazyConnect: true },
          extraOptions: { manualRegistration: true },
        }),
        WorkerHealthModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, fallback: unknown) =>
          key === 'NODE_ENV' ? 'test' : fallback,
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RecommendationCacheService)
      .useValue({
        isConnected: () => true,
        getRedisClient: () => ({ ping }),
        onApplicationShutdown: () => shutdown.push('cache'),
      });
    for (const queue of [
      EMBEDDING_QUEUE,
      DISH_SYNC_QUEUE,
      DISH_REVIEW_STATS_QUEUE,
    ]) {
      builder.overrideProvider(getQueueToken(queue)).useValue({});
    }
    const module = await builder.compile();
    for (const processor of [
      EmbeddingQueueProcessor,
      DishSyncProcessor,
      DishReviewStatsProcessor,
    ]) {
      Reflect.set(module.get(processor), '_worker', {
        close: async () => {
          shutdown.push(processor.name);
        },
        isRunning: () => true,
        isPaused: () => false,
        client: Promise.resolve({ ping }),
      });
    }
    try {
      await module.init();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      await expect(
        module.get(WorkerHealthController).getHealth(),
      ).resolves.toEqual({ status: 'ok' });
    } finally {
      await module.close();
    }
    expect(shutdown.slice(0, 3).sort()).toEqual([
      'DishReviewStatsProcessor',
      'DishSyncProcessor',
      'EmbeddingQueueProcessor',
    ]);
    expect(shutdown.slice(3).sort()).toEqual(['cache', 'database']);
  });
});
