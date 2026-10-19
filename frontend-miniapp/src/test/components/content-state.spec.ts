import { mount } from '@vue/test-utils';
import EmptyState from '@/components/EmptyState.vue';

test('a content state exposes its explanation and recovery without fixed screen positioning', async () => {
  const wrapper = mount(EmptyState, {
    props: {
      title: '暂时无法加载',
      description: '请检查网络后重试',
      actionText: '重新加载',
      role: 'alert',
    },
  });
  expect(wrapper.text()).toContain('请检查网络后重试');
  expect(wrapper.attributes('role')).toBe('alert');
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('action')).toEqual([[]]);
  expect(wrapper.attributes('style')).toBeUndefined();
  wrapper.unmount();
});
test('loading is announced while the empty illustration is hidden', () => {
  const wrapper = mount(EmptyState, { props: { title: '正在加载…', loading: true } });
  expect(wrapper.attributes('aria-busy')).toBe('true');
  expect(wrapper.find('.empty-state__spinner').exists()).toBe(true);
  expect(wrapper.findComponent({ name: 'UiIcon' }).exists()).toBe(false);
  wrapper.unmount();
});
