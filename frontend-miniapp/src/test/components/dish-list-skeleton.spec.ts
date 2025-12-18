import { mount } from '@vue/test-utils';
import DishListSkeleton from '@/components/skeleton/DishListSkeleton.vue';

describe('DishListSkeleton', () => {
  it('renders expected number of skeleton blocks', () => {
    const wrapper = mount(DishListSkeleton);

    // Header: 2 SkeletonBase
    // List: 5 rows * 5 SkeletonBase each = 25
    // Total = 27
    const items = wrapper.findAll('.skeleton-item');
    expect(items.length).toBe(27);
  });
});
