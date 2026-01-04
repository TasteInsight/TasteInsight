import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import {
  EmbeddingQueueProcessor,
  JobCancelledError,
} from './embedding-queue.processor';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { EMBEDDING_QUEUE, EmbeddingJobType } from './embedding-queue.constants';

describe('EmbeddingQueueProcessor', () => {
  let processor: EmbeddingQueueProcessor;
  let mockEmbeddingService: any;
  let mockRecommendationService: any;
  let mockQueue: any;

  const createMockJob = (
    name: string,
    data: any,
    options: Partial<Job> = {},
  ): Partial<Job> => ({
    id: 'test-job-id',
    name,
    data,
    token: 'test-token',
    updateProgress: jest.fn().mockResolvedValue(undefined),
    ...options,
  });

  beforeEach(async () => {
    mockEmbeddingService = {
      updateDishEmbeddingsByCanteen: jest.fn(),
      updateDishEmbedding: jest.fn(),
      updateDishEmbeddingsBatch: jest.fn(),
    };

    mockRecommendationService = {
      refreshUserFeatureCache: jest.fn(),
    };

    mockQueue = {
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingQueueProcessor,
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
        {
          provide: RecommendationService,
          useValue: mockRecommendationService,
        },
        {
          provide: getQueueToken(EMBEDDING_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    processor = module.get<EmbeddingQueueProcessor>(EmbeddingQueueProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should handle REFRESH_CANTEEN_DISHES job', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_CANTEEN_DISHES, {
        canteenId: 'canteen-1',
      });
      mockEmbeddingService.updateDishEmbeddingsByCanteen.mockResolvedValue(10);
      mockQueue.getJob.mockResolvedValue({ data: { canteenId: 'canteen-1' } });

      const result = await processor.process(mockJob as Job);

      expect(result).toEqual({
        canteenId: 'canteen-1',
        count: 10,
      });
    });

    it('should handle REFRESH_DISH job', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_DISH, {
        dishId: 'dish-1',
      });
      mockEmbeddingService.updateDishEmbedding.mockResolvedValue(true);

      const result = await processor.process(mockJob as Job);

      expect(result).toEqual({
        dishId: 'dish-1',
        success: true,
      });
    });

    it('should handle REFRESH_DISHES_BATCH job', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_DISHES_BATCH, {
        dishIds: ['dish-1', 'dish-2'],
      });
      mockEmbeddingService.updateDishEmbeddingsBatch.mockResolvedValue(2);

      const result = await processor.process(mockJob as Job);

      expect(result).toEqual({
        count: 2,
      });
    });

    it('should handle REFRESH_USER job', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_USER, {
        userId: 'user-1',
      });
      mockRecommendationService.refreshUserFeatureCache.mockResolvedValue(
        undefined,
      );

      const result = await processor.process(mockJob as Job);

      expect(result).toEqual({
        userId: 'user-1',
        success: true,
      });
    });

    it('should return null for unknown job type', async () => {
      const mockJob = createMockJob('UNKNOWN_TYPE', {});

      const result = await processor.process(mockJob as Job);

      expect(result).toBeNull();
    });
  });

  describe('handleRefreshCanteenDishes with cancellation', () => {
    it('should check for cancellation during processing', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_CANTEEN_DISHES, {
        canteenId: 'canteen-1',
      });

      // Mock queue.getJob to return non-cancelled job
      mockQueue.getJob.mockResolvedValue({ data: { canteenId: 'canteen-1' } });

      // Simulate embedding service calling progress callback
      mockEmbeddingService.updateDishEmbeddingsByCanteen.mockImplementation(
        async (canteenId: string, onProgress?: Function) => {
          if (onProgress) {
            await onProgress(5, 10);
          }
          return 10;
        },
      );

      const result = await processor.process(mockJob as Job);

      expect(mockJob.updateProgress).toHaveBeenCalledWith({
        processed: 5,
        total: 10,
      });
      expect(result).toEqual({
        canteenId: 'canteen-1',
        count: 10,
      });
    });

    it('should stop processing when job is cancelled', async () => {
      const mockJob = createMockJob(EmbeddingJobType.REFRESH_CANTEEN_DISHES, {
        canteenId: 'canteen-1',
      });

      // Mock queue.getJob to return cancelled job
      mockQueue.getJob.mockResolvedValue({
        data: { canteenId: 'canteen-1', cancelled: true },
      });

      mockEmbeddingService.updateDishEmbeddingsByCanteen.mockImplementation(
        async (canteenId: string, onProgress?: Function) => {
          if (onProgress) {
            // This should throw JobCancelledError because the job is cancelled
            await onProgress(5, 10);
          }
          return 10;
        },
      );

      const result = await processor.process(mockJob as Job);

      // Should return with cancelled flag
      expect(result).toEqual({
        canteenId: 'canteen-1',
        count: 0,
        cancelled: true,
      });
    });
  });

  describe('JobCancelledError', () => {
    it('should create error with correct message', () => {
      const error = new JobCancelledError('job-123');

      expect(error.message).toBe('Job job-123 was cancelled');
      expect(error.name).toBe('JobCancelledError');
    });
  });
});
