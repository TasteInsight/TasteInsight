import { defineComponent, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import FilterBar from '../FilterBar.vue';
import CanteenFilterBar from '@/pages/canteen/components/CanteenFilterBar.vue';
import type { GetDishesRequest } from '@/types/api';

const wrappers: VueWrapper[] = [];
const hosts = new Map<VueWrapper, VueWrapper>();
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
  const wrapper = host.findComponent(FilterBar);
  hosts.set(wrapper, host);
  return wrapper;
};
const button = (wrapper: VueWrapper, label: string) => {
  const result = wrapper.findAll('.filter-option').find(item => item.text() === label);
  if (!result) throw new Error('Missing button: ' + label);
  return result;
};
const open = (wrapper: VueWrapper) => wrapper.get('.filter-trigger').trigger('click');
const confirm = (wrapper: VueWrapper) => wrapper.get('.filter-apply').trigger('click');
const updateApplied = async (wrapper: VueWrapper, filter: GetDishesRequest['filter']) => {
  (hosts.get(wrapper)!.vm as any).filter = filter;
  await wrapper.vm.$nextTick();
};
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => {
    const element = wrapper.element;
    wrapper.unmount();
    element.remove();
  });
  hosts.clear();
});

describe('grouped filter drawer', () => {
  test('a minimum price above 999 needs an explicit valid maximum', async () => {
    const wrapper = mountFilters();
    await open(wrapper);
    await wrapper.get('[aria-label="最低价格，元"]').setValue('1000');
    await confirm(wrapper);
    expect(wrapper.emitted('filter-change')).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('请填写最高价');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('1200');
    await confirm(wrapper);
    expect(wrapper.props('filter')).toEqual({ price: { min: 1000, max: 1200 } });
  });
  test('keeps keyboard focus within the drawer and Escape restores its trigger', async () => {
    const wrapper = mountFilters();
    document.body.appendChild(hosts.get(wrapper)!.element);
    const trigger = wrapper.get('.filter-trigger').element as HTMLButtonElement;
    trigger.focus();
    await open(wrapper);
    await wrapper.vm.$nextTick();
    const close = wrapper.get('[aria-label="关闭筛选"]').element as HTMLButtonElement;
    const apply = wrapper.get('.filter-apply').element as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(apply);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(close);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).isOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(wrapper.emitted('filter-change')).toBeUndefined();
  });
  test('direct entrances open every group without a chooser', async () => {
    const wrapper = mountFilters();
    expect(wrapper.findAll('.filter-trigger').map(item => item.text())).toEqual([
      '预算',
      '评分',
      '餐时',
      '口味',
      '荤素',
      '标签',
      '忌口',
    ]);
    await open(wrapper);
    expect(wrapper.findAll('.filter-group__title').map(item => item.text())).toEqual([
      '预算',
      '评分',
      '用餐时段',
      '口味',
      '荤素偏好',
      '菜品标签',
      '忌口食材',
    ]);
    expect(wrapper.findAll('slider-stub')).toHaveLength(8);
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1);
    expect(wrapper.get('.filter-reset').text()).toBe('重置');
    expect(wrapper.get('.filter-apply').text()).toBe('确定');
  });
  test('multiple groups emit one complete payload only on confirm', async () => {
    const wrapper = mountFilters({ canteenId: ['c1'], favoriteIngredients: ['豆腐'] });
    await open(wrapper);
    for (const label of ['午餐', '10-15元', '4.5分以上', '纯素', '招牌', '花生'])
      await button(wrapper, label).trigger('click');
    expect(wrapper.emitted('filter-change')).toBeUndefined();
    await confirm(wrapper);
    expect(wrapper.emitted('filter-change')).toHaveLength(1);
    expect(wrapper.props('filter')).toEqual({
      canteenId: ['c1'],
      favoriteIngredients: ['豆腐'],
      price: { min: 10, max: 15 },
      rating: { min: 4.5, max: 5 },
      mealTime: ['lunch'],
      meatPreference: ['素'],
      tag: ['招牌'],
      avoidIngredients: ['花生'],
    });
    expect((wrapper.vm as any).isOpen).toBe(false);
  });
  test.each(['backdrop', 'close', 'navigation'])('%s discards every draft group', async how => {
    const wrapper = mountFilters({ price: { min: 10, max: 15 }, mealTime: ['lunch'] });
    await open(wrapper);
    for (const label of ['20元以上', '晚餐', '招牌']) await button(wrapper, label).trigger('click');
    if (how === 'backdrop') await wrapper.get('.filter-overlay').trigger('tap');
    else if (how === 'close') await wrapper.get('[aria-label="关闭筛选"]').trigger('click');
    else {
      (wrapper.vm as any).closePanel();
      await wrapper.vm.$nextTick();
    }
    expect(wrapper.emitted('filter-change')).toBeUndefined();
    await open(wrapper);
    expect(button(wrapper, '10-15元').attributes('aria-pressed')).toBe('true');
    expect(button(wrapper, '晚餐').attributes('aria-pressed')).toBe('false');
    expect(button(wrapper, '招牌').attributes('aria-pressed')).toBe('false');
  });
  test('reset clears all draft groups and waits for confirm', async () => {
    const wrapper = mountFilters({
      price: { min: 10, max: 15 },
      mealTime: ['lunch'],
      canteenId: ['c1'],
    });
    await open(wrapper);
    await wrapper.get('.filter-reset').trigger('click');
    expect((wrapper.vm as any).isOpen).toBe(true);
    expect(wrapper.emitted('filter-change')).toBeUndefined();
    await wrapper.get('[aria-label="关闭筛选"]').trigger('click');
    await open(wrapper);
    expect(button(wrapper, '午餐').attributes('aria-pressed')).toBe('true');
    await wrapper.get('.filter-reset').trigger('click');
    await confirm(wrapper);
    expect(wrapper.props('filter')).toEqual({ canteenId: ['c1'] });
  });
  test('external changes update changed groups and retain unrelated draft edits', async () => {
    const wrapper = mountFilters({ price: { min: 10, max: 15 }, tag: ['招牌'], canteenId: ['c1'] });
    await open(wrapper);
    await button(wrapper, '晚餐').trigger('click');
    await updateApplied(wrapper, {
      price: { min: 10, max: 15 },
      rating: { min: 4, max: 5 },
      canteenId: ['c2'],
    });
    expect((wrapper.vm as any).isOpen).toBe(true);
    expect(button(wrapper, '招牌').attributes('aria-pressed')).toBe('false');
    await confirm(wrapper);
    expect(wrapper.emitted('filter-change')![0][0]).toEqual({
      price: { min: 10, max: 15 },
      rating: { min: 4, max: 5 },
      mealTime: ['dinner'],
      canteenId: ['c2'],
    });
  });
  test('cancel after external updates restores the latest applied state', async () => {
    const wrapper = mountFilters({ tag: ['招牌'] });
    await open(wrapper);
    await button(wrapper, '午餐').trigger('click');
    await updateApplied(wrapper, { rating: { min: 4.5, max: 5 } });
    (wrapper.vm as any).closePanel();
    await wrapper.vm.$nextTick();
    await open(wrapper);
    expect(button(wrapper, '招牌').attributes('aria-pressed')).toBe('false');
    expect(button(wrapper, '午餐').attributes('aria-pressed')).toBe('false');
    expect(button(wrapper, '4.5分以上').attributes('aria-pressed')).toBe('true');
  });
  test('validates all groups together without publishing invalid ranges', async () => {
    const wrapper = mountFilters({ mealTime: ['lunch'] });
    await open(wrapper);
    await wrapper.get('[aria-label="最低价格，元"]').setValue('20');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('10');
    await wrapper.get('[aria-label="最低评分"]').setValue('6');
    (wrapper.findComponent('[aria-label="辣度下限"]') as VueWrapper).vm.$emit('change', {
      detail: { value: 4 },
    });
    (wrapper.findComponent('[aria-label="辣度上限"]') as VueWrapper).vm.$emit('change', {
      detail: { value: 2 },
    });
    await confirm(wrapper);
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(3);
    expect(wrapper.emitted('filter-change')).toBeUndefined();
  });

  test('confirm reveals the first invalid group when editing a later section', async () => {
    const wrapper = mountFilters();
    await wrapper.get('.filter-trigger:last-child').trigger('click');
    await wrapper.get('[aria-label="最低价格，元"]').setValue('20');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('10');
    await confirm(wrapper);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.filter-scroll').attributes('scroll-into-view')).toBe('filter-group-price');
    expect(wrapper.emitted('filter-change')).toBeUndefined();
  });
  test('preserves zero, decimals, four taste ranges and custom values', async () => {
    const wrapper = mountFilters();
    await open(wrapper);
    await wrapper.get('[aria-label="最低价格，元"]').setValue('0');
    await wrapper.get('[aria-label="最高价格，元"]').setValue('15.5');
    await wrapper.get('[aria-label="最低评分"]').setValue('0');
    await wrapper.get('[aria-label="最高评分"]').setValue('4.5');
    for (const label of ['辣度', '咸度', '甜度', '油腻度']) {
      (wrapper.findComponent('[aria-label="' + label + '下限"]') as VueWrapper).vm.$emit('change', {
        detail: { value: 2 },
      });
      (wrapper.findComponent('[aria-label="' + label + '上限"]') as VueWrapper).vm.$emit('change', {
        detail: { value: 4 },
      });
    }
    await wrapper.get('[aria-label="自定义标签"]').setValue(' 手工现做 ');
    await wrapper.get('#filter-group-tag .filter-add').trigger('click');
    await wrapper.get('[aria-label="自定义忌口食材"]').setValue(' 芝麻 ');
    await wrapper.get('#filter-group-avoid .filter-add').trigger('click');
    await confirm(wrapper);
    expect(wrapper.props('filter')).toEqual({
      price: { min: 0, max: 15.5 },
      rating: { min: 0, max: 4.5 },
      spicyLevel: { min: 2, max: 4 },
      saltiness: { min: 2, max: 4 },
      sweetness: { min: 2, max: 4 },
      oiliness: { min: 2, max: 4 },
      tag: ['手工现做'],
      avoidIngredients: ['芝麻'],
    });
    await wrapper.get('[aria-label="移除忌口：芝麻"]').trigger('click');
    expect(wrapper.props('filter')!.tag).toEqual(['手工现做']);
    expect(wrapper.props('filter')!.avoidIngredients).toBeUndefined();
  });
  test('unlimited presets clear custom inputs before confirm', async () => {
    const wrapper = mountFilters({ price: { min: 0, max: 15.5 }, rating: { min: 0, max: 4.5 } });
    await open(wrapper);
    await wrapper.get('#filter-group-price .filter-option').trigger('click');
    await wrapper.get('#filter-group-rating .filter-option').trigger('click');
    await confirm(wrapper);
    expect(wrapper.props('filter')).toEqual({});
  });
  test('wrapper exposure closes drafts and clears applied values', async () => {
    const wrapper = mount(CanteenFilterBar, {
      props: { filter: { mealTime: ['lunch'] } },
      global: { stubs: { slider: true } },
    });
    wrappers.push(wrapper);
    await open(wrapper);
    expect((wrapper.vm as any).isOpen).toBe(true);
    (wrapper.vm as any).closePanel();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).isOpen).toBe(false);
    expect(wrapper.emitted('filter-change')).toBeUndefined();
    (wrapper.vm as any).resetAllFilters();
    expect(wrapper.emitted('filter-change')![0][0]).toEqual({});
  });
});
