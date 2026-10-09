import { mount } from '@vue/test-utils';
import PlanCard from '@/pages/planning/components/PlanCard.vue';
import PlanDetailDialog from '@/pages/planning/components/PlanDetailDialog.vue';

const plan = {
  id: 'meal',
  startDate: '2099-10-03',
  endDate: '2099-10-06',
  mealTime: 'lunch',
  dishes: [
    {
      id: 'rice',
      name: '一份很长名称的菜品，保留完整内容方便辨认',
      price: 12,
      priceUnit: '两',
      images: [],
      averageRating: 0,
    },
  ],
  isCompleted: false,
  isExpired: false,
  dishesReady: true,
} as any;

test('plan cards retain the date range and mark-eaten action without opening details', async () => {
  const wrapper = mount(PlanCard, { props: { plan } });
  expect(wrapper.text()).toContain('10月03日 — 10月06日');
  expect(wrapper.text()).toContain(plan.dishes[0].name);
  expect(wrapper.text()).toContain('¥12/两');
  expect(wrapper.text()).toContain('所列单价合计 ¥12.00');
  expect(wrapper.find('.meal-card-image').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('暂无图片');
  await wrapper.find('.meal-card-complete').trigger('tap');
  expect(wrapper.emitted('execute')).toHaveLength(1);
  expect(wrapper.emitted('view')).toBeUndefined();
  await wrapper.setProps({ isHistory: true, plan: { ...plan, isCompleted: true } });
  expect(wrapper.text()).toContain('已标记吃过');
  expect(wrapper.find('.meal-card-complete').exists()).toBe(false);
  wrapper.unmount();
});

test('plan details preserve multi-day information and navigate to the selected dish', async () => {
  (global as any).uni.navigateTo = jest.fn();
  const wrapper = mount(PlanDetailDialog, { props: { visible: true, plan } });
  expect(wrapper.text()).toContain('2099年10月03日 — 2099年10月06日');
  expect(wrapper.text()).toContain('¥12/两');
  expect(wrapper.text()).toContain('所列单价合计 ¥12.00');
  expect(wrapper.find('.meal-detail-image').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('暂无图片');
  await wrapper.find('.meal-detail-dish').trigger('tap');
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=rice' });
  wrapper.unmount();
});

test.each([
  ['card', PlanCard],
  ['detail', PlanDetailDialog],
] as const)(
  '%s retries a new image resource for the same dish after the old URL fails',
  async (_name, component) => {
    const withImage = (url: string) => ({
      ...plan,
      dishes: [{ ...plan.dishes[0], images: [url] }],
    });
    const wrapper = mount(component as any, {
      props: { visible: true, plan: withImage('https://images.test/old.jpg') },
    });
    await wrapper.get('image').trigger('error');
    expect(wrapper.find('image').exists()).toBe(false);
    expect(wrapper.find('.meal-card-image, .meal-detail-image').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('暂无图片');
    await wrapper.setProps({ plan: withImage('https://images.test/current.jpg') });
    expect(wrapper.get('image').attributes('src')).toBe('https://images.test/current.jpg');
    wrapper.unmount();
  }
);
