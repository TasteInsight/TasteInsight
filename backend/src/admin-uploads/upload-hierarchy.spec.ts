import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminUploadsService } from './admin-uploads.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';

describe('Pending dish hierarchy', () => {
  const creator = {
    id: 'creator',
    role: 'admin',
    canteenId: 'canteen',
    permissions: ['dish:create'],
  };
  const window = {
    id: 'window',
    canteenId: 'canteen',
    canteen: { name: '食堂' },
    floor: null,
  };
  const parent = {
    id: 'parent-upload',
    name: '父菜品',
    adminId: 'creator',
    canteenId: 'canteen',
    status: 'pending',
    approvedDishId: null,
  };
  const child = {
    id: 'child-upload',
    name: '子菜品',
    adminId: 'creator',
    canteenId: 'canteen',
    status: 'pending',
    parentUploadId: 'parent-upload',
    parentDishId: null,
  };
  let prisma: any;
  let uploads: AdminUploadsService;
  let dishes: AdminDishesService;

  beforeEach(() => {
    prisma = {
      dishUpload: {
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            where.id === parent.id ? parent : child,
          ),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          ...data,
          id: 'created-upload',
          window,
        })),
      },
      dish: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'approved-parent', canteenId: 'canteen' }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'approved-child' }),
        delete: jest.fn(),
      },
      window: { findUnique: jest.fn().mockResolvedValue(window) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(prisma)),
    };
    uploads = new AdminUploadsService(prisma);
    dishes = new AdminDishesService(prisma);
  });

  it('creates a pending child linked to a pending upload, not a formal dish', async () => {
    const result = await dishes.createAdminDish(
      {
        name: '子菜品',
        price: 12,
        windowId: 'window',
        parentUploadId: parent.id,
      } as any,
      creator as any,
    );
    expect(prisma.dishUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentUploadId: parent.id }),
      }),
    );
    expect(result.data.parentUploadId).toBe(parent.id);
    expect(result.data.parentDishId).toBeUndefined();
    expect(result.data).not.toHaveProperty('subDishId');
    expect(result.data).not.toHaveProperty('averageRating');
    expect(result.data).not.toHaveProperty('reviewCount');
  });

  it('rejects mixing formal-dish and pending-upload parent identities', async () => {
    await expect(
      dishes.createAdminDish(
        {
          name: '子菜品',
          price: 12,
          windowId: 'window',
          parentUploadId: parent.id,
          parentDishId: 'formal-parent',
        } as any,
        creator as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dishUpload.create).not.toHaveBeenCalled();
  });

  it('does not let a creator link another creator pending upload', async () => {
    prisma.dishUpload.findUnique.mockResolvedValue({
      ...parent,
      adminId: 'someone-else',
    });
    await expect(
      dishes.createAdminDish(
        {
          name: '子菜品',
          price: 12,
          windowId: 'window',
          parentUploadId: parent.id,
        } as any,
        creator as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not let pending parents cross canteen boundaries', async () => {
    prisma.dishUpload.findUnique.mockResolvedValue({
      ...parent,
      canteenId: 'other',
    });
    await expect(
      dishes.createAdminDish(
        {
          name: '子菜品',
          price: 12,
          windowId: 'window',
          parentUploadId: parent.id,
        } as any,
        creator as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows creators to read their own pending upload without approval permission', async () => {
    const result = await uploads.getUploadById(parent.id, creator);
    expect(result.data.id).toBe(parent.id);
  });

  it('does not expose other creators pending uploads without approval permission', async () => {
    await expect(
      uploads.getUploadById(parent.id, { ...creator, id: 'other-creator' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires the parent upload to be approved before approving a child', async () => {
    await expect(
      uploads.approveUpload(child.id, { role: 'superadmin' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });

  it('resolves the current approved parent dish when approving a pending child', async () => {
    prisma.dishUpload.findUnique.mockImplementation(async ({ where }) =>
      where.id === parent.id
        ? { ...parent, status: 'approved', approvedDishId: 'approved-parent' }
        : child,
    );
    await uploads.approveUpload(child.id, { role: 'superadmin' });
    expect(prisma.$queryRaw.mock.calls.map((call: any[]) => call[1])).toEqual([
      parent.id,
      'approved-parent',
      child.id,
    ]);
    expect(prisma.dish.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentDishId: 'approved-parent' }),
      }),
    );
  });

  it('rejects approval when the approved parent dish has been removed', async () => {
    prisma.dishUpload.findUnique.mockImplementation(async ({ where }) =>
      where.id === parent.id
        ? { ...parent, status: 'approved', approvedDishId: 'removed-parent' }
        : child,
    );
    prisma.dish.findUnique.mockResolvedValue(null);
    await expect(
      uploads.approveUpload(child.id, { role: 'superadmin' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps approved children attached when a parent revoke is requested', async () => {
    prisma.dishUpload.findUnique.mockResolvedValue({
      ...parent,
      status: 'approved',
      approvedDishId: 'approved-parent',
    });
    prisma.dish.findFirst.mockResolvedValue({ id: 'approved-child' });
    await expect(
      uploads.revokeUpload(parent.id, { role: 'superadmin' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.delete).not.toHaveBeenCalled();
  });

  it('preserves every formal-parent upload reference before revoking a parent', async () => {
    prisma.dishUpload.findUnique.mockResolvedValue({
      ...parent,
      status: 'approved',
      approvedDishId: 'approved-parent',
    });
    await uploads.revokeUpload(parent.id, { role: 'superadmin' });
    expect(prisma.dishUpload.updateMany).toHaveBeenCalledWith({
      where: { parentDishId: 'approved-parent' },
      data: { parentDishId: null, parentUploadId: parent.id },
    });
    expect(
      prisma.dishUpload.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.dish.delete.mock.invocationCallOrder[0]);
  });

  it('retains the approval history and only clears the removed dish pointer', async () => {
    await dishes.deleteAdminDish('approved-parent', creator as any);
    expect(prisma.dishUpload.updateMany).toHaveBeenCalledWith({
      where: { approvedDishId: 'approved-parent' },
      data: { approvedDishId: null },
    });
    expect(prisma.dishUpload.deleteMany).not.toHaveBeenCalled();
  });

  it('checks children again after acquiring the deletion lock', async () => {
    prisma.dish.findUnique
      .mockResolvedValueOnce({
        id: 'approved-parent',
        canteenId: 'canteen',
        subDishes: [],
      })
      .mockResolvedValueOnce({
        id: 'approved-parent',
        canteenId: 'canteen',
        subDishes: [{ id: 'newly-approved-child' }],
      });
    await expect(
      dishes.deleteAdminDish('approved-parent', creator as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.delete).not.toHaveBeenCalled();
  });

  it('does not overwrite a concurrently approved upload when rejecting it', async () => {
    let current = { ...parent };
    prisma.dishUpload.findUnique.mockImplementation(async () => current);
    prisma.$queryRaw.mockImplementation(async () => {
      current = {
        ...parent,
        status: 'approved',
        approvedDishId: 'approved-parent',
      } as any;
      return [];
    });
    await expect(
      uploads.rejectUpload(parent.id, '原因', { role: 'superadmin' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dishUpload.update).not.toHaveBeenCalled();
    expect(prisma.dish.delete).not.toHaveBeenCalled();
  });
});
