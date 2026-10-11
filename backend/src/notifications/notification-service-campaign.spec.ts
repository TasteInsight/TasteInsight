import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';

describe('service notification batches and weekly detail', () => {
  let prisma: any;
  let service: NotificationService;
  const cutoff = new Date('2026-10-09T00:00:00Z');
  const campaign: any = {
    type: 'new_dish',
    targetId: 'dish',
    dedupeKey: 'event',
    recipientCutoff: cutoff,
    cursorUserId: 'previous',
  };
  beforeEach(() => {
    prisma = {
      dish: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dish' }),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'user-a' }, { id: 'user-b' }]),
      },
      userSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: {
        createManyAndReturn: jest.fn().mockResolvedValue([{ id: 'inserted' }]),
      },
      notificationOutbox: { createMany: jest.fn() },
      weeklyRecommendationCollection: {
        findUnique: jest.fn().mockResolvedValue({
          weekKey: '2026-10-05',
          dishIds: ['dish-b', 'hidden', 'dish-a'],
          publishedAt: cutoff,
        }),
      },
    };
    service = new NotificationService(prisma, new ConfigService());
  });

  it('selects one stable bounded page of eligible users who existed at the event', async () => {
    const result = await service.createServiceBatch(prisma, campaign, 2);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lte: cutoff },
        id: { gt: 'previous' },
        OR: [
          { settings: { is: null } },
          { settings: { is: { newDishAlert: true } } },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
    expect(result).toEqual({
      unavailable: false,
      complete: false,
      cursorUserId: 'user-b',
    });
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: ['user-a', 'user-b'].map((userId) => ({
        id: expect.any(String),
        userId,
        actorId: null,
        type: 'new_dish',
        targetType: 'dish',
        targetId: 'dish',
        dedupeKey: `event:${userId}`,
        createdAt: cutoff,
      })),
      select: { id: true },
      skipDuplicates: true,
    });
    expect(prisma.notificationOutbox.createMany).not.toHaveBeenCalled();
  });

  it('requires price opt-in and a favorite already present at the event', async () => {
    await service.createServiceBatch(
      prisma,
      { ...campaign, type: 'price_change' },
      100,
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          settings: { is: { priceChangeAlert: true } },
          favoriteDishes: {
            some: { dishId: 'dish', addedAt: { lte: cutoff } },
          },
        }),
      }),
    );
  });

  it('creates webhook jobs only for newly inserted notification ids', async () => {
    service = new NotificationService(
      prisma,
      new ConfigService({
        NOTIFICATION_WEBHOOK_URL: 'https://hooks.example.test/events',
      }),
    );
    await service.createServiceBatch(prisma, campaign, 100);
    expect(prisma.notificationOutbox.createMany).toHaveBeenCalledWith({
      data: [{ notificationId: 'inserted' }],
    });
    prisma.notification.createManyAndReturn.mockResolvedValue([]);
    await service.createServiceBatch(prisma, campaign, 100);
    expect(prisma.notificationOutbox.createMany).toHaveBeenCalledTimes(1);
  });

  it('cancels a hidden target before selecting recipients or creating notifications', async () => {
    prisma.dish.findFirst.mockResolvedValue(null);
    expect(await service.createServiceBatch(prisma, campaign, 100)).toEqual({
      unavailable: true,
      complete: true,
      cursorUserId: 'previous',
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rechecks that a saved weekly collection has a currently visible dish', async () => {
    const event = {
      userId: 'user',
      type: 'weekly_recommendation',
      targetType: 'week_collection',
      targetId: '2026-10-05',
    };
    expect(await service.canDeliver(prisma, event)).toBe(true);
    prisma.dish.findFirst.mockResolvedValue(null);
    expect(await service.canDeliver(prisma, event)).toBe(false);
  });

  it('returns stored order and current visible dish DTOs without recording exposures', async () => {
    const dish = (id: string) => ({
      id,
      name: id,
      price: 12,
      status: 'online',
      canteen: { name: 'current canteen' },
      window: null,
      floor: null,
      parentDish: { status: 'offline' },
      parentDishId: 'hidden-parent',
      subDishes: [],
      createdAt: cutoff,
      updatedAt: cutoff,
    });
    prisma.dish.findMany.mockResolvedValue([dish('dish-a'), dish('dish-b')]);
    const response = await service.getWeeklyCollection('2026-10-05');
    expect(response.data.items.map((item) => item.id)).toEqual([
      'dish-b',
      'dish-a',
    ]);
    expect(response.data.items[0]).toMatchObject({
      canteenName: 'current canteen',
      parentDishId: null,
    });
    expect(response.data.publishedAt).toBe(cutoff.toISOString());
    expect(prisma.dish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['dish-b', 'hidden', 'dish-a'] }, status: 'online' },
      }),
    );
  });

  it.each(['bad-key', '2026-10-06', '2026-02-30'])(
    'rejects an invalid Monday key: %s',
    async (key) => {
      await expect(service.getWeeklyCollection(key)).rejects.toThrow(
        '推荐周标识无效',
      );
      expect(
        prisma.weeklyRecommendationCollection.findUnique,
      ).not.toHaveBeenCalled();
    },
  );

  it('returns not found when a valid week was never published', async () => {
    prisma.weeklyRecommendationCollection.findUnique.mockResolvedValue(null);
    await expect(service.getWeeklyCollection('2026-10-05')).rejects.toThrow(
      '本周推荐不存在',
    );
  });
});
