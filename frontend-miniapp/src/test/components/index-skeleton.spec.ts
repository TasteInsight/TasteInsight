import { mount } from '@vue/test-utils';
import IndexSkeleton from '@/components/skeleton/IndexSkeleton.vue';

describe('IndexSkeleton', () => {
  it('matches search, photo-and-name canteens and right-media recommendation rows', () => {
    const wrapper = mount(IndexSkeleton);

    expect(wrapper.findAll('.index-skeleton-canteen')).toHaveLength(3);
    expect(wrapper.findAll('.dish-skeleton-row')).toHaveLength(3);
    expect(wrapper.findAll('.skeleton-item').some(node => (node.attributes('style') || '').includes('12rem'))).toBe(false);
  });
});
