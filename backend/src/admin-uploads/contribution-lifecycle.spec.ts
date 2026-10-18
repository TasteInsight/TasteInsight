import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminUploadsService } from './admin-uploads.service';

describe('Contribution review lifecycle', () => {
  function fixture() {
    const upload: any = {
      id: 'upload',
      userId: 'author',
      kind: 'create',
      revision: 2,
      status: 'approved',
      approvedDishId: 'dish',
      canteenId: 'canteen',
      parentDishId: null,
      parentUploadId: null,
      changedFields: [],
    };
    const dish: any = {
      id: 'dish',
      name: '菜品',
      price: 10,
      status: 'online',
      canteenId: 'canteen',
      images: ['old.jpg'],
      updatedAt: new Date('2026-10-10T00:00:00Z'),
    };
    const prisma: any = {
      dishUpload: {
        findUnique: jest.fn(async () => ({ ...upload })),
        findFirst: jest.fn(async () => null),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(async ({ data }) => Object.assign(upload, data)),
      },
      dish: {
        findUnique: jest.fn(async () => ({ ...dish })),
        findFirst: jest.fn(async () => null),
        delete: jest.fn(async () => dish),
        update: jest.fn(async ({ data }) => Object.assign(dish, data)),
        create: jest.fn(async ({ data }) => ({ id: 'new-dish', ...data })),
      },
      notification: { createMany: jest.fn(async () => ({ count: 1 })) },
      notificationCampaign: {
        createMany: jest.fn(async () => ({ count: 1 })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      $queryRaw: jest.fn(async () => []),
      $executeRaw: jest.fn(async () => 0),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    return { upload, dish, prisma, service: new AdminUploadsService(prisma) };
  }

  it('unpublishes a created dish without deleting its identity or engagements', async () => {
    const { service, prisma, upload, dish } = fixture();
    await service.revokeUpload('upload', {
      scope: 'GLOBAL' as const,
      canteenIds: [],
    });
    expect(prisma.dish.delete).not.toHaveBeenCalled();
    expect(dish.status).toBe('offline');
    expect(upload.approvedDishId).toBe('dish');
    expect(upload.status).toBe('pending');
  });

  it('rejects whitespace-only rejection reasons', async () => {
    const { service, upload, prisma } = fixture();
    upload.status = 'pending';
    await expect(
      service.rejectUpload('upload', '   ', {
        scope: 'GLOBAL' as const,
        canteenIds: [],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dishUpload.update).not.toHaveBeenCalled();
  });

  it('rejects a stale approval revision before publishing', async () => {
    const { service, upload, prisma } = fixture();
    upload.status = 'pending';
    await expect(
      (service.approveUpload as any)(
        'upload',
        { scope: 'GLOBAL', canteenIds: [] },
        { revision: 1 },
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });

  it('does not roll back a correction over subsequent edits', async () => {
    const { service, upload, prisma } = fixture();
    Object.assign(upload, {
      kind: 'update',
      targetDishId: 'dish',
      baseSnapshot: { price: 8 },
      approvedSnapshot: { price: 9 },
      changedFields: ['price'],
    });
    await expect(
      service.revokeUpload('upload', {
        scope: 'GLOBAL' as const,
        canteenIds: [],
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.dish.delete).not.toHaveBeenCalled();
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });
});
