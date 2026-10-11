import request from '@/utils/request';
import {
  getPublicProfile,
  getPosts,
  getPost,
  getPostComments,
  getPublicMealPlans,
  createPost,
  updatePost,
  setPostLike,
  setPostCommentLike,
} from '@/api/modules/social';
import {
  getNotifications,
  getUnreadNotificationCount,
  readNotification,
  readAllNotifications,
  notificationScope,
  getWeeklyNotificationCollection,
} from '@/api/modules/notifications';
import { setReviewLike } from '@/api/modules/review';
import { setCommentLike } from '@/api/modules/comment';
jest.mock('@/utils/request', () => ({ __esModule: true, default: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('public reads use optional authentication while the owned feed remains private', () => {
  getPublicProfile('a/b');
  getPosts({ authorId: 'A' });
  getPost('P');
  getPostComments('P');
  getPublicMealPlans('A');
  expect((request as jest.Mock).mock.calls.every(([options]) => options.auth === 'optional')).toBe(
    true
  );
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/users/a%2Fb' }));
  getPosts({ page: 2 }, true);
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ url: '/user/posts', auth: 'required', data: { page: 2 } })
  );
});
test('create/update preserve the post contract and exact update version', () => {
  createPost({ content: '动态', images: [] });
  updatePost('P', { content: '更新', images: [], expectedUpdatedAt: '2026-10-09T00:00:00Z' });
  expect(request).toHaveBeenLastCalledWith({
    url: '/posts/P',
    method: 'PUT',
    data: { content: '更新', images: [], expectedUpdatedAt: '2026-10-09T00:00:00Z' },
  });
});
test.each([
  ['reviews', setReviewLike],
  ['comments', setCommentLike],
  ['posts', setPostLike],
  ['post-comments', setPostCommentLike],
] as const)('%s likes are idempotent PUT/DELETE resources', (resource, setLike) => {
  setLike('a/b', true);
  setLike('a/b', false);
  expect((request as jest.Mock).mock.calls.map(([options]) => options.method)).toEqual([
    'PUT',
    'DELETE',
  ]);
  expect(request).toHaveBeenLastCalledWith({ url: `/${resource}/a%2Fb/like`, method: 'DELETE' });
});
test('every notification read and write shares the platform scope', () => {
  const scope = notificationScope();
  getNotifications({ page: 2 });
  getUnreadNotificationCount();
  readNotification('one/two');
  readAllNotifications();
  expect(request).toHaveBeenNthCalledWith(1, {
    url: '/notifications',
    method: 'GET',
    data: { page: 2, scope },
  });
  expect(request).toHaveBeenNthCalledWith(2, {
    url: '/notifications/unread-count',
    method: 'GET',
    data: { scope },
  });
  expect(request).toHaveBeenNthCalledWith(3, {
    url: `/notifications/one%2Ftwo/read?scope=${scope}`,
    method: 'PUT',
  });
  expect(request).toHaveBeenNthCalledWith(4, {
    url: `/notifications/read-all?scope=${scope}`,
    method: 'PUT',
  });
});
test('weekly recommendations use the durable notified collection key', () => {
  getWeeklyNotificationCollection('2026-10-05');
  expect(request).toHaveBeenCalledWith({ url: '/notifications/weekly/2026-10-05', method: 'GET' });
});
