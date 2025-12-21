import { mount } from '@vue/test-utils';
import SkeletonBase from '@/components/skeleton/SkeletonBase.vue';

describe('SkeletonBase', () => {
  it('renders with default props', () => {
    const wrapper = mount(SkeletonBase);

    expect(wrapper.classes()).toContain('skeleton-item');
    expect(wrapper.classes()).toContain('skeleton-animated');
    expect(wrapper.classes()).not.toContain('rounded-full');

    const el = wrapper.element as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
  });

  it('applies classes and styles from props', () => {
    const wrapper = mount(SkeletonBase, {
      props: {
        width: '10px',
        height: '20px',
        animated: false,
        roundedFull: true,
        rounded: 'rounded-lg',
        className: 'extra-class',
      },
    });

    expect(wrapper.classes()).toContain('skeleton-item');
    expect(wrapper.classes()).not.toContain('skeleton-animated');
    expect(wrapper.classes()).toContain('rounded-full');
    expect(wrapper.classes()).toContain('rounded-lg');
    expect(wrapper.classes()).toContain('extra-class');

    const el = wrapper.element as HTMLElement;
    expect(el.style.width).toBe('10px');
    expect(el.style.height).toBe('20px');
  });
});
