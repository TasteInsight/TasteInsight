import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const event = {
    userId: 'author',
    actorId: 'reader',
    type: 'like' as const,
    targetType: 'review' as const,
    targetId: 'review',
    dedupeKey: 'review-like-reader-author',
  };
  let tx: any;
  let service: NotificationService;
  beforeEach(() => {
    tx = {
      userSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      review: { findFirst: jest.fn().mockResolvedValue({ id: 'review' }) },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn(),
      },
      notificationOutbox: { create: jest.fn(), updateMany: jest.fn() },
    };
    service = new NotificationService(tx, {
      get: jest.fn(),
    } as unknown as ConfigService);
  });
  it('keeps a durable inbox event without creating a disabled webhook job', async () => {
    await service.create(tx, event);
    expect(tx.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(tx.notificationOutbox.create).not.toHaveBeenCalled();
  });
  it('delivers owned report results as service messages independently of social preferences', async () => {
    tx.report = { findFirst: jest.fn().mockResolvedValue({ id: 'report' }) };
    tx.userSetting.findUnique.mockResolvedValue({
      reviewReplyAlert: false,
      postReplyAlert: false,
    });
    const reportEvent = {
      ...event,
      actorId: null,
      type: 'report_handled' as const,
      targetType: 'report' as const,
      targetId: 'report',
      dedupeKey: 'report_handled:report',
    };
    await service.create(tx, reportEvent);
    expect(tx.report.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'report',
        reporterId: 'author',
        status: { in: ['approved', 'rejected'] },
      },
      select: { id: true },
    });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    tx.report.findFirst.mockResolvedValue(null);
    await service.create(tx, reportEvent);
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('does not notify an actor about their own action', async () => {
    await service.create(tx, { ...event, userId: 'reader' });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
  it('respects the recipient preference before creating an event', async () => {
    tx.userSetting.findUnique.mockResolvedValue({ likeAlert: false });
    await service.create(tx, event);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
  it('does not create messages for content that is no longer public', async () => {
    tx.review.findFirst.mockResolvedValue(null);
    await service.create(tx, event);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
  it('creates one outbox row only for the winning insert', async () => {
    service = new NotificationService(tx, {
      get: jest
        .fn()
        .mockImplementation((k) =>
          k === 'NOTIFICATION_WEBHOOK_URL'
            ? 'https://hooks.example.test/events'
            : undefined,
        ),
    } as any);
    await service.create(tx, event);
    expect(tx.notificationOutbox.create).toHaveBeenCalledTimes(1);
    tx.notification.createMany.mockResolvedValue({ count: 0 });
    await service.create(tx, event);
    expect(tx.notificationOutbox.create).toHaveBeenCalledTimes(1);
  });
  it('withdraws unread events and cancels work in the same transaction', async () => {
    const where = { targetType: 'review', targetId: 'review' };
    await service.withdraw(tx, where);
    expect(tx.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...where, withdrawnAt: null } }),
    );
    expect(tx.notificationOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          notification: where,
          status: { in: ['pending', 'processing'] },
        },
      }),
    );
  });

  it('uses the same service-only scope for inbox, unread count and read-all', async () => {
    tx.notification.findMany = jest.fn().mockResolvedValue([]);
    tx.notification.count = jest.fn().mockResolvedValue(0);
    await service.getInbox('author', 1, 20, 'service');
    await service.unreadCount('author', 'service');
    await service.read('author', undefined, 'service');
    const targetType = {
      in: [
        'review',
        'comment',
        'dish',
        'week_collection',
        'dish_upload',
        'report',
      ],
    };
    expect(tx.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'author', withdrawnAt: null, targetType },
      }),
    );
    expect(tx.notification.count).toHaveBeenLastCalledWith({
      where: { userId: 'author', withdrawnAt: null, readAt: null, targetType },
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'author', withdrawnAt: null, readAt: null, targetType },
      data: { readAt: expect.any(Date) },
    });
  });

  it('resolves dish links once per page using visible review roots only', async () => {
    const notice = {
      id: 'notice',
      userId: 'author',
      actor: { id: 'reader', nickname: 'Reader', avatar: null },
      type: 'reply',
      targetType: 'comment',
      targetId: 'comment',
      rootId: 'review',
      readAt: null,
      createdAt: new Date(0),
    };
    tx.notification.findMany = jest.fn().mockResolvedValue([notice]);
    tx.notification.count = jest.fn().mockResolvedValue(1);
    tx.review.findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'review', dishId: 'dish' }]);
    const response = await service.getInbox('author');
    expect(response.data.items[0].dishId).toBe('dish');
    expect(tx.review.findMany).toHaveBeenCalledTimes(1);
    expect(tx.review.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['review'] }, status: 'approved', deletedAt: null },
      select: { id: true, dishId: true },
    });
  });

  it('keeps the default price-change preference disabled when no settings row exists', async () => {
    await service.create(tx, {
      ...event,
      actorId: null,
      type: 'price_change',
      targetType: 'dish',
    });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it('adds owned contribution names in one query without exposing another owner record', async () => {
    const notice = {
      userId: 'author',
      actor: null,
      type: 'upload_approved',
      targetType: 'dish_upload',
      rootId: null,
      readAt: null,
      createdAt: new Date(0),
    };
    tx.notification.findMany = jest.fn().mockResolvedValue([
      { ...notice, id: 'n1', targetId: 'mine' },
      { ...notice, id: 'n2', targetId: 'other-owner-or-deleted' },
      { ...notice, id: 'n3', targetId: 'mine' },
    ]);
    tx.notification.count = jest.fn().mockResolvedValue(3);
    tx.dishUpload = {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'mine', name: '番茄炒蛋', nameEn: 'Tomato and eggs' },
        ]),
    };
    const response = await service.getInbox('author');
    expect(tx.dishUpload.findMany).toHaveBeenCalledTimes(1);
    expect(tx.dishUpload.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'author',
        id: { in: ['mine', 'other-owner-or-deleted'] },
      },
      select: { id: true, name: true, nameEn: true },
    });
    expect(response.data.items).toEqual([
      expect.objectContaining({
        id: 'n1',
        subject: '番茄炒蛋',
        subjectEn: 'Tomato and eggs',
      }),
      expect.objectContaining({ id: 'n2', subject: null }),
      expect.objectContaining({
        id: 'n3',
        subject: '番茄炒蛋',
        subjectEn: 'Tomato and eggs',
      }),
    ]);
  });

  it('includes names for public dish messages but omits unavailable dish subjects', async () => {
    const notice = {
      userId: 'author',
      actor: null,
      type: 'new_dish',
      targetType: 'dish',
      rootId: null,
      readAt: null,
      createdAt: new Date(0),
    };
    tx.notification.findMany = jest.fn().mockResolvedValue([
      { ...notice, id: 'live-notice', targetId: 'live' },
      { ...notice, id: 'offline-notice', targetId: 'offline' },
    ]);
    tx.notification.count = jest.fn().mockResolvedValue(2);
    tx.dish = {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'live', name: '红烧牛肉', nameEn: 'Braised beef' },
        ]),
    };
    const response = await service.getInbox('author');
    expect(tx.dish.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['live', 'offline'] }, status: 'online' },
      select: { id: true, name: true, nameEn: true },
    });
    expect(response.data.items).toEqual([
      expect.objectContaining({
        id: 'live-notice',
        subject: '红烧牛肉',
        subjectEn: 'Braised beef',
      }),
      expect.objectContaining({ id: 'offline-notice', subject: null }),
    ]);
  });
});
