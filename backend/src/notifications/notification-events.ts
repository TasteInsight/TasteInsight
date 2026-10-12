import { Dish, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withdrawDishNotifications } from './withdraw-dish-notifications';

type PublishedDish = Pick<Dish, 'id' | 'price' | 'priceUnit' | 'status'>;

export async function enqueueDishNotifications(
  tx: Prisma.TransactionClient,
  dish: PublishedDish,
  previous?: PublishedDish,
): Promise<void> {
  if (dish.status !== 'online') {
    if (previous?.status === 'online') {
      await withdrawDishNotifications(tx, [dish.id], 'offline');
    }
    return;
  }
  const events: Prisma.NotificationCampaignCreateManyInput[] = [];
  if (!previous || previous.status !== 'online') {
    events.push({
      type: 'new_dish',
      targetId: dish.id,
      dedupeKey: `new_dish:${dish.id}`,
    });
  }
  if (
    previous &&
    (previous.price !== dish.price || previous.priceUnit !== dish.priceUnit)
  ) {
    events.push({
      type: 'price_change',
      targetId: dish.id,
      dedupeKey: `price_change:${dish.id}:${randomUUID()}`,
    });
  }
  if (events.length) {
    await tx.notificationCampaign.createMany({
      data: events.map((event) => ({ ...event, recipientCutoff: new Date() })),
      skipDuplicates: true,
    });
  }
}
