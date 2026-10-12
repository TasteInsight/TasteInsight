import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';
import { shallowMount } from '@vue/test-utils';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import UiIcon from '@/components/UiIcon.vue';

test('shares the planning action geometry and safe-area placement', () => {
  const { descriptor } = parse(
    readFileSync(resolve(__dirname, '../../components/FloatingActionButton.vue'), 'utf8')
  );
  const declarations: Record<string, string> = {};
  descriptor.styles.forEach(style =>
    postcss.parse(style.content).walkRules('.floating-action-button', rule => {
      rule.walkDecls(declaration => {
        declarations[declaration.prop] = declaration.value;
      });
    })
  );
  expect(declarations).toMatchObject({
    position: 'fixed',
    right: '20px',
    bottom: 'calc(var(--window-bottom, 0px) + 20px + env(safe-area-inset-bottom))',
    'min-height': '48px',
    'border-radius': '10px',
    padding: '0 16px',
    gap: '8px',
    background: '#660874',
    color: '#fff',
    'font-size': '14px',
    'box-shadow': '0 4px 14px rgba(17, 24, 39, 0.14)',
  });
});

test('uses the shared icon and supports pointer and keyboard activation', async () => {
  const wrapper = shallowMount(FloatingActionButton, {
    props: { label: '新增菜品', icon: 'plus' },
  });
  expect(wrapper.text()).toBe('新增菜品');
  expect(wrapper.attributes('aria-label')).toBe('新增菜品');
  expect(wrapper.getComponent(UiIcon).props()).toMatchObject({
    name: 'plus',
    size: 22,
    tone: 'inverse',
  });
  await wrapper.trigger('click');
  await wrapper.trigger('keydown', { key: 'Enter' });
  await wrapper.trigger('keyup', { key: 'Enter' });
  await wrapper.trigger('keydown', { key: ' ' });
  await wrapper.trigger('keyup', { key: ' ' });
  expect(wrapper.emitted('click')).toHaveLength(3);
  await wrapper.setProps({ disabled: true });
  expect(wrapper.attributes('disabled')).toBeDefined();
  expect(wrapper.attributes('tabindex')).toBe('-1');
  await wrapper.trigger('click');
  await wrapper.trigger('keydown', { key: 'Enter' });
  await wrapper.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('click')).toHaveLength(3);
  wrapper.unmount();
});
