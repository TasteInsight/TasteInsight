import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EmbeddingQueueService } from './embedding-queue.service';
import { EMBEDDING_QUEUE, EmbeddingJobType } from './embedding-queue.constants';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { RecommendationService } from '@/recommendation/recommendation.service';

describe('EmbeddingQueueService', () => {
  let service: EmbeddingQueueService;
  let mockQueue: any;

  const mockJob = {
    id: 'test-job-id',
    data: { canteenId: 'canteen-1' },
    progress: { processed: 5, total: 10 },
    attemptsMade: 1,
    returnvalue: null,
    failedReason: null,
    getState: jest.fn(),
    remove: jest.fn(),
    updateData: jest.fn(),
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'new-job-id' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingQueueService,
        {
          provide: getQueueToken(EMBEDDING_QUEUE),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            updateDishEmbeddingsByCanteen: jest.fn(),
            updateDishEmbedding: jest.fn(),
            updateDishEmbeddingsBatch: jest.fn(),
          },
        },
        {
          provide: RecommendationService,
          useValue: {
            refreshUserFeatureCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingQueueService>(EmbeddingQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueueRefreshCanteenDishes', () => {
    it('should add a job to the queue', async () => {
      const canteenId = 'canteen-123';
      const result = await service.enqueueRefreshCanteenDishes(canteenId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        EmbeddingJobType.REFRESH_CANTEEN_DISHES,
        { canteenId },
        expect.any(Object),
      );
      expect(result).toBe('new-job-id');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('active');

      const result = await service.getJobStatus('test-job-id');

      expect(result).toEqual({
        id: 'test-job-id',
        state: 'active',
        progress: { processed: 5, total: 10 },
        attemptsMade: 1,
        returnValue: null,
        failedReason: null,
      });
    });

    it('should return null when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('isJobCancelled', () => {
    it('should return true when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.isJobCancelled('non-existent-id');

      expect(result).toBe(true);
    });

    it('should return true when job data has cancelled flag', async () => {
      mockQueue.getJob.mockResolvedValue({
        ...mockJob,
        data: { ...mockJob.data, cancelled: true },
      });

      const result = await service.isJobCancelled('test-job-id');

      expect(result).toBe(true);
    });

    it('should return false when job is not cancelled', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.isJobCancelled('test-job-id');

      expect(result).toBe(false);
    });
  });

  describe('cancelJob', () => {
    it('should return error when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.cancelJob('non-existent-id');

      expect(result).toEqual({
        success: false,
        message: '任务不存在',
      });
    });

    it('should return error when job is already completed', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('completed');

      const result = await service.cancelJob('test-job-id');

      expect(result).toEqual({
        success: false,
        message: '任务已完成',
      });
    });

    it('should return error when job is already failed', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('failed');

      const result = await service.cancelJob('test-job-id');

      expect(result).toEqual({
        success: false,
        message: '任务已失败',
      });
    });

    it('should mark active job for cancellation', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('active');

      const result = await service.cancelJob('test-job-id');

      expect(mockJob.updateData).toHaveBeenCalledWith({
        ...mockJob.data,
        cancelled: true,
      });
      expect(result).toEqual({
        success: true,
        message: '已请求取消任务，任务将在下一个检查点停止',
      });
    });

    it('should remove waiting job', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('waiting');

      const result = await service.cancelJob('test-job-id');

      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: '任务已取消',
      });
    });

    it('should remove delayed job', async () => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('delayed');

      const result = await service.cancelJob('test-job-id');

      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: '任务已取消',
      });
    });
  });
});
