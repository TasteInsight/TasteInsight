import { ContributionPublicationService } from './contribution-publication.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { EmbeddingQueueProcessor } from '@/embedding-queue/embedding-queue.processor';
import { EmbeddingJobType } from '@/embedding-queue/embedding-queue.constants';

describe('Durable contribution embedding refresh', () => {
  const contribution = { uploadId: 'upload', revision: 2 };
  const jobData = {
    dishId: 'dish',
    contributionUploadId: 'upload',
    contributionRevision: 2,
  };

  it('keeps the durable marker after enqueue and retries failed queue submission', async () => {
    const prisma: any = {
      dishUpload: {
        findMany: jest.fn(async () => [
          { id: 'upload', approvedDishId: 'dish', revision: 2 },
        ]),
        updateMany: jest.fn(),
      },
    };
    const embeddings: any = {
      enqueueRefreshDish: jest
        .fn()
        .mockRejectedValueOnce(new Error('redis'))
        .mockResolvedValueOnce('job'),
    };
    const publisher = new ContributionPublicationService(prisma, embeddings, {
      get: () => 'test',
    } as any);
    await publisher.retryPendingRefreshes();
    await publisher.retryPendingRefreshes();
    expect(embeddings.enqueueRefreshDish).toHaveBeenCalledTimes(2);
    expect(embeddings.enqueueRefreshDish).toHaveBeenLastCalledWith(
      'dish',
      contribution,
    );
    expect(prisma.dishUpload.updateMany).not.toHaveBeenCalled();
  });

  it('does not enqueue duplicate jobs while an acknowledged identity is active', async () => {
    const existing = {
      id: 'contribution-upload-2',
      getState: jest.fn(async () => 'active'),
      retry: jest.fn(),
    };
    const queue: any = {
      getJob: jest.fn(async () => existing),
      add: jest.fn(),
    };
    const service = new EmbeddingQueueService(queue, {
      get: () => 'production',
    } as any);
    await service.enqueueRefreshDish('dish', contribution);
    expect(queue.getJob).toHaveBeenCalledWith(existing.id);
    expect(queue.add).not.toHaveBeenCalled();
    expect(existing.retry).not.toHaveBeenCalled();
  });

  it('retries retained failed jobs after the recovery delay, not on every poll', async () => {
    const job = {
      id: 'contribution-upload-2',
      finishedOn: Date.now(),
      getState: jest.fn(async () => 'failed'),
      retry: jest.fn(),
    };
    const queue: any = { getJob: jest.fn(async () => job), add: jest.fn() };
    const service = new EmbeddingQueueService(queue, {
      get: () => 'production',
    } as any);
    await service.enqueueRefreshDish('dish', contribution);
    expect(job.retry).not.toHaveBeenCalled();
    job.finishedOn -= 61000;
    await service.enqueueRefreshDish('dish', contribution);
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('uses one durable job identity per approved revision', async () => {
    const queue: any = {
      getJob: jest.fn(async () => null),
      add: jest.fn(async () => ({ id: 'job' })),
    };
    const service = new EmbeddingQueueService(queue, {
      get: () => 'production',
    } as any);
    await service.enqueueRefreshDish('dish', contribution);
    expect(queue.add).toHaveBeenCalledWith(
      EmbeddingJobType.REFRESH_DISH,
      jobData,
      expect.objectContaining({ jobId: 'contribution-upload-2', attempts: 3 }),
    );
  });

  it('throws on a false generation result and clears the matching revision only after success', async () => {
    const embeddings: any = {
      updateDishEmbedding: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    };
    const prisma: any = {
      dishUpload: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const processor = new EmbeddingQueueProcessor(
      embeddings,
      {} as any,
      {} as any,
      prisma,
    );
    const job: any = {
      id: 'job',
      name: EmbeddingJobType.REFRESH_DISH,
      data: jobData,
    };
    await expect(processor.process(job)).rejects.toThrow('refresh failed');
    expect(prisma.dishUpload.updateMany).not.toHaveBeenCalled();
    await expect(processor.process(job)).resolves.toMatchObject({
      success: true,
    });
    expect(prisma.dishUpload.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'upload',
        revision: 2,
        approvedDishId: 'dish',
        refreshPending: true,
      },
      data: { refreshPending: false },
    });
  });

  it('does not acknowledge failed synchronous generation in test mode', async () => {
    const embeddings: any = {
      updateDishEmbedding: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    };
    const prisma: any = { dishUpload: { updateMany: jest.fn() } };
    const service = new EmbeddingQueueService(
      {} as any,
      { get: () => 'test' } as any,
      embeddings,
      undefined,
      prisma,
    );
    await expect(
      service.enqueueRefreshDish('dish', contribution),
    ).rejects.toThrow('refresh failed');
    expect(prisma.dishUpload.updateMany).not.toHaveBeenCalled();
    await service.enqueueRefreshDish('dish', contribution);
    expect(prisma.dishUpload.updateMany).toHaveBeenCalledTimes(1);
  });
});
