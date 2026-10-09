import { defineComponent, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import FilterBar from '../FilterBar.vue';
import type { GetDishesRequest } from '@/types/api';

const wrappers: VueWrapper[] = [];
const mountFilters = (initial: GetDishesRequest['filter'] = {}) => {
  const host = mount(
    defineComponent({
      components: { FilterBar },
      setup: () => ({ filter: ref(initial) }),
      template: '<FilterBar :filter="filter" @filter-change="filter = $event" />',
    }),
    { global: { stubs: { slider: true } } }
  );
  wrappers.push(host);
  return host.findComponent(FilterBar);
};
const button = (wrapper: VueWrapper, label: string) => {
  const result = wrapper.findAll('button').find(item => item.text() === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
};

afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

describe('home filter interaction', () => {
  test('the sheet keeps applied filters when its backdrop dismisses an unfinished choice', async () => {
    const wrapper = mountFilters({ price: { min: 10, max: 15 } });
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect((wrapper.vm as any).isOpen).toBe(true);
    await button(wrapper, '20元以上').trigger('click');
    await wrapper.get('.filter-overlay').trigger('tap');
    expect((wrapper.vm as any).isOpen).toBe(false);
    expect(wrapper.props('filter')).toEqual({ price: { min: 10, max: 15 } });
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    expect(button(wrapper, '10-15元').attributes('aria-pressed')).toBe('true');
  });

  test('applies meal time and budget, then removes only the chosen value', async () => {
    const wrapper = mountFilters();
    await wrapper.get('.filter-trigger').trigger('click');
    await button(wrapper, '午餐').trigger('click');
    await button(wrapper, '晚餐').trigger('click');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({ mealTime: ['lunch', 'dinner'] });

    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    await button(wrapper, '10-15元').trigger('click');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({
      mealTime: ['lunch', 'dinner'],
      price: { min: 10, max: 15 },
    });
    expect(wrapper.get('[aria-label="已应用的筛选条件"]').text()).toContain('10–15元');

    await wrapper.get('[aria-label="移除午餐"]').trigger('click');
    expect(wrapper.props('filter')).toEqual({ mealTime: ['dinner'], price: { min: 10, max: 15 } });
    await wrapper.get('[aria-label="移除10–15元"]').trigger('click');
    expect(wrapper.props('filter')).toEqual({ mealTime: ['dinner'] });
    await button(wrapper, '清除全部').trigger('click');
    expect(wrapper.props('filter')).toEqual({});
    expect(wrapper.find('.filters__applied').exists()).toBe(false);
  });

  test('cancels a closed draft and preserves changes while focusing another group', async () => {
    const wrapper = mountFilters({ price: { min: 10, max: 15 } });
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    await button(wrapper, '20元以上').trigger('click');
    expect(wrapper.get('[aria-label="已应用的筛选条件"]').text()).toContain('10–15元');
    await wrapper.get('[aria-label="关闭筛选"]').trigger('click');
    expect(wrapper.emitted('filter-change')).toBeUndefined();

    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    expect(button(wrapper, '10-15元').attributes('aria-pressed')).toBe('true');
    await button(wrapper, '20元以上').trigger('click');
    await wrapper.findAll('.filter-trigger')[2].trigger('click');

    await button(wrapper, '4.5分以上').trigger('click');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({
      price: { min: 20, max: 999 },
      rating: { min: 4.5, max: 5 },
    });
  });

  test('preserves advanced ranges, custom tags and avoids while applying a common filter', async () => {
    const initial = {
      rating: { min: 3, max: 4 },
      spicyLevel: { min: 2, max: 4 },
      saltiness: { min: 1, max: 3 },
      sweetness: { min: 1, max: 2 },
      oiliness: { min: 1, max: 3 },
      tag: ['招牌', '手工现做'],
      avoidIngredients: ['花生', '芝麻'],
      meatPreference: ['素'],
    };
    const wrapper = mountFilters(initial);
    expect(wrapper.get('[aria-label="已应用的筛选条件"]').text()).toContain('标签：手工现做');
    await wrapper.get('.filter-trigger').trigger('click');
    await button(wrapper, '午餐').trigger('click');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({ ...initial, mealTime: ['lunch'] });
    await wrapper.get('[aria-label="移除忌口：芝麻"]').trigger('click');
    expect(wrapper.props('filter')).toEqual({
      ...initial,
      avoidIngredients: ['花生'],
      mealTime: ['lunch'],
    });
  });

  test('shows invalid ranges inline without applying or clearing the current query', async () => {
    const wrapper = mountFilters({ mealTime: ['lunch'] });
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    await wrapper.get('[aria-label="最低价格，元"]').setValue('20');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('10');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('最低价不能大于最高价');
    expect(wrapper.props('filter')).toEqual({ mealTime: ['lunch'] });
    expect(wrapper.emitted('filter-change')).toBeUndefined();
  });

  test('preserves zero and decimal budget values and restores empty inputs without a price filter', async () => {
    const wrapper = mountFilters();
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    await wrapper.get('[aria-label="最低价格，元"]').setValue('0');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('15.5');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({ price: { min: 0, max: 15.5 } });
    await wrapper.findAll('.filter-trigger')[0].trigger('click');
    await wrapper.get('[aria-label="最低价格，元"]').setValue('');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({});
  });

  test('validates rating inputs and preserves zero, decimals and empty values through the real controls', async () => {
    const wrapper = mountFilters();
    await wrapper.findAll('.filter-trigger')[2].trigger('click');

    await wrapper.get('[aria-label="最低评分"]').setValue('6');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.get('[role="alert"]').text()).toContain('最低分必须在 0-5 之间');
    expect(wrapper.props('filter')).toEqual({});
    await wrapper.get('[aria-label="最低评分"]').setValue('0');
    await wrapper.get('[aria-label="最高评分"]').setValue('4.5');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({ rating: { min: 0, max: 4.5 } });
    await wrapper.findAll('.filter-trigger')[2].trigger('click');

    await wrapper.get('[aria-label="最低评分"]').setValue('');
    await wrapper.get('[aria-label="最高评分"]').setValue('');
    await button(wrapper, '确定').trigger('click');
    expect(wrapper.props('filter')).toEqual({});
  });
});
