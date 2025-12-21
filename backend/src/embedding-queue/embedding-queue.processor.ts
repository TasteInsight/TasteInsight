import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import {
  EMBEDDING_QUEUE,
  EmbeddingJobType,
  RefreshDishJobData,
  RefreshCanteenDishesJobData,
  RefreshDishesBatchJobData,
  RefreshUserJobData,
} from './embedding-queue.constants';

@Processor(EMBEDDING_QUEUE)
export class EmbeddingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingQueueProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly recommendationService: RecommendationService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing embedding job ${job.id} of type ${job.name}`);

    switch (job.name as EmbeddingJobType) {
      case EmbeddingJobType.REFRESH_CANTEEN_DISHES:
        return this.handleRefreshCanteenDishes(
          job.data as RefreshCanteenDishesJobData,
        );

      case EmbeddingJobType.REFRESH_DISH:
        return this.handleRefreshDish(job.data as RefreshDishJobData);

      case EmbeddingJobType.REFRESH_DISHES_BATCH:
        return this.handleRefreshDishesBatch(
          job.data as RefreshDishesBatchJobData,
        );

      case EmbeddingJobType.REFRESH_USER:
        return this.handleRefreshUser(job.data as RefreshUserJobData);

      default:
        this.logger.warn(`Unknown embedding job type: ${job.name}`);
        return null;
    }
  }

  /**
   * 处理刷新食堂菜品嵌入任务
   */
  private async handleRefreshCanteenDishes(
    data: RefreshCanteenDishesJobData,
  ): Promise<{ canteenId: string; count: number }> {
    const { canteenId } = data;
    const count =
      await this.embeddingService.updateDishEmbeddingsByCanteen(canteenId);
    return { canteenId, count };
  }

  /**
   * 处理刷新单个菜品嵌入任务
   */
  private async handleRefreshDish(
    data: RefreshDishJobData,
  ): Promise<{ dishId: string; success: boolean }> {
    const { dishId } = data;
    const success = await this.embeddingService.updateDishEmbedding(dishId);
    return { dishId, success };
  }

  /**
   * 处理批量刷新菜品嵌入任务
   */
  private async handleRefreshDishesBatch(
    data: RefreshDishesBatchJobData,
  ): Promise<{ count: number }> {
    const { dishIds } = data;
    const count =
      await this.embeddingService.updateDishEmbeddingsBatch(dishIds);
    return { count };
  }

  /**
   * 处理刷新用户嵌入任务
   * 用户更新偏好或行为变化时调用
   */
  private async handleRefreshUser(
    data: RefreshUserJobData,
  ): Promise<{ userId: string; success: boolean }> {
    const { userId } = data;
    try {
      // 使用 refreshUserFeatureCache 来统一处理所有相关缓存的失效和刷新
      // 这会失效用户特征缓存、推荐结果缓存和用户嵌入缓存，然后重新获取并缓存
      await this.recommendationService.refreshUserFeatureCache(userId);
      return { userId, success: true };
    } catch (error) {
      this.logger.error(
        `Failed to refresh user embedding for ${userId}:`,
        error,
      );
      return { userId, success: false };
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Embedding job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Embedding job ${job.id} failed: ${error.message}`);
  }
}
