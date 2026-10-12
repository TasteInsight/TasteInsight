import { effectScope, reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useMyUploads } from '@/pages/profile/my-uploads/composables/use-my-uploads';
import { getMyUploads, getMyUpload, withdrawMyUpload } from '@/api/modules/user';
import {
  notificationDestination,
  notificationText,
} from '@/pages/notifications/notification-content';
const mockUser = reactive({
  sessionVersion: 1,
  isLoggedIn: true,
  userInfo: { id: 'A', capabilities: { canContribute: true } },
});
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/api/modules/user', () => ({
  getMyUploads: jest.fn(),
  getMyUpload: jest.fn(),
  withdrawMyUpload: jest.fn(),
}));
const scopes: ReturnType<typeof effectScope>[] = [];
const state = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useMyUploads())!;
};
const item = {
  id: 'old',
  name: '菜',
  status: 'rejected',
  revision: 3,
  rejectReason: '价格有误',
  approvedDishId: null,
  createdAt: '2026-10-10T01:00:00Z',
};
beforeEach(() => {
  jest.resetAllMocks();
  Object.assign(mockUser, { sessionVersion: 1, isLoggedIn: true });
  (global as any).uni = { showModal: jest.fn(), navigateTo: jest.fn(), showToast: jest.fn() };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, totalPages: 1 } },
  });
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: item });
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));
test('notification results route to the exact owned contribution', () => {
  for (const [type, text] of [
    ['upload_approved', '你提交的菜品资料已采纳'],
    ['upload_rejected', '你提交的菜品资料未通过审核，查看原因并修改'],
    ['upload_revoked', '你提交的菜品资料已退回审核'],
  ]) {
    const notification = { type, targetType: 'dish_upload', targetId: 'upload / 1' } as any;
    expect(notificationDestination(notification)).toEqual({
      url: '/pages/profile/my-uploads/index?id=upload%20%2F%201',
    });
    expect(notificationText(notification)).toBe(text);
  }
});
test('loads a notified item even when it is not on the first page', async () => {
  const form = state();
  await form.refresh('old');
  expect(form.focusedUpload.value).toMatchObject(item);
  expect(getMyUpload).toHaveBeenCalledWith('old');
});
test('a failed list read remains an error rather than an empty successful list', async () => {
  (getMyUploads as jest.Mock).mockRejectedValue(new Error('offline'));
  const form = state();
  expect(await form.refresh()).toBe(false);
  expect(form.error.value).toBeTruthy();
  expect(form.initialized.value).toBe(false);
});
test('withdraw passes the shown revision and updates the owned row', async () => {
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [item], meta: { page: 1, totalPages: 1 } },
  });
  (withdrawMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: null });
  const form = state();
  await form.refresh();
  expect(await form.withdraw(form.items.value[0])).toBe(true);
  expect(withdrawMyUpload).toHaveBeenCalledWith('old', 3);
  expect(form.items.value[0]).toMatchObject({ status: 'withdrawn', revision: 4 });
});
test('switching account ignores an old focused result and clears prior rows', async () => {
  let resolve!: (value: unknown) => void;
  (getMyUpload as jest.Mock).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const form = state();
  const loading = form.refresh('old');
  await flushPromises();
  mockUser.sessionVersion++;
  resolve({ code: 200, data: item });
  await loading;
  expect(form.focusedUpload.value).toBeNull();
  expect(form.items.value).toEqual([]);
});

test('a missing focused contribution does not discard a successful owned list', async () => {
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [item], meta: { page: 1, totalPages: 1 } },
  });
  (getMyUpload as jest.Mock).mockRejectedValue(
    Object.assign(new Error('上传记录不存在'), { statusCode: 404 })
  );
  const form = state();
  expect(await form.refresh('missing')).toBe(true);
  expect(form.items.value).toEqual([item]);
  expect(form.initialized.value).toBe(true);
  expect(form.error.value).toBe('');
  expect(form.focusError.value).toContain('上传记录不存在');
  expect(form.focusedUpload.value).toBeNull();
  await form.refresh();
  expect(getMyUpload).toHaveBeenCalledTimes(1);
});

test('a notification highlights its existing row without fetching a competing detail shape', async () => {
  const recent = { ...item, id: 'recent-b', createdAt: '2026-10-11T01:00:00Z' };
  const tied = { ...recent, id: 'recent-a' };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [item, tied, recent], meta: { page: 1, totalPages: 1 } },
  });
  const form = state();
  await form.refresh('old');
  expect(form.items.value.map(row => row.id)).toEqual(['recent-b', 'recent-a', 'old']);
  expect(form.focusedUpload.value).toMatchObject(item);
  expect(form.detachedUpload.value).toBeNull();
  expect(getMyUpload).not.toHaveBeenCalled();
});

test('an older notification uses one separate record without paging or modifying the list', async () => {
  const recent = { ...item, id: 'recent', createdAt: '2026-10-11T01:00:00Z' };
  (getMyUploads as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: [recent], meta: { page: 1, totalPages: 100 } },
  });
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...item, ingredients: ['only-in-detail'] },
  });
  const form = state();
  await form.refresh('old');
  expect(getMyUploads).toHaveBeenCalledTimes(1);
  expect(form.items.value.map(row => row.id)).toEqual(['recent']);
  expect(form.detachedUpload.value).toMatchObject(item);
  expect(form.focusedUpload.value).not.toHaveProperty('ingredients');
  (getMyUploads as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: [recent, item], meta: { page: 2, totalPages: 100 } },
  });
  await form.loadMore();
  expect(form.items.value.map(row => row.id)).toEqual(['recent', 'old']);
  expect(form.detachedUpload.value).toBeNull();
});

test('changing a notification target invalidates an older detail response immediately', async () => {
  let finish!: (value: any) => void;
  const recent = { ...item, id: 'recent', createdAt: '2026-10-11T01:00:00Z' };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [recent], meta: { page: 1, totalPages: 1 } },
  });
  (getMyUpload as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const form = state();
  const old = form.refresh('old');
  await flushPromises();
  await form.refresh('recent');
  finish({ code: 200, data: item });
  await old;
  expect(form.items.value.map(row => row.id)).toEqual(['recent']);
  expect(form.focusedUpload.value?.id).toBe('recent');
  expect(form.detachedUpload.value).toBeNull();
});

test('list and detached record summaries retain the same thumbnail field', async () => {
  const recent = { ...item, id: 'recent', images: ['/recent.jpg'] };
  const older = { ...item, images: ['/older.jpg'] };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [recent], meta: { page: 1, totalPages: 2 } },
  });
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: older });
  const form = state();
  await form.refresh('old');
  expect(form.items.value[0].images).toEqual(['/recent.jpg']);
  expect(form.detachedUpload.value?.images).toEqual(['/older.jpg']);
});
