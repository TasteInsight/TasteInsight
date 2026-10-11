import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { AdminUploadsService } from '@/admin-uploads/admin-uploads.service';
import { DishStatus } from '@/admin-dishes/dto/admin-dish.dto';
import { NotificationService } from '@/notifications/notification.service';
import { NotificationCampaignService } from '@/notifications/notification-campaign.service';
import { enqueueDishNotifications } from '@/notifications/notification-events';
import { campusWeekKey } from '@/notifications/weekly-recommendation';

describe('service notifications (PostgreSQL)', () => {
  jest.setTimeout(20000);
  const prefix = `service-notifications-${randomUUID()}`;
  const userIds: string[] = [];
  const dishIds: string[] = [];
  const weekKeys: string[] = [];
  const oldDate = new Date('2000-01-01T00:00:00Z');
  let prisma: PrismaService;
  let other: PrismaService;
  let notifications: NotificationService;
  let worker: NotificationCampaignService;
  let canteenId: string;
  let windowId: string;
  let adminId: string;
  const config = new ConfigService({ NODE_ENV: 'test' });

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL) {
      throw new Error('An explicit test database is required');
    }
    prisma = new PrismaService();
    const otherUrl = new URL(process.env.DATABASE_URL);
    otherUrl.searchParams.set('connection_limit', '1');
    other = new PrismaService({
      datasources: { db: { url: otherUrl.toString() } },
    });
    await Promise.all([prisma.$connect(), other.$connect()]);
    const canteen = await prisma.canteen.create({
      data: { name: prefix, images: [], openingHours: [] },
    });
    canteenId = canteen.id;
    windowId = (
      await prisma.window.create({
        data: { name: prefix, number: '1', canteenId },
      })
    ).id;
    adminId = (
      await prisma.admin.create({
        data: { username: prefix, password: 'test-only-unused-hash' },
      })
    ).id;
    notifications = new NotificationService(prisma, config);
    worker = new NotificationCampaignService(prisma, notifications, config);
    const anchor = await createDish('weekly-anchor');
    const weekKey = campusWeekKey(new Date());
    const created = await prisma.weeklyRecommendationCollection.createMany({
      data: [{ weekKey, dishIds: [anchor.id] }],
      skipDuplicates: true,
    });
    if (created.count) weekKeys.push(weekKey);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    worker?.onModuleDestroy();
    if (prisma) {
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            { targetType: 'dish', targetId: { in: dishIds } },
            { targetType: 'week_collection', targetId: { in: weekKeys } },
          ],
        },
      });
      await prisma.notificationCampaign.deleteMany({
        where: { targetId: { in: [...dishIds, ...weekKeys] } },
      });
      await prisma.weeklyRecommendationCollection.deleteMany({
        where: { weekKey: { in: weekKeys } },
      });
      if (canteenId) await prisma.canteen.delete({ where: { id: canteenId } });
      if (adminId) await prisma.admin.delete({ where: { id: adminId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await Promise.all(
      [prisma, other].filter(Boolean).map((db) => db.$disconnect()),
    );
  });

  async function createUsers(
    count: number,
    settings = {
      newDishAlert: false,
      priceChangeAlert: false,
      weeklyRecommendation: false,
    },
  ) {
    const ids = Array.from(
      { length: count },
      (_, index) =>
        `${prefix}-user-${String(userIds.length + index).padStart(4, '0')}`,
    );
    userIds.push(...ids);
    await prisma.user.createMany({
      data: ids.map((id) => ({ id, nickname: prefix, createdAt: oldDate })),
    });
    await prisma.userSetting.createMany({
      data: ids.map((userId) => ({ userId, ...settings })),
    });
    return ids;
  }

  async function createDish(name: string, status = 'online') {
    const dish = await prisma.dish.create({
      data: {
        name: `${prefix}-${name}`,
        price: 10,
        tags: [],
        images: [],
        ingredients: [],
        allergens: [],
        canteenId,
        canteenName: prefix,
        windowId,
        windowName: prefix,
        availableMealTime: [],
        status,
      },
    });
    dishIds.push(dish.id);
    return dish;
  }

  async function prioritize(targetId: string) {
    await prisma.notificationCampaign.updateMany({
      where: { targetId, status: 'pending' },
      data: { nextAttemptAt: new Date(0) },
    });
  }

  const admin = () => ({
    id: adminId,
    username: prefix,
    role: 'superadmin',
    canteenId: null,
    permissions: [],
  });

  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  async function waitForLock(pid: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [row] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ${pid} AND wait_event_type = 'Lock') AS waiting
      `;
      if (row.waiting) return true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return false;
  }

  it('keeps pending uploads silent and commits one publication event with approval', async () => {
    const [recipient] = await createUsers(1, {
      newDishAlert: true,
      priceChangeAlert: false,
      weeklyRecommendation: false,
    });
    const manage = new AdminDishesService(prisma);
    const approve = new AdminUploadsService(prisma);
    const before = await prisma.notificationCampaign.count();
    const upload = await manage.createAdminDish(
      { name: `${prefix}-approval`, price: 12, windowId } as any,
      admin(),
    );
    expect(await prisma.notificationCampaign.count()).toBe(before);
    await approve.approveUpload(upload.data.id, admin());
    const published = await prisma.dishUpload.findUniqueOrThrow({
      where: { id: upload.data.id },
    });
    const dishId = published.approvedDishId!;
    dishIds.push(dishId);
    expect(
      await prisma.notificationCampaign.count({
        where: { type: 'new_dish', targetId: dishId },
      }),
    ).toBe(1);
    await expect(
      approve.approveUpload(upload.data.id, admin()),
    ).rejects.toThrow('该上传已被处理');
    await prioritize(dishId);
    await worker.tick();
    expect(
      await prisma.notification.count({
        where: { userId: recipient, type: 'new_dish', targetId: dishId },
      }),
    ).toBe(1);
  });

  it('rolls the source event back with the dish write and ignores same-price writes', async () => {
    const dish = await createDish('rollback-source');
    await expect(
      prisma.$transaction(async (tx) => {
        const changed = await tx.dish.update({
          where: { id: dish.id },
          data: { price: 20 },
        });
        await enqueueDishNotifications(tx, changed, dish);
        throw new Error('abort source transaction');
      }),
    ).rejects.toThrow('abort source transaction');
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: dish.id } })).price,
    ).toBe(10);
    expect(
      await prisma.notificationCampaign.count({ where: { targetId: dish.id } }),
    ).toBe(0);
    const manage = new AdminDishesService(prisma);
    await manage.updateAdminDish(dish.id, { price: 20 }, admin());
    await manage.updateAdminDish(dish.id, { price: 20 }, admin());
    expect(
      await prisma.notificationCampaign.count({
        where: { targetId: dish.id, type: 'price_change' },
      }),
    ).toBe(1);
  });

  it('bounds fanout, resumes an expired lease, and deduplicates competing workers', async () => {
    const eligible = await createUsers(103, {
      newDishAlert: true,
      priceChangeAlert: false,
      weeklyRecommendation: false,
    });
    const [disabled, late] = await createUsers(2);
    const dish = await createDish('bounded');
    await prisma.$transaction((tx) => enqueueDishNotifications(tx, dish));
    const event = await prisma.notificationCampaign.findUniqueOrThrow({
      where: { dedupeKey: `new_dish:${dish.id}` },
    });
    await prisma.user.update({
      where: { id: late },
      data: {
        createdAt: new Date(event.recipientCutoff.getTime() + 1000),
        settings: { update: { newDishAlert: true } },
      },
    });
    await prioritize(dish.id);
    await worker.tick();
    expect(
      await prisma.notification.count({ where: { targetId: dish.id } }),
    ).toBe(100);
    const pageOne = await prisma.notificationCampaign.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(pageOne.status).toBe('pending');
    expect(pageOne.cursorUserId).not.toBeNull();
    await prisma.notificationCampaign.update({
      where: { id: event.id },
      data: {
        status: 'processing',
        lockedUntil: new Date(0),
        leaseToken: 'abandoned-worker',
        nextAttemptAt: new Date(0),
      },
    });
    const competing = new NotificationCampaignService(
      other,
      new NotificationService(other, config),
      config,
    );
    await Promise.all([worker.tick(), competing.tick()]);
    const maximumBatches = Math.floor((await prisma.user.count()) / 100) + 1;
    for (let round = 0; round < maximumBatches; round++) {
      if (
        (
          await prisma.notificationCampaign.findUniqueOrThrow({
            where: { id: event.id },
          })
        ).status === 'completed'
      )
        break;
      await prioritize(dish.id);
      await worker.tick();
    }
    expect(
      (
        await prisma.notificationCampaign.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).status,
    ).toBe('completed');
    const received = await prisma.notification.findMany({
      where: { targetId: dish.id },
    });
    expect(
      received.filter((notice) => eligible.includes(notice.userId)),
    ).toHaveLength(103);
    expect(
      received.some((notice) => [disabled, late].includes(notice.userId)),
    ).toBe(false);
    expect(new Set(received.map((notice) => notice.userId)).size).toBe(
      received.length,
    );
    const count = received.length;
    await Promise.all([worker.tick(), competing.tick()]);
    expect(
      await prisma.notification.count({ where: { targetId: dish.id } }),
    ).toBe(count);
  });

  it('rolls inbox, webhook jobs, and cursor back together before a durable retry', async () => {
    const [recipient] = await createUsers(1, {
      newDishAlert: true,
      priceChangeAlert: false,
      weeklyRecommendation: false,
    });
    const dish = await createDish('rollback-batch');
    await prisma.$transaction((tx) => enqueueDishNotifications(tx, dish));
    await prioritize(dish.id);
    const externalConfig = new ConfigService({
      NODE_ENV: 'test',
      NOTIFICATION_WEBHOOK_URL: 'https://hooks.example.test/events',
      NOTIFICATION_WEBHOOK_SECRET: 's'.repeat(32),
    });
    const externalNotifications = new NotificationService(
      prisma,
      externalConfig,
    );
    const retryWorker = new NotificationCampaignService(
      prisma,
      externalNotifications,
      externalConfig,
    );
    const insertBatch = externalNotifications.createServiceBatch.bind(
      externalNotifications,
    );
    jest
      .spyOn(externalNotifications, 'createServiceBatch')
      .mockImplementationOnce(async (tx, campaign, take) => {
        await insertBatch(tx, campaign, take);
        throw new Error('failure after inserting inbox and outbox');
      });
    jest
      .spyOn((retryWorker as any).logger, 'warn')
      .mockImplementation(() => undefined);
    await retryWorker.tick();
    const failed = await prisma.notificationCampaign.findUniqueOrThrow({
      where: { dedupeKey: `new_dish:${dish.id}` },
    });
    expect(failed).toMatchObject({
      status: 'pending',
      attempts: 1,
      cursorUserId: null,
      lastError: 'batch_failed',
    });
    expect(failed.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(
      await prisma.notification.count({ where: { targetId: dish.id } }),
    ).toBe(0);
    expect(
      await prisma.notificationOutbox.count({
        where: { notification: { targetId: dish.id } },
      }),
    ).toBe(0);
    const maximumBatches = Math.floor((await prisma.user.count()) / 100) + 1;
    for (let round = 0; round < maximumBatches; round++) {
      await prioritize(dish.id);
      await retryWorker.tick();
      if (
        (
          await prisma.notificationCampaign.findUniqueOrThrow({
            where: { id: failed.id },
          })
        ).status === 'completed'
      )
        break;
    }
    expect(
      (
        await prisma.notificationCampaign.findUniqueOrThrow({
          where: { id: failed.id },
        })
      ).status,
    ).toBe('completed');
    expect(
      await prisma.notification.count({
        where: { targetId: dish.id, userId: recipient },
      }),
    ).toBe(1);
    const inboxCount = await prisma.notification.count({
      where: { targetId: dish.id },
    });
    expect(
      await prisma.notificationOutbox.count({
        where: { notification: { targetId: dish.id } },
      }),
    ).toBe(inboxCount);
  });

  it('sends price changes only to opted-in current favorites present before the event', async () => {
    const [yes, noFavorite, lateFavorite, lateUser] = await createUsers(4, {
      newDishAlert: false,
      priceChangeAlert: true,
      weeklyRecommendation: false,
    });
    const [disabled] = await createUsers(1);
    const dish = await createDish('price-eligibility');
    await prisma.favoriteDish.createMany({
      data: [yes, disabled].map((userId) => ({
        userId,
        dishId: dish.id,
        addedAt: oldDate,
      })),
    });
    await new AdminDishesService(prisma).updateAdminDish(
      dish.id,
      { price: 15 },
      admin(),
    );
    const event = await prisma.notificationCampaign.findFirstOrThrow({
      where: { type: 'price_change', targetId: dish.id },
    });
    const later = new Date(event.recipientCutoff.getTime() + 1000);
    await prisma.favoriteDish.createMany({
      data: [lateFavorite, lateUser].map((userId) => ({
        userId,
        dishId: dish.id,
        addedAt: later,
      })),
    });
    await prisma.user.update({
      where: { id: lateUser },
      data: { createdAt: later },
    });
    await prioritize(dish.id);
    await worker.tick();
    const received = await prisma.notification.findMany({
      where: { targetId: dish.id },
    });
    expect(received.map((notice) => notice.userId)).toEqual([yes]);
    expect(
      received.some((notice) =>
        [noFavorite, lateFavorite, lateUser, disabled].includes(notice.userId),
      ),
    ).toBe(false);
    expect(await notifications.canDeliver(prisma, received[0])).toBe(true);
    await prisma.favoriteDish.delete({
      where: { userId_dishId: { userId: yes, dishId: dish.id } },
    });
    expect(await notifications.canDeliver(prisma, received[0])).toBe(false);
  });

  it('withdraws a fanout batch committed while the offline transaction waits for its campaign lock', async () => {
    await createUsers(1, {
      newDishAlert: true,
      priceChangeAlert: false,
      weeklyRecommendation: false,
    });
    const dish = await createDish('offline-race');
    await prisma.$transaction((tx) => enqueueDishNotifications(tx, dish));
    await prioritize(dish.id);
    const entered = deferred();
    const release = deferred();
    const external = new ConfigService({
      NODE_ENV: 'test',
      NOTIFICATION_WEBHOOK_URL: 'https://hooks.example.test/events',
      NOTIFICATION_WEBHOOK_SECRET: 's'.repeat(32),
    });
    const service = new NotificationService(prisma, external);
    const insert = service.createServiceBatch.bind(service);
    jest
      .spyOn(service, 'createServiceBatch')
      .mockImplementation(async (tx, campaign, take) => {
        const result = await insert(tx, campaign, take);
        if (campaign.targetId === dish.id) {
          entered.resolve();
          await release.promise;
        }
        return result;
      });
    const [{ pid }] = await other.$queryRaw<
      Array<{ pid: number }>
    >`SELECT pg_backend_pid() AS pid`;
    const fanout = new NotificationCampaignService(
      prisma,
      service,
      external,
    ).tick();
    await entered.promise;
    const offline = new AdminDishesService(other).updateDishStatus(
      dish.id,
      DishStatus.OFFLINE,
      admin(),
    );
    try {
      expect(await waitForLock(pid)).toBe(true);
    } finally {
      release.resolve();
      await Promise.all([fanout, offline]);
    }
    const notices = await prisma.notification.findMany({
      where: { targetId: dish.id },
      include: { outbox: true },
    });
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.every((notice) => notice.withdrawnAt !== null)).toBe(true);
    expect(
      notices.every((notice) => notice.outbox?.status === 'cancelled'),
    ).toBe(true);
    expect(
      (
        await prisma.notificationCampaign.findUniqueOrThrow({
          where: { dedupeKey: `new_dish:${dish.id}` },
        })
      ).status,
    ).toBe('cancelled');
  });

  it('withdraws an interaction committed while deletion waits for its root review lock', async () => {
    const [recipient, actor] = await createUsers(2);
    const dish = await createDish('delete-interaction-race');
    const review = await prisma.review.create({
      data: {
        userId: recipient,
        dishId: dish.id,
        rating: 5,
        images: [],
        status: 'approved',
      },
    });
    const entered = deferred();
    const release = deferred();
    const external = new ConfigService({
      NODE_ENV: 'test',
      NOTIFICATION_WEBHOOK_URL: 'https://hooks.example.test/events',
      NOTIFICATION_WEBHOOK_SECRET: 's'.repeat(32),
    });
    const service = new NotificationService(prisma, external);
    const interaction = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM reviews WHERE id = ${review.id} FOR UPDATE`;
        await service.create(tx, {
          userId: recipient,
          actorId: actor,
          type: 'like',
          targetType: 'review',
          targetId: review.id,
          dedupeKey: `${prefix}-deletion-race`,
        });
        entered.resolve();
        await release.promise;
      },
      { timeout: 15000 },
    );
    await entered.promise;
    const [{ pid }] = await other.$queryRaw<
      Array<{ pid: number }>
    >`SELECT pg_backend_pid() AS pid`;
    const deletion = new AdminDishesService(other).deleteAdminDish(
      dish.id,
      admin(),
    );
    try {
      expect(await waitForLock(pid)).toBe(true);
    } finally {
      release.resolve();
      await Promise.all([interaction, deletion]);
    }
    const notice = await prisma.notification.findUniqueOrThrow({
      where: { dedupeKey: `${prefix}-deletion-race` },
      include: { outbox: true },
    });
    expect(notice.withdrawnAt).not.toBeNull();
    expect(notice.outbox?.status).toBe('cancelled');
    expect(await prisma.dish.findUnique({ where: { id: dish.id } })).toBeNull();
  });

  it('ranks actual approved recent reviews once per campus week and filters hidden detail', async () => {
    const rankingNow = new Date(
      `${2200 + Math.floor(Math.random() * 700)}-06-12T12:00:00Z`,
    );
    const weekKey = campusWeekKey(rankingNow);
    expect(
      await prisma.weeklyRecommendationCollection.findUnique({
        where: { weekKey },
      }),
    ).toBeNull();
    weekKeys.push(weekKey);
    const [hot, fallback, hidden, unapproved] = await Promise.all([
      createDish('hot'),
      createDish('fallback'),
      createDish('hidden', 'offline'),
      createDish('unapproved'),
    ]);
    const reviewers = await createUsers(60);
    const reviewRows = [
      ...reviewers.slice(0, 40).map((userId) => ({
        userId,
        dishId: hot.id,
        status: 'approved',
        createdAt: rankingNow,
        rating: 4,
      })),
      ...reviewers.slice(0, 50).map((userId) => ({
        userId,
        dishId: fallback.id,
        status: 'approved',
        createdAt: oldDate,
        rating: 5,
      })),
      ...reviewers.map((userId) => ({
        userId,
        dishId: hidden.id,
        status: 'approved',
        createdAt: rankingNow,
        rating: 5,
      })),
      ...reviewers.map((userId) => ({
        userId,
        dishId: unapproved.id,
        status: 'pending',
        createdAt: rankingNow,
        rating: 5,
      })),
    ];
    await prisma.review.createMany({
      data: reviewRows.map((review) => ({ ...review, images: [] })),
    });
    await Promise.all([
      worker.tick(rankingNow),
      new NotificationCampaignService(
        other,
        new NotificationService(other, config),
        config,
      ).tick(rankingNow),
    ]);
    const collection =
      await prisma.weeklyRecommendationCollection.findUniqueOrThrow({
        where: { weekKey },
      });
    expect(collection.dishIds[0]).toBe(hot.id);
    expect(collection.dishIds[1]).toBe(fallback.id);
    expect(collection.dishIds).not.toContain(hidden.id);
    expect(collection.dishIds).toHaveLength(8);
    expect(
      await prisma.notificationCampaign.count({
        where: { type: 'weekly_recommendation', targetId: weekKey },
      }),
    ).toBe(1);
    const originalIds = [...collection.dishIds];
    await prisma.dish.update({
      where: { id: hot.id },
      data: { status: 'offline' },
    });
    await worker.tick(rankingNow);
    expect(
      (
        await prisma.weeklyRecommendationCollection.findUniqueOrThrow({
          where: { weekKey },
        })
      ).dishIds,
    ).toEqual(originalIds);
    const historyCount = await prisma.browseHistory.count({
      where: { dishId: { in: originalIds } },
    });
    const detail = await notifications.getWeeklyCollection(weekKey);
    expect(detail.data.items.map((dish) => dish.id)).toEqual(
      originalIds.filter((id) => id !== hot.id),
    );
    expect(detail.data.publishedAt).toBe(rankingNow.toISOString());
    expect(
      await prisma.browseHistory.count({
        where: { dishId: { in: originalIds } },
      }),
    ).toBe(historyCount);
  });
});
