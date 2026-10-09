import { mount } from '@vue/test-utils';
import SettingsPage from '@/pages/settings/components/SettingsPage.vue';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const props = {
  loading: false,
  initialized: true,
  loadError: '',
  saving: false,
  saved: false,
  dirty: false,
  canSave: false,
  restoredDraft: false,
};

it('only offers retry when no successful initialization exists', async () => {
  const wrapper = mount(SettingsPage, {
    props: { ...props, initialized: false, loadError: '网络失败' },
    slots: { default: '<input />' },
  });
  expect(wrapper.text()).toContain('网络失败');
  expect(wrapper.find('input').exists()).toBe(false);
  expect(wrapper.find('.settings-save-bar').exists()).toBe(false);
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('retry')).toHaveLength(1);
});

it('keeps saved and pending states disabled and leaves the save action in document flow', async () => {
  const wrapper = mount(SettingsPage, { props: { ...props, dirty: true, canSave: true } });
  await wrapper.get('.settings-save-bar button').trigger('click');
  expect(wrapper.emitted('save')).toHaveLength(1);
  await wrapper.setProps({ canSave: false, saving: true });
  expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('保存中');
  await wrapper.setProps({ saving: false, saved: true });
  expect(wrapper.text()).toContain('已保存');
});

it('preserves display and notification controls without unsupported support routes', () => {
  const source = (file: string) =>
    readFileSync(resolve(__dirname, '../../pages/settings', file), 'utf8');
  expect(source('components/display.vue')).toContain('showCalories');
  expect(source('components/display.vue')).toContain('showNutrition');
  const notifications = source('components/notifications.vue');
  for (const key of [
    'newDishAlert',
    'priceChangeAlert',
    'reviewReplyAlert',
    'weeklyRecommendation',
  ])
    expect(notifications).toContain(key);
  expect(notifications).not.toMatch(/待接入|尚未实现|未实现/);
  expect(source('about.vue')).not.toContain('小程序内设置页提交');
  expect(source('privacy.vue')).not.toContain('小程序内反馈功能');
  expect(source('privacy.vue')).not.toContain('通过小程序设置清除');
});
