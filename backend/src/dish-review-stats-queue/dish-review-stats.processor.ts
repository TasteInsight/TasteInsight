import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DishReviewStatsService } from './dish-review-stats.service';
import {
  DISH_REVIEW_STATS_QUEUE,
  DishReviewStatsJobType,
  RecomputeDishReviewStatsJobData,
} from './dish-review-stats.constants';

@Processor(DISH_REVIEW_STATS_QUEUE)
export class DishReviewStatsProcessor extends WorkerHost {
  private readonly logger = new Logger(DishReviewStatsProcessor.name);

  constructor(private readonly dishReviewStatsService: DishReviewStatsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name as DishReviewStatsJobType) {
      case DishReviewStatsJobType.RECOMPUTE_DISH_REVIEW_STATS: {
        const { dishId } = job.data as RecomputeDishReviewStatsJobData;
        await this.dishReviewStatsService.recomputeDishStatsNow(dishId);
        return;
      }
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
