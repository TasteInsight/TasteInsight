import { mount } from '@vue/test-utils';
import DishSummaryCard from '@/components/DishSummaryCard.vue';
import CanteenDishCard from '@/pages/canteen/components/CanteenDishCard.vue';
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
  test.each([
    ['份', '/份'],
    ['元/份', '/份'],
    ['元/100g', '/100g'],
    ['元', ''],
    [null, ''],
  ])('normalizes historical price unit %p without changing the dish', (priceUnit, suffix) => {
    for (const price of [0, 10.01, 15]) {
      const original = dish({ price, priceUnit });
      const wrapper = mount(DishSummaryCard, { props: { dish: original } });
      expect(wrapper.get('.dish-card__price').text()).toBe(`¥${price.toFixed(2)}${suffix}`);
      expect(original.priceUnit).toBe(priceUnit);
      wrapper.unmount();
    }
  });
  test('shows one neutral offline label beside the name and removes it when online', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish({ status: 'offline' as any }) } });
    expect(wrapper.get('.dish-card__heading .tag-badge--neutral').text()).toBe('已下架');
    expect(wrapper.get('button').attributes('aria-label')).toBe('查看宫保鸡丁，已下架');
    expect(wrapper.text().match(/已下架/g)).toHaveLength(1);
    await wrapper.setProps({ dish: dish({ status: 'online' as any }) });
    expect(wrapper.find('.tag-badge--neutral').exists()).toBe(false);
    wrapper.unmount();
  });

  test('emits the selected dish without owning page navigation', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish() } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['dish-1']]);
    expect(uni.navigateTo).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  test.each(['Enter', ' '])(
    'selects the current dish once for a complete %p key press',
    async key => {
      const wrapper = mount(DishSummaryCard, { props: { dish: dish() } });
      const button = wrapper.get('button');
      const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      button.element.dispatchEvent(down);
      await button.trigger('keydown', { key, repeat: true });
      expect(wrapper.emitted('select')).toBeUndefined();
      await button.trigger('keyup', { key });

      expect(wrapper.emitted('select')).toEqual([['dish-1']]);
      expect(down.defaultPrevented).toBe(true);
      expect(button.attributes('role')).toBe('button');
      expect(button.attributes('tabindex')).toBe('0');
      await button.trigger('keyup', { key });
      expect(wrapper.emitted('select')).toHaveLength(1);

      await wrapper.setProps({ dish: dish({ id: 'dish-2' }) });
      await button.trigger('keydown', { key });
      await button.trigger('keyup', { key });
      expect(wrapper.emitted('select')).toEqual([['dish-1'], ['dish-2']]);
      expect(uni.navigateTo).not.toHaveBeenCalled();
      wrapper.unmount();
    }
  );

  test('cancels keyboard activation after blur and keeps a pointer click from double selecting', async () => {
    const wrapper = mount(DishSummaryCard, { props: { dish: dish() } });
    const button = wrapper.get('button');
    await button.trigger('keydown', { key: 'Enter' });
    await button.trigger('blur');
    await button.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('select')).toBeUndefined();

    await button.trigger('keydown', { key: ' ' });
    await button.trigger('click');
    await button.trigger('keyup', { key: ' ' });
    expect(wrapper.emitted('select')).toEqual([['dish-1']]);
    wrapper.unmount();
  });

  test.each([RecommendItem, DishResultItem])(
    'keeps summary and one navigation consistent for each entry point',
    async Component => {
      const wrapper = mount(Component, {
        props: { dish: dish({ price: 10.01, priceUnit: '元/100g', status: 'offline' as any }) },
      });
      expect(wrapper.text()).toContain('第一食堂 · 二层家常菜窗口');
      expect(wrapper.get('.dish-card__price').text()).toBe('¥10.01/100g');
      expect(wrapper.get('.tag-badge--neutral').text()).toBe('已下架');
      expect(wrapper.text()).toContain('4.5 分');
      expect(wrapper.text()).toContain('12 条评价');
      await wrapper.get('button').trigger('click');
      expect(uni.navigateTo).toHaveBeenCalledTimes(1);
      expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/dish/index?id=dish-1' });
      await wrapper.setProps({
        dish: dish({ price: 0, priceUnit: null, status: 'online' as any }),
      });
      expect(wrapper.get('.dish-card__price').text()).toBe('¥0.00');
      expect(wrapper.find('.tag-badge--neutral').exists()).toBe(false);
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
    expect(wrapper.get('.dish-card__price').text()).toBe('¥15.00/份');
    wrapper.unmount();
  });
});

test('canteen and window cards forward the full summary and selected ID', async () => {
  const wrapper = mount(CanteenDishCard, {
    props: { dish: dish({ price: 10.01, priceUnit: '元/100g', status: 'offline' as any }) },
  });
  expect(wrapper.get('.dish-card__price').text()).toBe('¥10.01/100g');
  expect(wrapper.get('.tag-badge--neutral').text()).toBe('已下架');
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('click')).toEqual([['dish-1']]);
  wrapper.unmount();
});
