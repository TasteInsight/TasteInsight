import { createPinia, setActivePinia } from 'pinia';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { onShow } from '@dcloudio/uni-app';
import PlanningPage from '@/pages/planning/index.vue';
import ChatPage from '@/pages/ai-chat/index.vue';
import { getMealPlans } from '@/api/modules/meal-plan';
import { createAISession } from '@/api/modules/ai';
import { useUserStore } from '@/store/modules/use-user-store';
import { usePlanStore } from '@/store/modules/use-plan-store';
import { useChatStore } from '@/store/modules/use-chat-store';
jest.mock('@dcloudio/uni-app', () => ({
  onShow: jest.fn(),
  onHide: jest.fn(),
  onBackPress: jest.fn(),
  onPullDownRefresh: jest.fn(),
}));
jest.mock('@/api/modules/meal-plan', () => ({ getMealPlans: jest.fn() }));
jest.mock('@/api/modules/ai', () => ({
  createAISession: jest.fn(),
  getAISuggestions: jest.fn().mockResolvedValue({ code: 200, data: { suggestions: [] } }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(uni, {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    navigateTo: jest.fn(options => options.complete?.({ errMsg: 'navigateTo:ok' })),
    $on: jest.fn(),
    $off: jest.fn(),
  });
  (global as any).getCurrentPages = () => [];
  setActivePinia(createPinia());
});
afterEach(() => {
  delete (global as any).getCurrentPages;
});
test.each([
  ['planning', PlanningPage],
  ['chat', ChatPage],
] as const)(
  '%s waits for explicit login and never requests private data as a guest',
  async (_, Page) => {
    const wrapper = shallowMount(Page, { global: { stubs: { EmptyState: false } } });
    for (const [show] of (onShow as jest.Mock).mock.calls) show();
    await flushPromises();
    expect(getMealPlans).not.toHaveBeenCalled();
    expect(createAISession).not.toHaveBeenCalled();
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('登录后');
    await wrapper.get('.empty-state__action').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/login/index' })
    );
    wrapper.unmount();
  }
);
test('private stores do not bypass the guest boundary when invoked directly', async () => {
  expect(useUserStore().isLoggedIn).toBe(false);
  await usePlanStore().fetchPlans();
  expect(await useChatStore().initSession()).toBe(false);
  expect(getMealPlans).not.toHaveBeenCalled();
  expect(createAISession).not.toHaveBeenCalled();
});
