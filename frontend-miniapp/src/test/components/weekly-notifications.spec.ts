import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import Page from '@/pages/notifications/weekly.vue';
import { getWeeklyNotificationCollection } from '@/api/modules/notifications';
import { useUserStore } from '@/store/modules/use-user-store';
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
}));
jest.mock('@/api/modules/notifications', () => ({ getWeeklyNotificationCollection: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
const wrappers: any[] = [];
let user: any;
beforeEach(() => {
  jest.clearAllMocks();
  user = reactive({ isLoggedIn: true, sessionVersion: 0 });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
async function page() {
  const wrapper = mount(Page);
  wrappers.push(wrapper);
  (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({ week: '2026-10-05' });
  (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  return wrapper;
}
test('renders dishes from the notified weekly collection without synthesized entries', async () => {
  (getWeeklyNotificationCollection as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      weekKey: '2026-10-05',
      publishedAt: '2026-10-05T00:00:00Z',
      items: [
        {
          id: 'real',
          name: '清蒸鱼',
          canteenName: '紫荆园',
          windowName: '二层',
          images: [],
          price: 12,
          priceUnit: '份',
        },
      ],
    },
  });
  const wrapper = await page();
  expect(getWeeklyNotificationCollection).toHaveBeenCalledWith('2026-10-05');
  expect(wrapper.findAll('.weekly-dish')).toHaveLength(1);
  expect(wrapper.text()).toContain('清蒸鱼');
  await wrapper.get('.weekly-dish').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=real' });
});
test('expired or withdrawn collections remain an explicit load error with retry', async () => {
  (getWeeklyNotificationCollection as jest.Mock).mockRejectedValue(new Error('本期推荐不存在'));
  const wrapper = await page();
  expect(wrapper.text()).toContain('本期推荐不存在');
  expect(wrapper.find('.weekly-dish').exists()).toBe(false);
  expect(wrapper.get('.error-feedback__action').text()).toBe('重新加载');
});
