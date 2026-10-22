import {
  formatNotificationDate,
  notificationDestination,
  notificationIcon,
  notificationText,
  notificationTitle,
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

test('service display titles stay concise while full labels retain the action context', () => {
  const approved = item({ type: 'upload_approved', actor: null, targetType: 'dish_upload' });
  expect(notificationTitle(approved)).toBe('菜品资料已采纳');
  expect(notificationText(approved)).toBe('你提交的菜品资料已采纳');
  expect(notificationTitle(item({ type: 'upload_rejected' }))).toBe('菜品资料未通过');
  expect(notificationTitle(item({ type: 'upload_revoked' }))).toBe('菜品资料已退回');
  expect(notificationTitle(item({ type: 'new_dish' }))).toBe('食堂上新');
  expect(notificationTitle(item({ type: 'like' }))).toBe('小同学 赞了你的评价');
});

test('system events use distinct icons from the shared line icon family', () => {
  expect(notificationIcon(item({ type: 'upload_approved' }))).toBe('shield');
  expect(notificationIcon(item({ type: 'upload_rejected' }))).toBe('edit');
  expect(notificationIcon(item({ type: 'upload_revoked' }))).toBe('history');
  expect(notificationIcon(item({ type: 'new_dish' }))).toBe('plus');
  expect(notificationIcon(item({ type: 'reply', actor: null }))).toBe('chat');
});

test('compact dates retain time and include the year for older notifications', () => {
  const now = new Date('2026-10-12T12:00:00');
  expect(formatNotificationDate('2026-10-12T08:10:00', now)).toBe('08:10');
  expect(formatNotificationDate('2026-10-09T08:10:00', now)).toBe('10/9 08:10');
  expect(formatNotificationDate('2025-10-12T08:10:00', now)).toBe('2025/10/12 08:10');
});

 test('report results always open the owned result record even after content deletion', () => {
  const report = item({ type: 'report_handled', actor: null, targetType: 'report', targetId: 'report / 1', dishId: null });
  expect(notificationDestination(report)).toEqual({ url: '/pages/profile/records/my-reports/index?id=report%20%2F%201' });
  expect(notificationTitle(report)).toBe('举报处理结果已更新');
  expect(notificationText(report)).toContain('查看处理详情');
 });
