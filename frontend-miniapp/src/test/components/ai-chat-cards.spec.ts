import { mount } from '@vue/test-utils';
import PlanningCard from '@/pages/ai-chat/components/PlanningCard.vue';
import DishCard from '@/pages/ai-chat/components/DishCard.vue';
import CanteenCard from '@/pages/ai-chat/components/CanteenCard.vue';
import WindowCard from '@/pages/ai-chat/components/WindowCard.vue';

test('planning card exposes units and list-price meaning without invented or failed images', async () => {
  const wrapper = mount(PlanningCard, {
    props: {
      plan: {
        previewData: {
          startDate: '2099-10-03',
          endDate: '2099-10-04',
          mealTime: 'lunch',
          dishes: [
            { id: 'a', name: '无图菜品', price: 12, priceUnit: '份', images: [], averageRating: 0 },
            {
              id: 'b',
              name: '有图菜品',
              price: 8,
              priceUnit: '两',
              images: ['https://images.test/food.jpg'],
            },
          ],
        },
      } as any,
    },
  });
  await wrapper.get('button[aria-expanded]').trigger('click');
  expect(wrapper.findAll('.planning-dish-image')).toHaveLength(1);
  const pictured = wrapper.findAll('.planning-dish')[1];
  expect(pictured.element.firstElementChild?.classList.contains('planning-dish-info')).toBe(true);
  expect(pictured.element.lastElementChild?.classList.contains('planning-dish-image')).toBe(true);
  expect(wrapper.text()).toContain('¥12.0/份');
  expect(wrapper.text()).toContain('所列单价合计');
  expect(wrapper.text()).toContain('暂无评分');
  await wrapper.get('.planning-dish-image').trigger('error');
  expect(wrapper.find('.planning-dish-image').exists()).toBe(false);
  wrapper.unmount();
});

test('dish recommendation retains full names/reasons/tags and zero is unrated without fabricated fields', () => {
  const name = '非常长的香菇鸡肉米饭名称'.repeat(5);
  const reason = '含蔬菜与蛋白质的午餐选择'.repeat(5);
  const wrapper = mount(DishCard, {
    props: {
      dish: {
        dish: { id: 'a', name, rating: '0', image: '', tags: ['清淡'] },
        recommendReason: reason,
      },
    },
  });
  expect(wrapper.text()).toContain(name);
  expect(wrapper.text()).toContain(reason);
  expect(wrapper.text()).toContain('清淡');
  expect(wrapper.text()).toContain('暂无评分');
  expect(wrapper.text()).not.toContain('¥');
  expect(wrapper.find('image, img').exists()).toBe(false);
  wrapper.unmount();
});

test('only a positive dish rating shows the decorative gold star', async () => {
  const dish = { dish: { id: 'a', name: '香菇鸡肉饭', rating: '4.2', image: '', tags: [] } };
  const wrapper = mount(DishCard, { props: { dish } });
  expect(wrapper.get('.dish-rating-star').attributes('src')).toBe('/static/icons/star.png');
  expect(wrapper.get('.dish-rating-star').attributes('aria-hidden')).toBe('true');
  expect(wrapper.text()).toContain('4.2');
  await wrapper.setProps({ dish: { dish: { ...dish.dish, rating: '0' } } });
  expect(wrapper.find('.dish-rating-star').exists()).toBe(false);
  expect(wrapper.text()).toContain('暂无评分');
  wrapper.unmount();
});

test('dish imagery is right of the details, disappears on error and accepts a new URL', async () => {
  const dish = {
    dish: { id: 'a', name: '菜品', rating: '0', image: 'https://images.test/a.jpg', tags: [] },
  };
  const wrapper = mount(DishCard, { props: { dish } });
  const main = wrapper.get('.dish-recommendation-main');
  expect(main.element.firstElementChild?.classList.contains('dish-recommendation-info')).toBe(true);
  expect(main.element.lastElementChild?.classList.contains('dish-recommendation-image')).toBe(true);
  await wrapper.get('.dish-recommendation-image').trigger('error');
  expect(wrapper.find('.dish-recommendation-image').exists()).toBe(false);
  await wrapper.setProps({ dish: { dish: { ...dish.dish, image: 'https://images.test/b.jpg' } } });
  expect(wrapper.get('.dish-recommendation-image').attributes('src')).toBe('https://images.test/b.jpg');
  wrapper.unmount();
});

test.each([
  [
    CanteenCard,
    'canteen',
    { id: 'c', name: '紫荆园', image: 'https://images.test/canteen.jpg', averageRating: 0 },
  ],
  [
    WindowCard,
    'window',
    { id: 'w', name: '面食窗口', image: 'https://images.test/window.jpg', rating: 0 },
  ],
] as const)(
  'venue images fail into meaningful compact fallback and retain navigation',
  async (component, prop, data) => {
    const wrapper = mount(component as any, { props: { [prop]: data } });
    await wrapper.get('image, img').trigger('error');
    expect(wrapper.find('image, img').exists()).toBe(false);
    expect(wrapper.text()).toContain(data.name);
    expect(wrapper.text()).toContain('暂无评分');
    await wrapper.trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: `/pages/${prop}/index?id=${data.id}` });
    wrapper.unmount();
  }
);
