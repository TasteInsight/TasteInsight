import {
  notificationDestination,
  notificationText,
} from '@/pages/notifications/notification-content';
import type { InboxNotification } from '@/api/modules/notifications';
const item = (patch: Partial<InboxNotification>): InboxNotification => ({
  id: 'one',
  type: 'like',
  actor: { id: 'A', nickname: '小同学', avatar: '' },
  targetType: 'review',
  targetId: 'review/A',
  rootId: null,
  dishId: 'dish/A',
  createdAt: '2026-10-09T00:00:00Z',
  readAt: null,
  ...patch,
});
test('evaluation notifications resolve the exact dish and review with encoded identifiers', () => {
  expect(notificationDestination(item({}))).toEqual({
    url: '/pages/dish/index?id=dish%2FA&reviewId=review%2FA',
  });
  expect(
    notificationDestination(
      item({ targetType: 'comment', targetId: 'comment', rootId: 'review/B' })
    )
  ).toEqual({ url: '/pages/dish/index?id=dish%2FA&reviewId=review%2FB' });
});
test('missing target information never guesses a dish id', () => {
  expect(notificationDestination(item({ dishId: null }))).toBeNull();
  expect(notificationDestination(item({ targetType: 'comment', rootId: null }))).toBeNull();
});
test('post replies deep link to the root post and invitations to the exact invite', () => {
  expect(notificationDestination(item({ targetType: 'postComment', rootId: 'P' }))).toEqual({
    url: '/pages/community/detail?id=P',
  });
  expect(
    notificationDestination(item({ targetType: 'dining_invite', targetId: 'invite' }))
  ).toEqual({ url: '/pages/planning/dining?id=invite' });
});
test('weekly notifications open their actual saved recommendation collection', () => {
  expect(
    notificationDestination(item({ targetType: 'week_collection', targetId: '2026-10-05' }))
  ).toEqual({ url: '/pages/notifications/weekly?week=2026-10-05' });
});
test('labels distinguish likes, replies and service updates without inventing message bodies', () => {
  expect(notificationText(item({}))).toBe('小同学 赞了你的评价');
  expect(notificationText(item({ type: 'reply' }))).toBe('小同学 回复了你');
  expect(notificationText(item({ type: 'price_change', actor: null }))).toBe(
    '关注的菜品价格有更新'
  );
});
