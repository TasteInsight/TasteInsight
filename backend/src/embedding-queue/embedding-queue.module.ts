import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EMBEDDING_QUEUE } from './embedding-queue.constants';
import { EmbeddingQueueProcessor } from './embedding-queue.processor';
import { EmbeddingQueueService } from './embedding-queue.service';
import { RecommendationModule } from '@/recommendation/recommendation.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => RecommendationModule),
    BullModule.registerQueue({
      name: EMBEDDING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
  ],
  providers: [EmbeddingQueueProcessor, EmbeddingQueueService],
  exports: [EmbeddingQueueService],
})
export class EmbeddingQueueModule {}
