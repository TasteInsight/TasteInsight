import { mount } from '@vue/test-utils';
import DishListSkeleton from '@/components/skeleton/DishListSkeleton.vue';

describe('DishListSkeleton', () => {
  it('keeps loading rows flat with text left and media right, without a duplicate header', () => {
    const wrapper = mount(DishListSkeleton);

    const rows=wrapper.findAll('.dish-skeleton-row');
    expect(rows).toHaveLength(3);
    rows.forEach(row=>expect(row.element.lastElementChild?.classList.contains('dish-skeleton-media')).toBe(true));
    expect(wrapper.find('.dish-list-heading').exists()).toBe(false);
  });
});
