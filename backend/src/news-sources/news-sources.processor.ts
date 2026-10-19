import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma.service';
import { NewsSourcesService } from './news-sources.service';
import { NEWS_SYNC_QUEUE, NewsSourcesQueue } from './news-sources.queue';
@Processor(NEWS_SYNC_QUEUE)
export class NewsSourcesProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: NewsSourcesService,
    private readonly queue: NewsSourcesQueue,
  ) {
    super();
  }
  async process(job: Job<{ id: string }>) {
    if (job.name === 'sync') return this.sources.sync(job.data.id);
    const items = await this.prisma.newsSource.findMany({
      where: { enabled: true, nextSyncAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const item of items) await this.queue.enqueue(item.id);
  }
}
