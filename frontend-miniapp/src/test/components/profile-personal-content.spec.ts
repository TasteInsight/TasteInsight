import { flushPromises, mount, shallowMount } from '@vue/test-utils';
import { reactive } from 'vue';
import ProfilePlans from '@/pages/profile/components/ProfilePlans.vue';
import ProfileBioEditor from '@/pages/profile/components/ProfileBioEditor.vue';
import UserHeader from '@/pages/profile/components/UserHeader.vue';
import SettingsPage from '@/pages/settings/index.vue';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';

jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onHide: jest.fn(),
  onBackPress: jest.fn(),
}));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
jest.mock('@/store/modules/use-plan-store', () => ({ usePlanStore: jest.fn() }));

let user: any;
let plans: any;
const wrappers: any[] = [];
const deferred = () => {
  let resolve!: (value?: any) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<any>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
};
const mountPage = (component: any, options = {}) => {
  const wrapper = shallowMount(component, {
    global: { stubs: { AsyncState: false, LoginGate: false, EmptyState: false } },
    ...options,
  });
  wrappers.push(wrapper);
  return wrapper;
};
async function changeVisibility(wrapper: any, value: boolean) {
  await wrapper.get('switch').trigger('change', { detail: { value } });
  await flushPromises();
}
beforeEach(() => {
  jest.clearAllMocks();
  user = reactive({
    sessionVersion: 0,
    isLoggedIn: true,
    userInfo: {
      id: 'A',
      nickname: '同学A',
      bio: '喜欢家常菜',
      capabilities: { canContribute: true },
      settings: { showMealPlans: false },
    },
    fetchProfileAction: jest.fn(),
    updateProfileAction: jest.fn().mockImplementation(async payload => {
      user.userInfo = {
        ...user.userInfo,
        ...payload,
        settings: { ...user.userInfo.settings, ...payload.settings },
      };
    }),
    logoutAction: jest.fn(),
  });
  plans = reactive({
    loading: false,
    initialized: false,
    error: null,
    currentPlans: [],
    historyPlans: [],
    fetchPlans: jest.fn().mockResolvedValue(undefined),
  });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  (usePlanStore as unknown as jest.Mock).mockReturnValue(plans);
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('viewing plans never opts in and waits for a successful read before showing empty', async () => {
  const wrapper = mountPage(ProfilePlans);
  expect(wrapper.get('switch').attributes('checked')).toBe('false');
  expect(wrapper.findComponent(EmptyState).exists()).toBe(false);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
  plans.error = '计划读取失败';
  plans.initialized = true;
  await flushPromises();
  expect(wrapper.text()).toContain('计划读取失败');
  expect(wrapper.findComponent(EmptyState).exists()).toBe(false);
  plans.error = null;
  await flushPromises();
  expect(wrapper.getComponent(EmptyState).props('title')).toBe('还没有饮食计划');
});

test('plan content reuses actual dish cards and keeps plan management in its existing tab', async () => {
  const dish = { id: 'dish', name: '番茄炒蛋' };
  plans.currentPlans = [
    {
      id: 'plan',
      startDate: '2026-10-10',
      endDate: '2026-10-10',
      mealTime: 'lunch',
      dishes: [dish],
      dishesReady: true,
    },
  ];
  plans.initialized = true;
  const wrapper = mountPage(ProfilePlans);
  expect(wrapper.getComponent(DishSummaryCard).props('dish')).toEqual(dish);
  expect(wrapper.text()).toContain('10月10日 · 午餐');
  await wrapper.get('.profile-plan-toolbar button').trigger('click');
  expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/planning/index' });
  wrapper.getComponent(DishSummaryCard).vm.$emit('select', 'dish');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=dish' });
});

test('the visibility switch writes only the global setting and restores it after a failed write', async () => {
  const wrapper = mountPage(ProfilePlans);
  await changeVisibility(wrapper, true);
  expect(user.updateProfileAction).toHaveBeenCalledWith({ settings: { showMealPlans: true } });
  expect(wrapper.get('switch').attributes('checked')).toBe('true');
  expect(uni.showToast).not.toHaveBeenCalled();
  user.updateProfileAction.mockRejectedValueOnce(new Error('设置保存失败'));
  await changeVisibility(wrapper, false);
  expect(wrapper.get('switch').attributes('checked')).toBe('true');
  expect(uni.showToast).toHaveBeenLastCalledWith({ title: '设置保存失败', icon: 'none' });
});

test('expired student access cannot enable public display but can still disable it', async () => {
  user.userInfo.capabilities.canContribute = false;
  const wrapper = mountPage(ProfilePlans);
  expect(wrapper.get('switch').attributes('disabled')).toBe('true');
  await changeVisibility(wrapper, true);
  expect(user.updateProfileAction).not.toHaveBeenCalled();
  user.userInfo.settings.showMealPlans = true;
  await flushPromises();
  expect(wrapper.get('switch').attributes('disabled')).toBe('false');
  await changeVisibility(wrapper, false);
  expect(user.updateProfileAction).toHaveBeenCalledWith({ settings: { showMealPlans: false } });
});

test('stale visibility writes cannot alter the next account switch or show feedback', async () => {
  const pending = deferred();
  user.updateProfileAction.mockReturnValue(pending.promise);
  const wrapper = mountPage(ProfilePlans);
  await changeVisibility(wrapper, true);
  user.userInfo = {
    id: 'B',
    settings: { showMealPlans: false },
    capabilities: { canContribute: false },
  };
  user.sessionVersion++;
  await flushPromises();
  pending.resolve();
  await flushPromises();
  expect(wrapper.get('switch').attributes('checked')).toBe('false');
  expect(wrapper.get('switch').attributes('disabled')).toBe('true');
  expect(uni.showToast).not.toHaveBeenCalled();
});

test('a hidden plans pane does not emit a delayed save toast', async () => {
  const pending = deferred();
  user.updateProfileAction.mockReturnValue(pending.promise);
  const wrapper = mountPage(ProfilePlans);
  await changeVisibility(wrapper, true);
  await wrapper.setProps({ active: false });
  pending.reject(new Error('隐藏页面失败'));
  await flushPromises();
  expect(uni.showToast).not.toHaveBeenCalled();
});

test('biography edits stay in the personal space, retain failed input, and save through the account store', async () => {
  const wrapper = mountPage(ProfileBioEditor);
  expect(wrapper.get('textarea').attributes('maxlength')).toBe('160');
  await wrapper.get('textarea').setValue('新的简介');
  user.updateProfileAction.mockRejectedValueOnce(new Error('网络中断'));
  await wrapper.get('.profile-bio-save').trigger('click');
  await flushPromises();
  expect(wrapper.get('textarea').element.value).toBe('新的简介');
  expect(wrapper.text()).toContain('网络中断');
  expect(wrapper.emitted('close')).toBeUndefined();
  await wrapper.get('.profile-bio-save').trigger('click');
  await flushPromises();
  expect(user.updateProfileAction).toHaveBeenLastCalledWith({ bio: '新的简介' });
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('changing accounts clears the biography draft and rejects delayed save feedback', async () => {
  const pending = deferred();
  user.updateProfileAction.mockReturnValue(pending.promise);
  const wrapper = mountPage(ProfileBioEditor);
  await wrapper.get('textarea').setValue('A 未保存的简介');
  await wrapper.get('.profile-bio-save').trigger('click');
  user.userInfo = { id: 'B', bio: '' };
  user.sessionVersion++;
  await flushPromises();
  expect(wrapper.get('textarea').element.value).toBe('');
  expect(wrapper.emitted('close')).toHaveLength(1);
  pending.resolve();
  await flushPromises();
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('compact profile header preserves biography and verified identity through one profile action', async () => {
  const wrapper = mountPage(UserHeader, {
    props: { userInfo: user.userInfo, isLoggedIn: true, loading: false },
  });
  expect(wrapper.text()).toContain('喜欢家常菜');
  expect(wrapper.get('.user-summary').attributes('aria-label')).toContain('已认证学生');
  expect(wrapper.text()).not.toMatch(/粉丝|关注|获赞/);
  expect(wrapper.findAll('button')).toHaveLength(1);
  await wrapper.get('.user-summary').trigger('keydown', { key: 'Enter' });
  await wrapper.get('.user-summary').trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('manage')).toEqual([[]]);
  expect(uni.navigateTo).not.toHaveBeenCalled();
});

test('settings group account, food, app and public information while keeping reports at the bottom', async () => {
  const wrapper = mountPage(SettingsPage);
  expect(wrapper.findAll('.group-title').map(item => item.text())).toEqual([
    '账号与身份',
    '饮食与推荐',
    '应用偏好',
    '关于',
    '反馈与举报',
  ]);
  expect(wrapper.text()).toContain('退出登录');
  const destinations = [
    ['个人信息', '/pages/settings/components/personal'],
    ['账号与校园身份', '/pages/profile/identity'],
    ['过敏原', '/pages/settings/components/allergens'],
    ['饮食偏好', '/pages/settings/components/preferences'],
    ['显示设置', '/pages/settings/components/display'],
    ['通知设置', '/pages/settings/components/notifications'],
    ['关于食鉴', '/pages/settings/about'],
    ['我的举报', '/pages/profile/my-reports/index'],
  ];
  for (const [label, path] of destinations) {
    await wrapper
      .findAll('.settings-menu')
      .find(item => item.text() === label)!
      .trigger('click');
    expect(uni.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: path }));
  }
  const groups = wrapper.findAll('.settings-section');
  expect(groups.at(-1)!.text()).toContain('我的举报');
  expect(groups.at(-1)!.text()).toContain('项目反馈');
  expect(groups.find(group => group.text().startsWith('关于'))!.text()).not.toContain('我的举报');
});

test('guests can reach agreements through about and use feedback while private destinations follow login state', async () => {
  const wrapper = mountPage(SettingsPage);
  user.isLoggedIn = false;
  user.userInfo = null;
  await flushPromises();
  expect(wrapper.findAll('.settings-menu').map(item => item.text())).toEqual([
    '登录',
    '关于食鉴',
    '项目反馈复制链接',
  ]);
  expect(wrapper.text()).not.toContain('我的举报');
  expect(wrapper.text()).not.toContain('退出登录');
  expect(wrapper.text()).not.toContain('账号与身份');
  const about = wrapper.findAll('.settings-menu').find(item => item.text() === '关于食鉴')!;
  await about.trigger('click');
  expect(uni.navigateTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ url: '/pages/settings/about' })
  );
  user.isLoggedIn = true;
  await flushPromises();
  expect(wrapper.text()).toContain('我的举报');
  expect(wrapper.text()).toContain('账号与校园身份');
  expect(wrapper.findAll('.settings-menu').some(item => item.text() === '登录')).toBe(false);
});

test.each(['click', 'Enter', ' '])(
  'guest settings opens the existing login flow using %s',
  async action => {
    user.isLoggedIn = false;
    const wrapper = mountPage(SettingsPage);
    const login = wrapper.findAll('.settings-menu').find(item => item.text() === '登录')!;
    expect(login.classes()).toEqual(
      expect.arrayContaining(['settings-button', 'settings-menu', 'list-row-action'])
    );
    if (action === 'click') await login.trigger('click');
    else {
      await login.trigger('keydown', { key: action });
      await login.trigger('keyup', { key: action });
    }
    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/login/index' })
    );
    (uni.navigateTo as jest.Mock).mock.calls[0][0].complete();
  }
);

test.each(['Enter', ' '])(
  'project feedback copies its declared link using %s and reports clipboard failure',
  async key => {
    Object.assign(uni, { setClipboardData: jest.fn() });
    user.isLoggedIn = false;
    const wrapper = mountPage(SettingsPage);
    const feedback = wrapper
      .findAll('.settings-menu')
      .find(item => item.text() === '项目反馈复制链接')!;
    await feedback.trigger('keydown', { key });
    await feedback.trigger('keyup', { key });
    expect(uni.setClipboardData).toHaveBeenCalledTimes(1);
    expect(uni.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'https://github.com/TasteInsight/TasteInsight/issues',
      })
    );
    expect(uni.navigateTo).not.toHaveBeenCalled();
    (uni.setClipboardData as jest.Mock).mock.calls[0][0].fail();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '复制失败，请重试', icon: 'none' });
  }
);

test('saved current and historical plans retain offline status, cents, units and incomplete dish semantics', async () => {
  const dish = {
    id: 'dish',
    name: '番茄炒蛋',
    images: [],
    price: 10.01,
    priceUnit: '元/100g',
    status: 'offline',
    averageRating: 0,
    calories: 0,
    protein: null,
  };
  const plan = {
    id: 'current',
    startDate: '2099-10-10',
    endDate: '2099-10-10',
    mealTime: 'lunch',
    dishes: [dish],
    dishesReady: true,
  };
  plans.currentPlans = [plan];
  plans.historyPlans = [
    { ...plan, id: 'history', dishes: [{ ...dish }], isExpired: true },
    { ...plan, id: 'missing', dishes: [], dishesReady: false },
  ];
  const wrapper = mount(ProfilePlans);
  wrappers.push(wrapper);
  expect(wrapper.findAll('.dish-card__price').map(item => item.text())).toEqual([
    '¥10.01/100g',
    '¥10.01/100g',
  ]);
  expect(wrapper.findAll('.tag-badge--neutral')).toHaveLength(2);
  expect(wrapper.text()).toContain('菜品资料尚未完整载入');
  expect(wrapper.text()).not.toContain('¥0.00');
  plans.currentPlans[0].dishes[0] = { ...dish, status: 'online', price: 0, priceUnit: null };
  await flushPromises();
  expect(wrapper.findAll('.dish-card__price')[0].text()).toBe('¥0.00');
  expect(wrapper.findAll('.tag-badge--neutral')).toHaveLength(1);
});

test('plans show their first loading state while keeping the visibility control available', async () => {
  plans.loading = true;
  const wrapper = mountPage(ProfilePlans);
  expect(wrapper.text()).toContain('正在加载计划…');
  expect(wrapper.find('switch').exists()).toBe(true);
  expect(wrapper.text()).not.toContain('还没有饮食计划');
  plans.initialized = true;
  await flushPromises();
  expect(wrapper.text()).not.toContain('还没有饮食计划');
});
