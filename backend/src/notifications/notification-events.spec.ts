import { enqueueDishNotifications } from './notification-events';

describe('dish notification source events', () => {
  const published = {
    id: 'dish',
    price: 12,
    priceUnit: '份',
    status: 'online',
  };
  let tx: any;
  beforeEach(() => {
    tx = {
      notificationCampaign: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
    };
  });

  it('records a newly published dish using one stable event key', async () => {
    await enqueueDishNotifications(tx, published);
    expect(tx.notificationCampaign.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'new_dish',
          targetId: 'dish',
          dedupeKey: 'new_dish:dish',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not create events for an offline dish or unchanged visible price', async () => {
    await enqueueDishNotifications(tx, { ...published, status: 'offline' });
    await enqueueDishNotifications(tx, published, published);
    expect(tx.notificationCampaign.createMany).not.toHaveBeenCalled();
  });

  it('records a favorite-price event for each actual price or unit change', async () => {
    await enqueueDishNotifications(tx, { ...published, price: 13 }, published);
    await enqueueDishNotifications(
      tx,
      { ...published, priceUnit: '两' },
      published,
    );
    const events = tx.notificationCampaign.createMany.mock.calls.flatMap(
      ([args]) => args.data,
    );
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.type === 'price_change')).toBe(true);
    expect(events[0].dedupeKey).not.toBe(events[1].dedupeKey);
  });

  it('uses the original publication key when an existing dish returns online', async () => {
    await enqueueDishNotifications(tx, published, {
      ...published,
      status: 'offline',
    });
    expect(tx.notificationCampaign.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ dedupeKey: 'new_dish:dish' })],
      }),
    );
  });

  it('withdraws dish alerts and queued campaigns on the actual transition offline', async () => {
    await enqueueDishNotifications(
      tx,
      { ...published, status: 'offline' },
      published,
    );
    expect(tx.notificationCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'cancelled',
          leaseToken: null,
        }),
      }),
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.notificationCampaign.createMany).not.toHaveBeenCalled();
  });
});
