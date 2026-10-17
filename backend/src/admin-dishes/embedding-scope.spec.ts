import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminDishesService } from './admin-dishes.service';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';

describe('embedding task scope', () => {
  const admin: AdminInfo = {
    id: 'a1',
    username: 'admin',
    role: 'admin',
    scope: 'CANTEENS',
    canteenIds: ['c1', 'c2'],
    permissions: ['dish:view', 'dish:edit'],
  };
  const prisma = { dish: { findMany: jest.fn() } };
  const queue = {
    getDishJobTarget: jest.fn(),
    getJobStatus: jest.fn(),
    cancelJob: jest.fn(),
  };
  const service = new AdminDishesService(
    prisma as any,
    undefined,
    queue as any,
  );
  beforeEach(() => jest.resetAllMocks());
  it('allows tasks for each selected canteen and rejects unrelated task reads and cancellation', async () => {
    queue.getJobStatus.mockResolvedValue({ state: 'waiting' });
    for (const canteenId of ['c1', 'c2']) {
      queue.getDishJobTarget.mockResolvedValue({ canteenId });
      await expect(
        service.getEmbeddingJobStatus('job', admin),
      ).resolves.toMatchObject({ code: 200 });
    }
    queue.getDishJobTarget.mockResolvedValue({ canteenId: 'c3' });
    await expect(service.getEmbeddingJobStatus('job', admin)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.cancelEmbeddingJob('job', admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(queue.cancelJob).not.toHaveBeenCalled();
  });
  it('checks every dish in a batch before cancelling and refuses missing resources', async () => {
    queue.getDishJobTarget.mockResolvedValue({ dishIds: ['d1', 'd2'] });
    prisma.dish.findMany.mockResolvedValue([
      { id: 'd1', canteenId: 'c1' },
      { id: 'd2', canteenId: 'c3' },
    ]);
    await expect(service.cancelEmbeddingJob('job', admin)).rejects.toThrow(
      ForbiddenException,
    );
    prisma.dish.findMany.mockResolvedValue([{ id: 'd1', canteenId: 'c1' }]);
    await expect(service.cancelEmbeddingJob('job', admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(queue.cancelJob).not.toHaveBeenCalled();
  });
  it('keeps user tasks outside the dish-management API', async () => {
    queue.getDishJobTarget.mockResolvedValue(null);
    await expect(
      service.cancelEmbeddingJob('user-job', { ...admin, scope: 'GLOBAL' }),
    ).rejects.toThrow(NotFoundException);
  });
});
