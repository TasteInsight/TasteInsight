import { mount } from '@vue/test-utils';
import IndexSkeleton from '@/components/skeleton/IndexSkeleton.vue';

describe('IndexSkeleton', () => {
  it('renders expected number of skeleton blocks', () => {
    const wrapper = mount(IndexSkeleton);

    // See template structure in IndexSkeleton.vue
    const items = wrapper.findAll('.skeleton-item');
    expect(items.length).toBe(25);
  });
});
