import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WerssClient } from './werss.client';
export const NEWS_SYNC_QUEUE = 'news-source-sync';
@Injectable()
export class NewsSourcesQueue implements OnModuleInit {
  constructor(
    @InjectQueue(NEWS_SYNC_QUEUE) private readonly queue: Queue,
    private readonly werss: WerssClient,
  ) {}
  async onModuleInit() {
    if (this.werss.configured)
      await this.queue.upsertJobScheduler(
        'news-source-scan',
        { every: 60000 },
        {
          name: 'scan',
          data: {},
          opts: { removeOnComplete: 10, removeOnFail: 20 },
        },
      );
    else await this.queue.removeJobScheduler('news-source-scan');
  }
  async enqueue(id: string) {
    await this.queue.add(
      'sync',
      { id },
      { jobId: `source-${id}`, removeOnComplete: true, removeOnFail: true },
    );
  }
}
