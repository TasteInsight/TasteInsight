import { mount } from '@vue/test-utils';
import SearchSkeleton from '@/components/skeleton/SearchSkeleton.vue';
import DishDetailSkeleton from '@/components/skeleton/DishDetailSkeleton.vue';
import PlanningSkeleton from '@/components/skeleton/PlanningSkeleton.vue';
import NewsDetailSkeleton from '@/components/skeleton/NewsDetailSkeleton.vue';

test.each([PlanningSkeleton, NewsDetailSkeleton])(
  'content skeletons do not create a second page viewport',
  Component => {
    const wrapper = mount(Component);
    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.classes()).toContain('skeleton-page');
    expect(wrapper.find('scroll-view').exists()).toBe(false);
    expect(wrapper.find('.min-h-screen, .fixed').exists()).toBe(false);
  }
);

test('search loading only replaces results, never the existing search toolbar', () => {
  const wrapper = mount(SearchSkeleton);
  expect(wrapper.find('.search-toolbar').exists()).toBe(false);
  expect(wrapper.findAll('.dish-skeleton-row')).toHaveLength(3);
});
test('dish loading puts reviews directly after its compact summary', () => {
  const wrapper = mount(DishDetailSkeleton);
  expect(wrapper.find('.dish-detail-skeleton-summary').exists()).toBe(true);
  expect(wrapper.find('.review-skeleton-list').exists()).toBe(true);
  expect(
    wrapper
      .findAll('.skeleton-item')
      .some(node => /height: (12|16)rem/.test(node.attributes('style') || ''))
  ).toBe(false);
});
