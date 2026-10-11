import { NotificationCampaignService } from './notification-campaign.service';
import { campusWeekKey } from './weekly-recommendation';

describe('campus weekly calendar', () => {
  it.each([
    ['2026-10-04T15:59:59Z', '2026-09-28'],
    ['2026-10-04T16:00:00Z', '2026-10-05'],
    ['2026-10-09T12:00:00Z', '2026-10-05'],
    ['2026-01-01T00:00:00Z', '2025-12-29'],
  ])('maps %s to the Shanghai Monday %s', (now, weekKey) => {
    expect(campusWeekKey(new Date(now))).toBe(weekKey);
  });
});

describe('persistent notification campaigns', () => {
  let prisma: any;
  let notifications: any;
  let worker: NotificationCampaignService;
  const row = {
    id: 'campaign',
    type: 'new_dish',
    targetId: 'dish',
    dedupeKey: 'new_dish:dish',
    cursorUserId: null,
    attempts: 0,
    updatedAt: new Date(0),
  };
  beforeEach(() => {
    prisma = {
      weeklyRecommendationCollection: {
        findUnique: jest.fn().mockResolvedValue({ weekKey: '2026-10-05' }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notificationCampaign: {
        findMany: jest.fn().mockResolvedValue([row]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'popular' }, { id: 'fallback' }]),
    };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    notifications = {
      createServiceBatch: jest.fn().mockResolvedValue({
        unavailable: false,
        complete: false,
        cursorUserId: 'user-100',
      }),
    };
    worker = new NotificationCampaignService(prisma, notifications, {
      get: jest.fn().mockReturnValue('test'),
    } as any);
  });
  afterEach(() => worker.onModuleDestroy());

  it('does not create timers in tests', () => {
    const interval = jest.spyOn(global, 'setInterval');
    worker.onModuleInit();
    expect(interval).not.toHaveBeenCalled();
    interval.mockRestore();
  });

  it('bounds each tick and atomically advances only its owned recipient batch', async () => {
    await worker.tick();
    expect(prisma.notificationCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(notifications.createServiceBatch).toHaveBeenCalledWith(
      prisma,
      row,
      100,
    );
    const claim = prisma.notificationCampaign.updateMany.mock.calls[0][0];
    const hold = prisma.notificationCampaign.updateMany.mock.calls[1][0];
    const finish = prisma.notificationCampaign.updateMany.mock.calls[2][0];
    expect(claim.where.updatedAt).toBe(row.updatedAt);
    expect(hold.where).toMatchObject({ leaseToken: claim.data.leaseToken });
    expect(finish).toMatchObject({
      where: { leaseToken: claim.data.leaseToken },
      data: { status: 'pending', cursorUserId: 'user-100', leaseToken: null },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 15000,
    });
  });

  it.each([0, 1])(
    'does not expand when lease ownership is lost at step %s',
    async (step) => {
      if (step === 1)
        prisma.notificationCampaign.updateMany.mockResolvedValueOnce({
          count: 1,
        });
      prisma.notificationCampaign.updateMany.mockResolvedValueOnce({
        count: 0,
      });
      await worker.tick();
      expect(notifications.createServiceBatch).not.toHaveBeenCalled();
    },
  );

  it('keeps the old cursor and schedules bounded backoff after a failed batch', async () => {
    notifications.createServiceBatch.mockRejectedValue(
      new Error('database unavailable'),
    );
    const warn = jest
      .spyOn((worker as any).logger, 'warn')
      .mockImplementation(() => undefined);
    await worker.tick();
    const failure = prisma.notificationCampaign.updateMany.mock.calls.at(-1)[0];
    expect(failure.data).toMatchObject({
      status: 'pending',
      attempts: { increment: 1 },
      lastError: 'batch_failed',
    });
    expect(failure.data).not.toHaveProperty('cursorUserId');
    expect(failure.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    warn.mockRestore();
  });

  it.each([
    [false, 'completed'],
    [true, 'cancelled'],
  ])(
    'finishes a terminal batch (unavailable: %s)',
    async (unavailable, status) => {
      notifications.createServiceBatch.mockResolvedValue({
        unavailable,
        complete: true,
        cursorUserId: 'last',
      });
      await worker.tick();
      expect(prisma.notificationCampaign.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status, lockedUntil: null }),
        }),
      );
    },
  );

  it('publishes the current collection and campaign in one transaction', async () => {
    prisma.weeklyRecommendationCollection.findUnique.mockResolvedValue(null);
    const now = new Date('2026-10-09T12:00:00Z');
    await worker.tick(now);
    expect(
      prisma.weeklyRecommendationCollection.createMany,
    ).toHaveBeenCalledWith({
      data: [
        {
          weekKey: '2026-10-05',
          dishIds: ['popular', 'fallback'],
          publishedAt: now,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.notificationCampaign.create).toHaveBeenCalledWith({
      data: {
        type: 'weekly_recommendation',
        targetId: '2026-10-05',
        dedupeKey: 'weekly_recommendation:2026-10-05',
        recipientCutoff: now,
      },
    });
  });

  it('lets only the unique collection insert create a weekly campaign', async () => {
    prisma.weeklyRecommendationCollection.findUnique.mockResolvedValue(null);
    prisma.weeklyRecommendationCollection.createMany.mockResolvedValue({
      count: 0,
    });
    await worker.tick();
    expect(prisma.notificationCampaign.create).not.toHaveBeenCalled();
  });

  it('does not publish an empty recommendation collection', async () => {
    prisma.weeklyRecommendationCollection.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([]);
    await worker.tick();
    expect(
      prisma.weeklyRecommendationCollection.createMany,
    ).not.toHaveBeenCalled();
    expect(prisma.notificationCampaign.create).not.toHaveBeenCalled();
  });
});
