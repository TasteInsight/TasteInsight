import { reactive } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import MyReportsPage from '@/pages/profile/my-reports/index.vue';
import ReportRecord from '@/pages/profile/my-reports/ReportRecord.vue';
import { getMyReports, getMyReport } from '@/api/modules/user';
const mockUser = reactive({ sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'A' } });
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/api/modules/user', () => ({ getMyReports: jest.fn(), getMyReport: jest.fn() }));
const item = (id: string, patch = {}) => ({
  id,
  targetType: 'review',
  status: 'pending',
  type: 'spam',
  reason: '广告链接',
  createdAt: '2026-10-10T01:00:00Z',
  ...patch,
});
const mounts: any[] = [];
const mountPage = () => {
  const wrapper = shallowMount(MyReportsPage, {
    global: {
      stubs: { ReportRecord: false, LoginGate: false, AsyncState: false, EmptyState: false },
    },
  });
  mounts.push(wrapper);
  return wrapper;
};
beforeEach(() => {
  jest.resetAllMocks();
  Object.assign(mockUser, { sessionVersion: 1, isLoggedIn: true, userInfo: { id: 'A' } });
  (global as any).uni = { stopPullDownRefresh: jest.fn(), navigateTo: jest.fn() };
  (getMyReports as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { totalPages: 1 } },
  });
});
afterEach(() => mounts.splice(0).forEach(w => w.unmount()));
test('renders submitted and handled times with pending and final conclusions', () => {
  const wrapper = shallowMount(ReportRecord, {
    props: {
      item: item('one', {
        status: 'approved',
        handleResult: '内容已删除',
        handledAt: '2026-10-10T02:00:00Z',
      }) as any,
    },
  });
  mounts.push(wrapper);
  expect(wrapper.text()).toContain('举报成立');
  expect(wrapper.text()).toContain('处理结论：内容已删除');
  expect(wrapper.text()).toContain('提交时间');
  expect(wrapper.text()).toContain('处理时间');
  expect(wrapper.text()).toContain('广告链接');
});
test('pending results show processing status without a fabricated conclusion', () => {
  const wrapper = shallowMount(ReportRecord, { props: { item: item('one') as any } });
  mounts.push(wrapper);
  expect(wrapper.text()).toContain('处理中');
  expect(wrapper.text()).not.toContain('处理结论');
});
test('notification route shows exact older result above paginated records and resets on account switch', async () => {
  (getMyReport as jest.Mock).mockResolvedValue({
    code: 200,
    data: item('older', { status: 'rejected', handleResult: '未发现违规' }),
  });
  (getMyReports as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [item('new')], meta: { totalPages: 2 } },
  });
  const wrapper = mountPage();
  (onLoad as jest.Mock).mock.calls[0][0]({ id: 'older' });
  await (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('未发现违规');
  expect(wrapper.text()).toContain('处理中');
  expect(wrapper.text()).toContain('加载更多');
  expect((global as any).uni.navigateTo).not.toHaveBeenCalled();
  mockUser.sessionVersion++;
  mockUser.userInfo = { id: 'B' };
  await flushPromises();
  expect(wrapper.text()).not.toContain('未发现违规');
  expect(wrapper.findAllComponents(ReportRecord)).toHaveLength(0);
});
test('list errors provide a working retry and pull refresh always stops the spinner', async () => {
  (getMyReports as jest.Mock).mockRejectedValueOnce(new Error('举报记录加载失败'));
  const wrapper = mountPage();
  await (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('举报记录加载失败');
  await wrapper.get('.error-feedback__action').trigger('click');
  await flushPromises();
  expect(wrapper.find('.error-feedback').exists()).toBe(false);
  await (onPullDownRefresh as jest.Mock).mock.calls[0][0]();
  expect((global as any).uni.stopPullDownRefresh).toHaveBeenCalled();
});

test('an empty refresh shows loading feedback and guest access uses the shared login gate', async () => {
  const wrapper = mountPage();
  await (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('暂无举报记录');
  let finish!: (value: unknown) => void;
  (getMyReports as jest.Mock).mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  const refresh = (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('正在加载…');
  expect(wrapper.text()).not.toContain('暂无举报记录');
  finish({ code: 200, data: { items: [], meta: { totalPages: 1 } } });
  await refresh;
  await flushPromises();
  mockUser.isLoggedIn = false;
  await flushPromises();
  expect(wrapper.text()).toContain('登录后查看举报记录');
  expect(wrapper.findComponent({ name: 'AsyncState' }).exists()).toBe(false);
});
