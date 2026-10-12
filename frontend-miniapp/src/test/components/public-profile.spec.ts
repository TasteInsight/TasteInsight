import { flushPromises, shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import Page from '@/pages/profile/public.vue';
import { getPublicProfile, getPublicMealPlans, getPosts } from '@/api/modules/social';
import { useUserStore } from '@/store/modules/use-user-store';
jest.mock('@dcloudio/uni-app', () => ({
  onLoad: jest.fn(),
  onShow: jest.fn(),
  onHide: jest.fn(),
  onPullDownRefresh: jest.fn(),
  onReachBottom: jest.fn(),
  onBackPress: jest.fn(),
}));
jest.mock('@/api/modules/social', () => ({
  getPublicProfile: jest.fn(),
  getPublicMealPlans: jest.fn(),
  getPosts: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/utils/student-access', () => ({ requireStudent: jest.fn(() => true) }));
let user: any;
const wrappers: any[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  [getPublicProfile, getPublicMealPlans, getPosts].forEach(mock => (mock as jest.Mock).mockReset());
  user = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: { id: 'A', bio: '私有简介' },
    updateProfileAction: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (getPublicProfile as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      id: 'A',
      nickname: '同学A',
      avatar: '',
      bio: '',
      isVerifiedStudent: false,
      postCount: 0,
    },
  });
  (getPosts as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [], meta: { page: 1, totalPages: 0 } },
  });
  (getPublicMealPlans as jest.Mock).mockResolvedValue({ code: 200, data: { items: [] } });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
async function page(id = 'A') {
  const wrapper = shallowMount(Page);
  wrappers.push(wrapper);
  (onLoad as jest.Mock).mock.calls.slice(-1)[0][0]({ id });
  (onShow as jest.Mock).mock.calls.slice(-1)[0][0]();
  await flushPromises();
  return wrapper;
}
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<any>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}
async function press(button: any, key = 'Enter') {
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  button.element.dispatchEvent(down);
  await button.trigger('keydown', { key, repeat: true });
  await button.trigger('keyup', { key });
  await button.trigger('keyup', { key });
  await flushPromises();
  return down;
}
function publicPlan(id: string, dishId = 'dish') {
  return {
    id,
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    mealTime: 'lunch',
    dishes: [
      { id: dishId, name: '番茄炒蛋', images: [], canteenName: '紫荆园', windowName: '家常菜' },
    ],
  };
}
test('visitor preview and another profile both read only public posts', async () => {
  const own = await page();
  expect(getPosts).toHaveBeenLastCalledWith({ authorId: 'A', page: 1, pageSize: 20 }, false);
  own.unmount();
  await page('B');
  expect(getPosts).toHaveBeenLastCalledWith({ authorId: 'B', page: 1, pageSize: 20 }, false);
});
test('does not substitute a private biography for redacted public profile data', async () => {
  const wrapper = await page();
  expect(wrapper.text()).not.toContain('私有简介');
  expect(wrapper.text()).not.toContain('已认证学生');
  expect(wrapper.find('.public-edit').exists()).toBe(false);
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
});
test('public plans render only the safe summary and navigate to a dish', async () => {
  (getPublicMealPlans as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      items: [
        {
          id: 'plan',
          startDate: '2026-10-10',
          endDate: '2026-10-10',
          mealTime: 'lunch',
          dishes: [
            {
              id: 'dish',
              name: '番茄炒蛋',
              images: [],
              canteenName: '紫荆园',
              windowName: '家常菜',
            },
          ],
        },
      ],
    },
  });
  const wrapper = await page('B');
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  expect(wrapper.text()).toContain('番茄炒蛋');
  expect(wrapper.text()).toContain('午餐');
  expect(wrapper.text()).not.toMatch(/执行|完成|删除安排/);
  await wrapper.get('.public-dish').trigger('click');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=dish' });
});
test('visitor data excludes private identifiers and never exposes edit controls after an account switch', async () => {
  user.userInfo = {
    id: 'A',
    bio: 'A 私有简介',
    phone: '13800138000',
    email: 'a@example.edu',
    studentId: '20260001',
  };
  const wrapper = await page();
  expect(wrapper.text()).not.toMatch(/13800138000|a@example.edu|20260001|A 私有简介/);
  user.userInfo = { id: 'B', bio: '' };
  user.sessionVersion++;
  await flushPromises();
  expect(wrapper.find('textarea').exists()).toBe(false);
  expect(wrapper.find('.public-edit').exists()).toBe(false);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
});

test('public content tabs are focusable and keyboard activation fires once per press', async () => {
  const wrapper = await page('B');
  const tabs = wrapper.findAll('[role="tab"]');
  expect(tabs.map(button => button.attributes('tabindex'))).toEqual(['0', '0']);
  await tabs[1].trigger('keyup', { key: 'Enter' });
  expect(getPublicMealPlans).not.toHaveBeenCalled();
  expect((await press(tabs[1])).defaultPrevented).toBe(true);
  expect(getPublicMealPlans).toHaveBeenCalledTimes(1);
  expect(getPublicMealPlans).toHaveBeenLastCalledWith('B', { page: 1, pageSize: 20 });
  expect(tabs[1].attributes('aria-selected')).toBe('true');
  expect((await press(tabs[0], ' ')).defaultPrevented).toBe(true);
  expect(tabs[0].attributes('aria-selected')).toBe('true');
  expect(getPosts).toHaveBeenCalledTimes(1);
});

test('profile retry is keyboard accessible and keeps the profile request argument', async () => {
  (getPublicProfile as jest.Mock).mockRejectedValueOnce(new Error('主页读取失败'));
  const wrapper = await page('B');
  const retry = wrapper.get('.campus-error button');
  expect(retry.attributes('tabindex')).toBe('0');
  expect(retry.attributes('role')).toBe('button');
  await press(retry, ' ');
  expect(getPublicProfile).toHaveBeenCalledTimes(2);
  expect(getPublicProfile).toHaveBeenLastCalledWith('B');
});

test('post pagination ignores disabled presses and keyboard retry requests the failed append page once', async () => {
  (getPosts as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: [{ id: 'post' }], meta: { page: 1, totalPages: 2 } },
  });
  const wrapper = await page('B');
  const pending = deferred();
  (getPosts as jest.Mock).mockReturnValueOnce(pending.promise);
  const more = wrapper.get('.campus-more');
  expect(more.attributes('tabindex')).toBe('0');
  await press(more);
  expect(getPosts).toHaveBeenCalledTimes(2);
  expect(getPosts).toHaveBeenLastCalledWith({ authorId: 'B', page: 2, pageSize: 20 }, false);
  expect(more.attributes()).toHaveProperty('disabled');
  expect(more.attributes('tabindex')).toBe('-1');
  await press(more, ' ');
  expect(getPosts).toHaveBeenCalledTimes(2);
  pending.reject(new Error('动态追加失败'));
  await flushPromises();
  (getPosts as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: [{ id: 'next' }], meta: { page: 2, totalPages: 2 } },
  });
  const retry = wrapper.get('.campus-error button');
  expect(retry.attributes('tabindex')).toBe('0');
  await press(retry, ' ');
  expect(getPosts).toHaveBeenCalledTimes(3);
  expect(getPosts).toHaveBeenLastCalledWith({ authorId: 'B', page: 2, pageSize: 20 }, false);
});

test('plan pagination and retry preserve page arguments and disabled keyboard semantics', async () => {
  (getPublicMealPlans as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: Array.from({ length: 20 }, (_, index) => publicPlan('plan-' + index)) },
  });
  const wrapper = await page('B');
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  const pending = deferred();
  (getPublicMealPlans as jest.Mock).mockReturnValueOnce(pending.promise);
  const more = wrapper.get('.campus-more');
  expect(more.attributes('tabindex')).toBe('0');
  await press(more, ' ');
  expect(getPublicMealPlans).toHaveBeenCalledTimes(2);
  expect(getPublicMealPlans).toHaveBeenLastCalledWith('B', { page: 2, pageSize: 20 });
  expect(more.attributes()).toHaveProperty('disabled');
  expect(more.attributes('tabindex')).toBe('-1');
  await press(more);
  expect(getPublicMealPlans).toHaveBeenCalledTimes(2);
  pending.reject(new Error('计划追加失败'));
  await flushPromises();
  (getPublicMealPlans as jest.Mock).mockResolvedValueOnce({ code: 200, data: { items: [] } });
  const retry = wrapper.get('.campus-error button');
  expect(retry.attributes('tabindex')).toBe('0');
  await press(retry);
  expect(getPublicMealPlans).toHaveBeenCalledTimes(3);
  expect(getPublicMealPlans).toHaveBeenLastCalledWith('B', { page: 2, pageSize: 20 });
});

test('each plan dish supports keyboard navigation with its encoded ID and clears a blurred press', async () => {
  (getPublicMealPlans as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: { items: [publicPlan('first', 'dish/one?x=1'), publicPlan('second', 'dish-two')] },
  });
  const wrapper = await page('B');
  await wrapper.findAll('[role="tab"]')[1].trigger('click');
  await flushPromises();
  const dishes = wrapper.findAll('.public-dish');
  expect(dishes.map(button => button.attributes('tabindex'))).toEqual(['0', '0']);
  await dishes[0].trigger('keydown', { key: 'Enter' });
  await dishes[0].trigger('blur');
  await dishes[0].trigger('keyup', { key: 'Enter' });
  expect(uni.navigateTo).not.toHaveBeenCalled();
  await press(dishes[0]);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  expect(uni.navigateTo).toHaveBeenLastCalledWith({
    url: '/pages/dish/index?id=dish%2Fone%3Fx%3D1',
  });
  await press(dishes[1], ' ');
  expect(uni.navigateTo).toHaveBeenCalledTimes(2);
  expect(uni.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/dish/index?id=dish-two' });
});
