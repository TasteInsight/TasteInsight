import axios from 'axios';
import { NotificationDispatcher } from './notification-dispatcher.service';

describe('notification webhook outbox', () => {
  let prisma: any;
  let notifications: any;
  let dispatcher: NotificationDispatcher;
  let post: jest.SpyInstance;
  const row = {
    id: 'job',
    notificationId: 'notice',
    attempts: 0,
    status: 'pending',
    nextAttemptAt: new Date(0),
    lockedUntil: null,
  };
  beforeEach(() => {
    prisma = {
      notificationOutbox: {
        findMany: jest.fn().mockResolvedValue([row]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'notice',
          userId: 'owner',
          actor: { id: 'actor', nickname: '昵称', avatar: null },
          type: 'like',
          targetType: 'review',
          targetId: 'r1',
          rootId: null,
          withdrawnAt: null,
          createdAt: new Date(0),
        }),
      },
    };
    notifications = {
      webhookUrl: jest
        .fn()
        .mockReturnValue('https://hooks.example.test/notify'),
      canDeliver: jest.fn().mockResolvedValue(true),
    };
    dispatcher = new NotificationDispatcher(prisma, notifications, {
      get: jest.fn((key) =>
        key === 'NOTIFICATION_WEBHOOK_SECRET' ? 's'.repeat(32) : undefined,
      ),
    } as any);
    post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
  });
  afterEach(() => {
    post.mockRestore();
    dispatcher.onModuleDestroy();
  });
  it('uses the persisted notification id as the receiver deduplication key', async () => {
    await dispatcher.dispatchDue();
    expect(post).toHaveBeenCalledWith(
      'https://hooks.example.test/notify',
      expect.any(String),
      expect.objectContaining({
        timeout: 5000,
        maxRedirects: 0,
        headers: expect.objectContaining({ 'Idempotency-Key': 'notice' }),
      }),
    );
    const payload = JSON.parse(post.mock.calls[0][1]);
    expect(payload).not.toHaveProperty('content');
    expect(payload).not.toHaveProperty('openId');
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'job',
          status: 'processing',
          lockedUntil: expect.any(Date),
        },
        data: expect.objectContaining({ status: 'delivered' }),
      }),
    );
  });
  it('retries a timeout with the same idempotency key and bounded backoff', async () => {
    post.mockRejectedValueOnce(new Error('timeout'));
    await dispatcher.dispatchDue();
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          lastError: 'delivery_failed',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
    await dispatcher.dispatchDue();
    expect(post.mock.calls[0][2].headers['Idempotency-Key']).toBe(
      post.mock.calls[1][2].headers['Idempotency-Key'],
    );
  });
  it('does not retry permanent HTTP rejection', async () => {
    post.mockRejectedValue({ isAxiosError: true, response: { status: 400 } });
    await dispatcher.dispatchDue();
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          lastError: 'http_400',
        }),
      }),
    );
  });
  it('cancels a withdrawn or newly hidden target without an HTTP request', async () => {
    notifications.canDeliver.mockResolvedValue(false);
    await dispatcher.dispatchDue();
    expect(post).not.toHaveBeenCalled();
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: 'cancelled', lockedUntil: null },
      }),
    );
  });
  it('does not send if another worker won the lease', async () => {
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 0 });
    await dispatcher.dispatchDue();
    expect(post).not.toHaveBeenCalled();
  });
  it('recovers expired processing jobs while fencing completion to its new lease', async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { ...row, status: 'processing', lockedUntil: new Date(0) },
    ]);
    await dispatcher.dispatchDue();
    const claim = prisma.notificationOutbox.updateMany.mock.calls[0][0];
    const finish = prisma.notificationOutbox.updateMany.mock.calls[1][0];
    expect(claim.where.OR[1]).toEqual({
      status: 'processing',
      lockedUntil: { lte: expect.any(Date) },
    });
    expect(finish.where.lockedUntil).toEqual(claim.data.lockedUntil);
  });
  it('does not dispatch when webhook delivery is disabled', async () => {
    notifications.webhookUrl.mockReturnValue(undefined);
    await dispatcher.dispatchDue();
    expect(prisma.notificationOutbox.findMany).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('stops transient retries at the configured attempt limit', async () => {
    prisma.notificationOutbox.findMany.mockResolvedValue([
      { ...row, attempts: 4 },
    ]);
    post.mockRejectedValue(new Error('timeout'));
    await dispatcher.dispatchDue();
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('does not run a second local dispatcher while a send is in flight', async () => {
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const network = new Promise<void>((resolve) => {
      release = resolve;
    });
    post.mockImplementation(() => {
      entered();
      return network;
    });
    const first = dispatcher.dispatchDue();
    await started;
    await dispatcher.dispatchDue();
    expect(post).toHaveBeenCalledTimes(1);
    expect(prisma.notificationOutbox.findMany).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});
