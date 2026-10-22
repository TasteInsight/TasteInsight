import { reactive } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { onLoad, onShow, onHide, onReachBottom } from '@dcloudio/uni-app';
import MyUploadsPage from '@/pages/profile/my-uploads/index.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import { getMyUploads, getMyUpload, withdrawMyUpload } from '@/api/modules/user';
const mockUser = reactive({
  sessionVersion: 1,
  isLoggedIn: true,
  userInfo: { id: 'A', capabilities: { canContribute: true } },
});
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
}));
jest.mock('@/api/modules/user', () => ({
  getMyUploads: jest.fn(),
  getMyUpload: jest.fn(),
  withdrawMyUpload: jest.fn(),
}));
const item = (id: string) => ({
  id,
  name: id + '菜品',
  price: 12,
  canteenName: '食堂',
  status: 'pending',
  revision: 1,
  createdAt: '2026-10-11T01:00:00Z',
});
const mountPage = () =>
  shallowMount(MyUploadsPage, {
    global: {
      stubs: {
        UploadRecord: false,
        FloatingActionButton: false,
        LoginGate: false,
        AsyncState: false,
        EmptyState: false,
      },
    },
  });
let measuredRect: { top: number; bottom: number };
let pendingMeasurements: Array<() => void>;
let deferMeasurement = false;
beforeEach(() => {
  jest.resetAllMocks();
  measuredRect = { top: 900, bottom: 1080 };
  pendingMeasurements = [];
  deferMeasurement = false;
  Object.assign(mockUser, {
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: { id: 'A', capabilities: { canContribute: true } },
  });
  (global as any).uni = {
    navigateTo: jest.fn(),
    showModal: jest.fn(),
    stopPullDownRefresh: jest.fn(),
    pageScrollTo: jest.fn(),
    getSystemInfoSync: () => ({ windowHeight: 700 }),
    createSelectorQuery: jest.fn(() => {
      let receive!: (rect: typeof measuredRect) => void;
      const query: { select: jest.Mock; boundingClientRect: jest.Mock; exec: jest.Mock } = {
        select: jest.fn(() => query),
        boundingClientRect: jest.fn(callback => {
          receive = callback;
          return query;
        }),
        exec: jest.fn(() => {
          const deliver = () => receive(measuredRect);
          if (deferMeasurement) pendingMeasurements.push(deliver);
          else deliver();
        }),
      };
      return query;
    }),
  };
  (getMyUploads as jest.Mock).mockImplementation(async () => ({
    code: 200,
    data: { items: [item(mockUser.userInfo.id)], meta: { page: 1, totalPages: 1 } },
  }));
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: item('A') });
});
test('a retained page drops its former account notification target when its session changes', async () => {
  const wrapper = mountPage();
  (onLoad as jest.Mock).mock.calls[0][0]({ id: 'A' });
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('A菜品');
  mockUser.userInfo = { id: 'B', capabilities: { canContribute: true } };
  mockUser.sessionVersion++;
  (getMyUpload as jest.Mock).mockRejectedValue(
    Object.assign(new Error('上传记录不存在'), { statusCode: 404 })
  );
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.text()).toContain('B菜品');
  expect(wrapper.text()).not.toContain('A菜品');
  expect(getMyUpload).not.toHaveBeenCalled();
  wrapper.unmount();
});

test.each([
  ['create', '新增菜品'],
  ['update', '补充资料'],
])('labels an upload record of kind %s as %s', async (kind, label) => {
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [{ ...item('A'), kind }], meta: { page: 1, totalPages: 1 } },
  });
  const wrapper = mountPage();
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.get('.upload-item .upload-meta').text()).toContain(label);
  expect(wrapper.get('.upload-actions').text()).toContain('修改资料');
  wrapper.unmount();
});

test.each([
  ['份', '/份'],
  ['元/份', '/份'],
  ['元', ''],
  [null, ''],
])(
  'normalizes uploaded record price unit %p and keeps zero explicit',
  async (priceUnit, suffix) => {
    const originals = [0, 15].map(price => ({ ...item(String(price)), price, priceUnit }));
    (getMyUploads as jest.Mock).mockResolvedValue({
      code: 200,
      data: { items: originals, meta: { page: 1, totalPages: 1 } },
    });
    const wrapper = mountPage();
    (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    const prices = wrapper.findAll('.upload-price').map(row => row.text());
    expect(prices).toEqual([`¥15${suffix}`, `¥0${suffix}`]);
    expect(originals.map(dish => dish.priceUnit)).toEqual([priceUnit, priceUnit]);
    wrapper.unmount();
  }
);

test('old and new notifications retain the same row order and shape before and after async responses', async () => {
  const recent = { ...item('recent'), createdAt: '2026-10-11T02:00:00Z' };
  const older = { ...item('older'), createdAt: '2026-10-10T01:00:00Z' };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [recent, older], meta: { page: 1, totalPages: 1 } },
  });
  let finish: ((value: any) => void) | undefined;
  (getMyUpload as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const wrapper = mountPage();
  const names = () => wrapper.findAll('.upload-title').map(row => row.text());
  const show = (id: string) => {
    (onLoad as jest.Mock).mock.calls[0][0]({ id });
    (onShow as jest.Mock).mock.calls[0][0]();
  };
  show('older');
  expect(uni.pageScrollTo).not.toHaveBeenCalled();
  await flushPromises();
  expect(names()).toEqual(['recent菜品', 'older菜品']);
  expect(wrapper.find('#upload-notification-detail').exists()).toBe(false);
  finish?.({ code: 200, data: { ...older, name: 'competing-detail-name', priceUnit: '元/份' } });
  await flushPromises();
  expect(names()).toEqual(['recent菜品', 'older菜品']);
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(1);
  expect(uni.pageScrollTo).toHaveBeenLastCalledWith({ selector: '#upload-older', duration: 200 });
  show('recent');
  await flushPromises();
  expect(names()).toEqual(['recent菜品', 'older菜品']);
  expect(wrapper.findAll('.upload-focused').map(row => row.get('.upload-title').text())).toEqual([
    'recent菜品',
  ]);
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(2);
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(2);
  expect(getMyUpload).not.toHaveBeenCalled();
  wrapper.unmount();
});

test('an off-page notification remains a separate detail and never scrolls a hidden page', async () => {
  const recent = { ...item('recent'), createdAt: '2026-10-11T02:00:00Z' };
  const older = { ...item('older'), createdAt: '2026-10-10T01:00:00Z' };
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [recent], meta: { page: 1, totalPages: 100 } },
  });
  let finish!: (value: any) => void;
  (getMyUpload as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const wrapper = mountPage();
  (onLoad as jest.Mock).mock.calls[0][0]({ id: 'older' });
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  (onHide as jest.Mock).mock.calls[0][0]();
  finish({ code: 200, data: older });
  await flushPromises();
  expect(wrapper.findAll('.uploads-list .upload-title').map(row => row.text())).toEqual([
    'recent菜品',
  ]);
  expect(wrapper.get('#upload-notification-detail').text()).toContain('消息对应记录');
  expect(wrapper.get('#upload-notification-detail .upload-title').text()).toBe('older菜品');
  expect(getMyUploads).toHaveBeenCalledTimes(1);
  expect(uni.pageScrollTo).not.toHaveBeenCalled();
  wrapper.unmount();
});

test.each([
  [{ top: 0, bottom: 180 }, 0],
  [{ top: 300, bottom: 700 }, 0],
  [{ top: -20, bottom: 180 }, 1],
  [{ top: 600, bottom: 760 }, 1],
])('only scrolls a notification record outside the visible viewport: %p', async (rect, scrolls) => {
  measuredRect = rect as typeof measuredRect;
  const wrapper = mountPage();
  (onLoad as jest.Mock).mock.calls[0][0]({ id: 'A' });
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.get('.upload-focused .upload-title').text()).toBe('A菜品');
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(Number(scrolls));
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(Number(scrolls));
  wrapper.unmount();
});

test.each(['hide', 'session', 'target'])(
  'cancels a viewport measurement after %s changes',
  async change => {
    deferMeasurement = true;
    const wrapper = mountPage();
    (onLoad as jest.Mock).mock.calls[0][0]({ id: 'A' });
    (onShow as jest.Mock).mock.calls[0][0]();
    await flushPromises();
    expect(pendingMeasurements).toHaveLength(1);
    if (change === 'hide') (onHide as jest.Mock).mock.calls[0][0]();
    else if (change === 'session') mockUser.sessionVersion++;
    else (onLoad as jest.Mock).mock.calls[0][0]({ id: 'another' });
    pendingMeasurements[0]();
    await flushPromises();
    expect(uni.pageScrollTo).not.toHaveBeenCalled();
    wrapper.unmount();
  }
);

test('shared record rendering preserves edit and confirmed withdrawal actions', async () => {
  const wrapper = mountPage();
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  await wrapper.findAll('.upload-item .upload-action')[0].trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/add-dish/index?uploadId=A' });
  (withdrawMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: null });
  (uni.showModal as jest.Mock).mockImplementation(({ success }) => success({ confirm: true }));
  await wrapper.findAll('.upload-item .upload-action')[1].trigger('click');
  await flushPromises();
  expect(withdrawMyUpload).toHaveBeenCalledWith('A', 1);
  expect(wrapper.get('.upload-item .upload-status').text()).toBe('已撤回');
  wrapper.unmount();
});

test('an empty upload list offers one floating create action without a duplicate empty-state action', async () => {
  (getMyUploads as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, totalPages: 1 } },
  });
  const wrapper = mountPage();
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(wrapper.find('.uploads-heading').exists()).toBe(false);
  expect(wrapper.getComponent({ name: 'EmptyState' }).props('actionText')).toBe('');
  expect(wrapper.getComponent(FloatingActionButton).props('label')).toBe('申请新增菜品');
  await wrapper.getComponent(FloatingActionButton).trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/add-dish/index' });
  mockUser.isLoggedIn = false;
  mockUser.sessionVersion++;
  await flushPromises();
  expect(wrapper.findComponent(FloatingActionButton).exists()).toBe(false);
  wrapper.unmount();
});

test('locating an off-page notification does not fetch the next page until load more is pressed', async () => {
  const recent = { ...item('recent'), createdAt: '2026-10-11T01:00:00Z' };
  const middle = { ...item('middle'), createdAt: '2026-10-10T01:00:00Z' };
  const older = { ...item('older'), createdAt: '2026-10-09T01:00:00Z' };
  (getMyUploads as jest.Mock).mockImplementation(async ({ page }) => ({
    code: 200,
    data: { items: page === 1 ? [recent] : [middle], meta: { page, totalPages: 3 } },
  }));
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: older });
  (uni.pageScrollTo as jest.Mock).mockImplementation(() => {
    for (const [reachBottom] of (onReachBottom as jest.Mock).mock.calls) reachBottom();
  });
  const wrapper = mountPage();
  (onLoad as jest.Mock).mock.calls[0][0]({ id: 'older' });
  (onShow as jest.Mock).mock.calls[0][0]();
  await flushPromises();
  expect(uni.pageScrollTo).toHaveBeenCalledWith({
    selector: '#upload-notification-detail',
    duration: 200,
  });
  expect((getMyUploads as jest.Mock).mock.calls.map(([query]) => query.page)).toEqual([1]);
  expect(wrapper.findAll('.uploads-list .upload-title').map(row => row.text())).toEqual([
    'recent菜品',
  ]);
  await wrapper.get('.uploads-footer .upload-action').trigger('click');
  await flushPromises();
  expect((getMyUploads as jest.Mock).mock.calls.map(([query]) => query.page)).toEqual([1, 2]);
  expect(wrapper.findAll('.uploads-list .upload-title').map(row => row.text())).toEqual([
    'recent菜品',
    'middle菜品',
  ]);
  expect(wrapper.get('#upload-notification-detail .upload-title').text()).toBe('older菜品');
  expect(uni.pageScrollTo).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
