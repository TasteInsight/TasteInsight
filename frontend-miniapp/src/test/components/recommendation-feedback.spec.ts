import { flushPromises, mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import RecommendItem from '@/pages/index/components/RecommendItem.vue';
import { logRecommendationFeedback } from '@/api/modules/recommendation';
import { createRecommendationFeedback } from '@/composables/use-recommendation-feedback';
import { useUserStore } from '@/store/modules/use-user-store';
jest.mock('@/api/modules/recommendation', () => ({ logRecommendationFeedback: jest.fn() }));
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: jest.fn() }));
const api = logRecommendationFeedback as jest.Mock;
let callback: (entry: { intersectionRatio: number }) => void;
let disconnect: jest.Mock;
let user: { isLoggedIn: boolean; sessionVersion: number };
beforeEach(() => {
  jest.clearAllMocks();
  user = reactive({ isLoggedIn: true, sessionVersion: 1 });
  (useUserStore as unknown as jest.Mock).mockReturnValue(user);
  api.mockResolvedValue({ code: 200 });
  disconnect = jest.fn();
  (uni as any).createIntersectionObserver = jest.fn(() => ({
    disconnect,
    relativeToViewport() {
      return this;
    },
    observe: (_: string, cb: typeof callback) => {
      callback = cb;
    },
  }));
});
afterEach(() => jest.useRealTimers());
const mountCard = () =>
  mount(RecommendItem, {
    props: { dish: { id: 'dish' } as any, deliveryId: 'delivery', active: true, sessionVersion: 1 },
    global: {
      stubs: {
        DishSummaryCard: { template: "<button @click=\"$emit('select', 'dish')\">dish</button>" },
      },
    },
  });
test('delivery alone does not count; half-visible card produces one impression', async () => {
  const wrapper = mountCard();
  await flushPromises();
  expect(api).not.toHaveBeenCalled();
  callback({ intersectionRatio: 0 });
  callback({ intersectionRatio: 0.4 });
  expect(api).not.toHaveBeenCalled();
  callback({ intersectionRatio: 0.6 });
  callback({ intersectionRatio: 1 });
  await flushPromises();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith({
    deliveryId: 'delivery',
    dishId: 'dish',
    eventType: 'impression',
  });
  await wrapper.find('button').trigger('click');
  expect(api).toHaveBeenCalledWith({ deliveryId: 'delivery', dishId: 'dish', eventType: 'click' });
  expect(uni.navigateTo).toHaveBeenCalledWith({
    url: '/pages/dish/index?id=dish&deliveryId=delivery&recommendationSession=1',
  });
  wrapper.unmount();
  expect(disconnect).toHaveBeenCalled();
});
test('hidden, refreshed, and old audience observers cannot emit stale impressions', async () => {
  const wrapper = mountCard();
  await flushPromises();
  const old = callback;
  await wrapper.setProps({ active: false });
  old({ intersectionRatio: 1 });
  expect(api).not.toHaveBeenCalled();
  await wrapper.setProps({ active: true, deliveryId: 'next' });
  await flushPromises();
  old({ intersectionRatio: 1 });
  expect(api).not.toHaveBeenCalled();
  const next = callback;
  user.sessionVersion += 1;
  next({ intersectionRatio: 1 });
  await nextTick();
  next({ intersectionRatio: 1 });
  expect(api).not.toHaveBeenCalled();
  wrapper.unmount();
});
test('retries retain server deduplication identity and reset cancels queued retries', async () => {
  jest.useFakeTimers();
  api.mockRejectedValue(new Error('network'));
  const tracker = createRecommendationFeedback(() => true);
  const event = { deliveryId: 'delivery', dishId: 'dish', eventType: 'impression' as const };
  tracker.send(event);
  await flushPromises();
  jest.advanceTimersByTime(1000);
  await flushPromises();
  expect(api.mock.calls).toEqual([[event], [event]]);
  tracker.reset();
  jest.advanceTimersByTime(5000);
  await flushPromises();
  expect(api).toHaveBeenCalledTimes(2);
});

test('navigation hides observation while an already recorded click can retry in its original session', async () => {
  jest.useFakeTimers();
  api.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ code: 200 });
  const wrapper = mountCard();
  await flushPromises();
  await wrapper.find('button').trigger('click');
  await flushPromises();
  await wrapper.setProps({ active: false });
  jest.advanceTimersByTime(1000);
  await flushPromises();
  expect(api).toHaveBeenCalledTimes(2);
  expect(api.mock.calls[0][0]).toEqual(api.mock.calls[1][0]);
  wrapper.unmount();
});
