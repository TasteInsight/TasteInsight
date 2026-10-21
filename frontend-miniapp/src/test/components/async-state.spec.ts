import { mount } from '@vue/test-utils';
import AsyncState from '@/components/AsyncState.vue';

test('loading replaces a previous empty result and a failed initial read', async () => {
  const wrapper = mount(AsyncState, {
    props: { initialized: true, emptyTitle: '暂无内容', loadingTitle: '正在读取' },
  });
  expect(wrapper.text()).toBe('暂无内容');
  await wrapper.setProps({ loading: true });
  expect(wrapper.text()).toBe('正在读取');
  expect(wrapper.findAll('.empty-state')).toHaveLength(1);
  await wrapper.setProps({ loading: false, error: '连接失败' });
  expect(wrapper.text()).toContain('连接失败');
  expect(wrapper.text()).not.toContain('暂无内容');
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('retry')).toHaveLength(1);
  await wrapper.setProps({ loading: true });
  expect(wrapper.text()).toBe('正在读取');
  wrapper.unmount();
});

test('refresh and append expose a non-blocking status while retaining error recovery', async () => {
  const wrapper = mount(AsyncState, {
    props: { initialized: true, hasContent: true, emptyTitle: '暂无内容' },
  });
  expect(wrapper.text()).toBe('');
  await wrapper.setProps({ loading: true });
  expect(wrapper.text()).toBe('正在更新…');
  expect(wrapper.get('[role="status"]').classes()).toContain('async-state--refreshing');
  expect(wrapper.find('.page-state-region').exists()).toBe(false);
  await wrapper.setProps({ loading: false, error: '加载更多失败' });
  expect(wrapper.text()).toContain('加载更多失败');
  expect(wrapper.classes()).not.toContain('async-state--refreshing');
  expect(wrapper.find('.page-state-region').exists()).toBe(false);
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('retry')).toHaveLength(1);
  wrapper.unmount();
});

test('an empty result can expose its business action after a successful read', async () => {
  const wrapper = mount(AsyncState, {
    props: { initialized: false, emptyTitle: '暂无内容', emptyActionText: '添加内容' },
  });
  expect(wrapper.find('button').exists()).toBe(false);
  await wrapper.setProps({ initialized: true });
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('action')).toHaveLength(1);
  wrapper.unmount();
});
