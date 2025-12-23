import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  EMBEDDING_QUEUE,
  EmbeddingJobType,
  RefreshDishJobData,
  RefreshCanteenDishesJobData,
  RefreshDishesBatchJobData,
  RefreshUserJobData,
} from './embedding-queue.constants';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingQueueService {
  private readonly logger = new Logger(EmbeddingQueueService.name);
  private readonly mode: 'async' | 'sync';
  private readonly jobOptions: JobsOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1500 },
    removeOnComplete: 100,
    removeOnFail: 100,
  };

  constructor(
    @InjectQueue(EMBEDDING_QUEUE) private readonly embeddingQueue: Queue,
    private readonly configService: ConfigService,
    @Optional() private readonly embeddingService?: EmbeddingService,
    @Optional() private readonly recommendationService?: RecommendationService,
  ) {
    this.mode =
      this.configService.get('NODE_ENV') === 'test' ? 'sync' : 'async';
  }

  /**
   * 刷新指定食堂的所有菜品嵌入
   */
  async enqueueRefreshCanteenDishes(canteenId: string): Promise<string | void> {
    if (this.mode === 'sync') {
      await this.embeddingService?.updateDishEmbeddingsByCanteen(canteenId);
      return;
    }
    const data: RefreshCanteenDishesJobData = { canteenId };
    const job = await this.embeddingQueue.add(
      EmbeddingJobType.REFRESH_CANTEEN_DISHES,
      data,
      this.jobOptions,
    );
    this.logger.log(
      `Queued refresh-canteen-dishes job ${job.id} for canteen ${canteenId}`,
    );
    return job.id as string;
  }

  /**
   * 刷新单个菜品嵌入
   */
  async enqueueRefreshDish(dishId: string): Promise<string | void> {
    if (this.mode === 'sync') {
      await this.embeddingService?.updateDishEmbedding(dishId);
      return;
    }
    const data: RefreshDishJobData = { dishId };
    const job = await this.embeddingQueue.add(
      EmbeddingJobType.REFRESH_DISH,
      data,
      this.jobOptions,
    );
    this.logger.log(`Queued refresh-dish job ${job.id} for dish ${dishId}`);
    return job.id as string;
  }

  /**
   * 批量刷新菜品嵌入
   */
  async enqueueRefreshDishesBatch(dishIds: string[]): Promise<string | void> {
    if (dishIds.length === 0) return;

    if (this.mode === 'sync') {
      await this.embeddingService?.updateDishEmbeddingsBatch(dishIds);
      return;
    }
    const data: RefreshDishesBatchJobData = { dishIds };
    const job = await this.embeddingQueue.add(
      EmbeddingJobType.REFRESH_DISHES_BATCH,
      data,
      this.jobOptions,
    );
    this.logger.log(
      `Queued refresh-dishes-batch job ${job.id} for ${dishIds.length} dishes`,
    );
    return job.id as string;
  }

  /**
   * 刷新用户嵌入
   * 用户更新偏好或行为变化时调用
   */
  async enqueueRefreshUser(userId: string): Promise<string | void> {
    if (this.mode === 'sync') {
      // 同步模式：使用 refreshUserFeatureCache 来统一处理所有相关缓存的失效和刷新
      // 这会失效用户特征缓存、推荐结果缓存和用户嵌入缓存，然后重新获取并缓存
      if (this.recommendationService) {
        await this.recommendationService.refreshUserFeatureCache(userId);
      }
      return;
    }
    const data: RefreshUserJobData = { userId };
    const job = await this.embeddingQueue.add(
      EmbeddingJobType.REFRESH_USER,
      data,
      {
        ...this.jobOptions,
        // 用户嵌入更新可以去重，避免频繁更新
        jobId: `user-embedding-${userId}`,
        removeOnComplete: 50,
      },
    );
    this.logger.log(`Queued refresh-user job ${job.id} for user ${userId}`);
    return job.id as string;
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(jobId: string) {
    const job = await this.embeddingQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      returnValue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
