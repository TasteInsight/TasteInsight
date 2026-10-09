import { mount } from '@vue/test-utils';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import RecommendItem from '@/pages/index/components/RecommendItem.vue';
import DishResultItem from '@/pages/search/components/DishResultItem.vue';
import type { Dish } from '@/types/api';

const dish = (overrides: Partial<Dish> = {}): Dish =>
  ({
    id: 'dish-1',
    name: '宫保鸡丁',
    images: [],
    canteenName: '第一食堂',
    windowName: '二层家常菜窗口',
    price: 15,
    averageRating: 4.5,
    reviewCount: 12,
    tags: ['家常菜', '热销'],
    ...overrides,
  }) as Dish;

beforeEach(() => jest.clearAllMocks());

describe('DishSummaryCard', () => {
  test('emits the selected dish without owning page navigation', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish() } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['dish-1']]);
    expect(uni.navigateTo).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  test.each([RecommendItem, DishResultItem])(
    'keeps summary and one navigation consistent for each entry point',
    async Component => {
      const wrapper = mount(Component, { props: { dish: dish() } });
      expect(wrapper.text()).toContain('第一食堂 · 二层家常菜窗口');
      expect(wrapper.text()).toContain('¥15.0');
      expect(wrapper.text()).toContain('4.5 分');
      expect(wrapper.text()).toContain('12 条评价');
      await wrapper.get('button').trigger('click');
      expect(uni.navigateTo).toHaveBeenCalledTimes(1);
      expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=dish-1' });
      wrapper.unmount();
    }
  );

  test('omits the photo area for missing or failed images and displays a new resource', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish() } });
    expect(wrapper.find('.dish-card__image').exists()).toBe(false);
    expect(wrapper.find('.dish-card__photo').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('暂无图片');

    await wrapper.setProps({ dish: dish({ images: ['https://images.test/first.jpg'] }) });
    expect(wrapper.get('.dish-card__image').attributes('src')).toBe(
      'https://images.test/first.jpg'
    );
    await wrapper.get('.dish-card__image').trigger('error');
    expect(wrapper.find('.dish-card__image').exists()).toBe(false);
    expect(wrapper.find('.dish-card__photo').exists()).toBe(false);
    expect(wrapper.get('.dish-card__name').text()).toBe('宫保鸡丁');

    await wrapper.setProps({
      dish: dish({ images: ['https://images.test/second.jpg'] }),
    });
    expect(wrapper.get('.dish-card__image').attributes('src')).toBe(
      'https://images.test/second.jpg'
    );
    wrapper.unmount();
  });

  test('does not turn an unknown review count into zero and keeps zero ratings explicit', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish({ reviewCount: undefined }) } });
    expect(wrapper.find('.dish-card__reviews').exists()).toBe(false);
    await wrapper.setProps({ dish: dish({ reviewCount: 0, averageRating: 0 }) });
    expect(wrapper.get('.dish-card__reviews').text()).toBe('0 条评价');
    expect(wrapper.get('.dish-card__rating').text()).toBe('暂无评分');
    wrapper.unmount();
  });

  test('retains full long names in the accessible label and keeps location and price unit', () => {
    const name = '超长菜品名称'.repeat(10);
    const wrapper = mount(DishSummaryCard, { props: { dish: dish({ name, priceUnit: '份' }) } });
    expect(wrapper.get('button').attributes('aria-label')).toBe(`查看${name}`);
    expect(wrapper.get('.dish-card__name').text()).toBe(name);
    expect(wrapper.get('.dish-card__location').text()).toContain('二层家常菜窗口');
    expect(wrapper.get('.dish-card__price').text()).toBe('¥15.0/份');
    wrapper.unmount();
  });
});
