import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { AdminUploadsService } from './admin-uploads.service';

describe('Upload ownership after a formal dish moves', () => {
  const globalAdmin = {
    id: 'global',
    username: 'global',
    role: 'superadmin',
    canteenId: null,
    permissions: [],
  };
  const fixture = (hasChild = false, dishCanteen = 'b') => {
    const source = {
      id: 'source',
      canteenId: 'a',
      approvedDishId: 'dish',
      status: 'approved',
    };
    const dish = { id: 'dish', canteenId: dishCanteen, subDishes: [] };
    const child = hasChild
      ? {
          id: 'child',
          canteenId: dishCanteen,
          parentDishId: 'dish',
          parentUploadId: null,
        }
      : null;
    const prisma: any = {
      dishUpload: {
        findUnique: jest.fn(async () => ({ ...source })),
        findFirst: jest.fn(async ({ where }) => {
          if (where.approvedDishId === dish.id) return { ...source };
          if (
            where.parentDishId === dish.id &&
            child &&
            (!where.canteenId || child.canteenId !== where.canteenId.not)
          )
            return { ...child };
          return null;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(async ({ data }) => Object.assign(source, data)),
      },
      dish: {
        findUnique: jest.fn(async () => ({ ...dish })),
        findFirst: jest.fn(async () => null),
        delete: jest.fn(async () => dish),
      },
      $queryRaw: jest.fn(async () => []),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    return {
      source,
      child,
      prisma,
      manage: new AdminDishesService(prisma),
      review: new AdminUploadsService(prisma),
    };
  };

  it('denies source-canteen reviewers authority over a dish now in another canteen', async () => {
    const { review, prisma } = fixture();
    await expect(
      review.revokeUpload('source', {
        ...globalAdmin,
        role: 'admin',
        canteenId: 'a',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dish.delete).not.toHaveBeenCalled();
    expect(prisma.dishUpload.updateMany).not.toHaveBeenCalled();
    expect(prisma.dishUpload.update).not.toHaveBeenCalled();
  });

  it('lets global reviewers revoke a moved dish without rewriting historical ownership', async () => {
    const { review, source, prisma } = fixture();
    await review.revokeUpload('source', globalAdmin);
    expect(source).toMatchObject({
      canteenId: 'a',
      status: 'pending',
      approvedDishId: null,
    });
    expect(prisma.dish.delete).toHaveBeenCalledWith({ where: { id: 'dish' } });
  });

  it.each(['revoke', 'delete'])(
    '%s does not convert a destination-canteen child to a source-canteen parent upload',
    async (operation) => {
      const { review, manage, prisma } = fixture(true);
      await expect(
        operation === 'revoke'
          ? review.revokeUpload('source', globalAdmin)
          : manage.deleteAdminDish('dish', globalAdmin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dish.delete).not.toHaveBeenCalled();
      expect(prisma.dishUpload.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['revoke', 'delete'])(
    '%s retains valid same-canteen child upload relationships',
    async (operation) => {
      const { review, manage, prisma } = fixture(true, 'a');
      if (operation === 'revoke')
        await review.revokeUpload('source', globalAdmin);
      else await manage.deleteAdminDish('dish', globalAdmin);
      expect(prisma.dishUpload.updateMany).toHaveBeenCalledWith({
        where: { parentDishId: 'dish' },
        data: { parentDishId: null, parentUploadId: 'source' },
      });
      expect(prisma.dish.delete).toHaveBeenCalled();
    },
  );
});
