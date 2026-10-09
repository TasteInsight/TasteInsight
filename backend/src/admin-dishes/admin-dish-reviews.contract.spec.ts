import { ForbiddenException } from '@nestjs/common';
import { AdminDishesService } from './admin-dishes.service';
import { AdminDishesController } from './admin-dishes.controller';

describe('admin dish review contract', () => {
  const admin = { id: 'a1', canteenId: 'c1', role: 'admin' };
  const user = { id: 'u1', nickname: '作者', avatar: 'avatar.jpg' };
  let prisma: any;
  let service: AdminDishesService;

  beforeEach(() => {
    prisma = {
      dish: {
        findUnique: jest.fn().mockResolvedValue({ id: 'd1', canteenId: 'c1' }),
      },
      review: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            dishId: 'd1',
            userId: 'u1',
            user,
            rating: 1,
            spicyLevel: 0,
            sweetness: 0,
            saltiness: 0,
            oiliness: 0,
            content: '待审',
            images: [],
            status: 'pending',
            rejectReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            _count: { comments: 0 },
          },
        ]),
        groupBy: jest.fn().mockResolvedValue([
          { rating: 4, _count: { _all: 1 } },
          { rating: 5, _count: { _all: 2 } },
        ]),
      },
    };
    service = new AdminDishesService(prisma);
  });

  it('filters rows and pagination count by the requested moderation status', async () => {
    await (service.getDishReviews as any)('d1', 2, 10, admin, 'pending');
    const where = { dishId: 'd1', deletedAt: null, status: 'pending' };
    expect(prisma.review.count).toHaveBeenCalledWith({ where });
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 10,
        take: 10,
      }),
    );
  });

  it('returns approved-only rating statistics independently of the moderation filter', async () => {
    const result = await (service.getDishReviews as any)(
      'd1',
      1,
      10,
      admin,
      'pending',
    );
    expect(prisma.review.groupBy).toHaveBeenCalledWith({
      by: ['rating'],
      where: { dishId: 'd1', deletedAt: null, status: 'approved' },
      _count: { _all: true },
    });
    expect(result.data.rating).toEqual({
      average: 14 / 3,
      total: 3,
      detail: { '4': 1, '5': 2 },
    });
    expect(result.data.items[0]).toMatchObject({
      userNickname: '作者',
      userAvatar: 'avatar.jpg',
      ratingDetails: { spicyLevel: 0, sweetness: 0, saltiness: 0, oiliness: 0 },
    });
    expect(result.data.items[0]).not.toHaveProperty('user');
  });

  it('returns zero statistics when no approved ratings exist', async () => {
    prisma.review.groupBy.mockResolvedValue([]);
    const result = await service.getDishReviews('d1', 1, 10, admin as any);
    expect((result.data as any).rating).toEqual({
      average: 0,
      total: 0,
      detail: {},
    });
  });

  it('does not query another canteen review rows or statistics', async () => {
    await expect(
      service.getDishReviews('d1', 1, 10, { ...admin, canteenId: 'c2' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
    expect(prisma.review.groupBy).not.toHaveBeenCalled();
  });

  it('passes the validated query status from controller to service', async () => {
    const getDishReviews = jest.fn().mockResolvedValue({ code: 200 });
    const controller = new AdminDishesController({ getDishReviews } as any);
    await (controller.getDishReviews as any)(
      'd1',
      { page: 2, pageSize: 10, status: 'rejected' },
      admin,
    );
    expect(getDishReviews).toHaveBeenCalledWith('d1', 2, 10, admin, 'rejected');
  });
});
