import { NotificationCampaignService } from './notification-campaign.service';
import { NotificationDispatcher } from './notification-dispatcher.service';

describe('notification worker shutdown', () => {
  it('drains the current dispatch and does not claim more rows after shutdown', async () => {
    let finishRead!: (value: unknown[]) => void;
    const prisma = {
      notificationOutbox: {
        findMany: jest.fn(
          () => new Promise((resolve) => (finishRead = resolve)),
        ),
      },
    };
    const dispatcher = new NotificationDispatcher(
      prisma as any,
      { webhookUrl: () => 'https://hooks.example.test/notify' } as any,
      {
        get: (key: string) =>
          key === 'NOTIFICATION_WEBHOOK_SECRET' ? 's'.repeat(32) : undefined,
      } as any,
    );
    const dispatch = dispatcher.dispatchDue();
    let closed = false;
    const shutdown = Promise.resolve(dispatcher.onModuleDestroy()).then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    finishRead([]);
    await Promise.all([dispatch, shutdown]);
    await dispatcher.dispatchDue();
    expect(prisma.notificationOutbox.findMany).toHaveBeenCalledTimes(1);
  });

  it('drains the current campaign tick before its dependencies disconnect', async () => {
    let finishRead!: (value: unknown[]) => void;
    const prisma = {
      weeklyRecommendationCollection: {
        findUnique: jest.fn().mockResolvedValue({ weekKey: '2026-10-05' }),
      },
      notificationCampaign: {
        findMany: jest.fn(
          () => new Promise((resolve) => (finishRead = resolve)),
        ),
      },
    };
    const campaign = new NotificationCampaignService(
      prisma as any,
      {} as any,
      { get: () => 'test' } as any,
    );
    const tick = campaign.tick();
    await Promise.resolve();
    await Promise.resolve();
    let closed = false;
    const shutdown = Promise.resolve(campaign.onModuleDestroy()).then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    finishRead([]);
    await Promise.all([tick, shutdown]);
    await campaign.tick();
    expect(prisma.notificationCampaign.findMany).toHaveBeenCalledTimes(1);
  });
});
