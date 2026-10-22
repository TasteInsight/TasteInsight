import { effectScope, reactive } from 'vue';
import { useMyReports } from '@/pages/profile/records/my-reports/use-my-reports';
import { getMyReports, getMyReport } from '@/api/modules/user';
const mockUser = reactive({ sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'A' } });
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/api/modules/user', () => ({ getMyReports: jest.fn(), getMyReport: jest.fn() }));
const scopes: ReturnType<typeof effectScope>[] = [];
const state = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(useMyReports)!;
};
const item = (id: string, patch = {}) => ({
  id,
  status: 'pending',
  targetType: 'review',
  type: 'spam',
  reason: '广告',
  createdAt: '2026-10-10T01:00:00Z',
  ...patch,
});
const list = (ids: string[], pages = 1) => ({
  code: 200,
  data: { items: ids.map(id => item(id)), meta: { totalPages: pages } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (value: any) => void;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  jest.resetAllMocks();
  Object.assign(mockUser, { sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'A' } });
  (getMyReports as jest.Mock).mockResolvedValue(list([]));
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));
test('notification detail loads the exact report independently of its list page', async () => {
  const form = state();
  form.focusId.value = 'old';
  (getMyReports as jest.Mock).mockResolvedValue(list(['new'], 5));
  (getMyReport as jest.Mock).mockResolvedValue({
    code: 200,
    data: item('old', { status: 'approved', handleResult: '内容已删除' }),
  });
  await form.refresh();
  expect(getMyReport).toHaveBeenCalledWith('old');
  expect(form.focusedReport.value?.handleResult).toBe('内容已删除');
  expect(form.visibleItems.value.map(i => i.id)).toEqual(['new']);
});
test('failed appended page retries that page and deduplicates overlapping records', async () => {
  const form = state();
  (getMyReports as jest.Mock).mockResolvedValueOnce(list(['one'], 3));
  await form.refresh();
  (getMyReports as jest.Mock).mockRejectedValueOnce(new Error('暂时无法加载'));
  await form.loadMore();
  expect(form.error.value).toBe('暂时无法加载');
  expect(form.items.value.map(i => i.id)).toEqual(['one']);
  (getMyReports as jest.Mock).mockResolvedValueOnce(list(['one', 'two'], 3));
  await form.retry();
  expect((getMyReports as jest.Mock).mock.calls.map(([p]) => p.page)).toEqual([1, 2, 2]);
  expect(form.items.value.map(i => i.id)).toEqual(['one', 'two']);
  expect(form.error.value).toBe('');
});
test('a failed list can retry while an owned detail remains visible', async () => {
  const form = state();
  form.focusId.value = 'old';
  (getMyReport as jest.Mock).mockResolvedValue({ code: 200, data: item('old') });
  (getMyReports as jest.Mock).mockRejectedValueOnce(new Error('列表加载失败'));
  await form.refresh();
  expect(form.focusedReport.value?.id).toBe('old');
  expect(form.error.value).toBe('列表加载失败');
  await form.retry();
  expect(form.error.value).toBe('');
});
test('detail failures are visible and refresh retries the exact result', async () => {
  const form = state();
  form.focusId.value = 'private';
  (getMyReport as jest.Mock).mockRejectedValueOnce(new Error('举报记录不存在'));
  await form.refresh();
  expect(form.focusError.value).toBe('举报记录不存在');
  (getMyReport as jest.Mock).mockResolvedValue({ code: 200, data: item('private') });
  await form.refresh();
  expect(form.focusedReport.value?.id).toBe('private');
  expect(form.focusError.value).toBe('');
});
test.each(['success', 'failure'])(
  'account switch clears records and ignores late %s from both requests',
  async outcome => {
    const form = state();
    form.focusId.value = 'A-report';
    const pendingList = deferred(),
      pendingDetail = deferred();
    (getMyReports as jest.Mock).mockReturnValueOnce(pendingList.promise);
    (getMyReport as jest.Mock).mockReturnValueOnce(pendingDetail.promise);
    const pending = form.refresh();
    mockUser.userInfo = { id: 'B' };
    mockUser.sessionVersion++;
    expect(form.items.value).toEqual([]);
    expect(form.focusId.value).toBe('');
    if (outcome === 'success') {
      pendingList.resolve(list(['A-report']));
      pendingDetail.resolve({ code: 200, data: item('A-report') });
    } else {
      pendingList.reject(new Error('A失败'));
      pendingDetail.reject(new Error('A失败'));
    }
    await pending;
    expect(form.items.value).toEqual([]);
    expect(form.focusedReport.value).toBeNull();
    expect(form.error.value).toBe('');
    expect(form.focusError.value).toBe('');
    await form.refresh();
    expect(form.items.value).toEqual([]);
  }
);
test('refresh supersedes an old page response and unmount discards pending detail', async () => {
  const form = state(),
    old = deferred();
  (getMyReports as jest.Mock).mockReturnValueOnce(old.promise).mockResolvedValueOnce(list(['new']));
  const pending = form.refresh();
  await form.refresh();
  old.resolve(list(['old']));
  await pending;
  expect(form.items.value.map(i => i.id)).toEqual(['new']);
  form.focusId.value = 'old';
  const detail = deferred();
  (getMyReport as jest.Mock).mockReturnValueOnce(detail.promise);
  const closed = form.refresh();
  scopes[0].stop();
  detail.resolve({ code: 200, data: item('old') });
  await closed;
  expect(form.focusedReport.value).toBeNull();
});
test('logged out pages make no private requests', async () => {
  const form = state();
  mockUser.isLoggedIn = false;
  await form.refresh();
  expect(getMyReports).not.toHaveBeenCalled();
});

test('same-owner profile replacement preserves a loaded notification result and list', async () => {
  const form = state();
  form.focusId.value = 'result';
  (getMyReports as jest.Mock).mockResolvedValue(list(['result'], 3));
  (getMyReport as jest.Mock).mockResolvedValue({
    code: 200,
    data: item('result', { status: 'approved', handleResult: '内容已删除' }),
  });
  await form.refresh();
  mockUser.userInfo = { ...mockUser.userInfo };
  expect(form.focusId.value).toBe('result');
  expect(form.focusedReport.value?.handleResult).toBe('内容已删除');
  expect(form.items.value.map(report => report.id)).toEqual(['result']);
  expect(form.initialized.value).toBe(true);
  expect(form.hasMore.value).toBe(true);
});

test('same-owner profile replacement keeps in-flight result and list requests current', async () => {
  const form = state();
  form.focusId.value = 'result';
  const pendingList = deferred();
  const pendingDetail = deferred();
  (getMyReports as jest.Mock).mockReturnValueOnce(pendingList.promise);
  (getMyReport as jest.Mock).mockReturnValueOnce(pendingDetail.promise);
  const pending = form.refresh();
  mockUser.userInfo = { ...mockUser.userInfo };
  expect(form.loading.value).toBe(true);
  pendingList.resolve(list(['result'], 2));
  pendingDetail.resolve({
    code: 200,
    data: item('result', { status: 'rejected', handleResult: '未发现违规' }),
  });
  await pending;
  expect(form.focusId.value).toBe('result');
  expect(form.focusedReport.value?.handleResult).toBe('未发现违规');
  expect(form.items.value.map(report => report.id)).toEqual(['result']);
  expect(form.initialized.value).toBe(true);
  expect(form.loading.value).toBe(false);
});
