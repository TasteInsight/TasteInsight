import {
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '@/prisma.service';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { RecommendationStoreService } from '@/recommendation-store/recommendation-store.service';
import { RecommendationIndexSyncService } from '@/recommendation-store/recommendation-index-sync.service';
export const RECOMMENDATION_INDEX_QUEUE = 'recommendation-index';
const QUEUE = RECOMMENDATION_INDEX_QUEUE;

@Processor(QUEUE)
export class RecommendationIndexProcessor extends WorkerHost {
  constructor(private readonly sync: RecommendationIndexSyncService) {
    super();
  }
  async process(job: Job<{ indexId: string }>) {
    return this.sync.syncIndex(job.data.indexId, 100);
  }
}

@Injectable()
export class RecommendationIndexDispatcher
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(RecommendationIndexDispatcher.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: RecommendationStoreService,
    @InjectQueue(QUEUE) private readonly queue: Queue,
  ) {}
  onModuleInit() {
    if (!this.store.isConfigured() || process.env.NODE_ENV === 'test') return;
    const tick = () => {
      if (!this.running)
        this.running = this.dispatch()
          .catch((e) => {
            this.logger.warn(e.message);
          })
          .finally(() => {
            this.running = undefined;
          });
    };
    this.timer = setInterval(tick, 5000);
    this.timer.unref();
    tick();
  }
  async dispatch() {
    const indexes = await this.prisma.recommendationIndex.findMany({
      where: { status: { in: ['building', 'ready'] } },
      select: { id: true },
    });
    for (const index of indexes)
      await this.queue.add(
        'sync',
        { indexId: index.id },
        {
          jobId: `index-${index.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1500 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}

@Module({
  imports: [RecommendationModule, BullModule.registerQueue({ name: QUEUE })],
  providers: [RecommendationIndexDispatcher, RecommendationIndexProcessor],
  exports: [RecommendationIndexProcessor],
})
export class RecommendationIndexWorkerModule implements OnModuleDestroy {
  constructor(private readonly processor: RecommendationIndexProcessor) {}
  async onModuleDestroy() {
    try {
      await this.processor.worker.close();
    } catch {
      /* Worker may not have started. */
    }
  }
}
