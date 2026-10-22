jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ isLoggedIn: true }) }));
import { mount } from '@vue/test-utils';
import SettingsPage from '@/pages/settings/components/SettingsPage.vue';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import postcss from 'postcss';
import { zhHans } from '@/i18n/messages/account';
const props = {
  loading: false,
  initialized: true,
  loadError: '',
  saving: false,
  saved: false,
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
  const wrapper = mount(SettingsPage, { props: { ...props, canSave: true } });
  await wrapper.get('.settings-save-bar button').trigger('click');
  expect(wrapper.emitted('save')).toHaveLength(1);
  await wrapper.setProps({ canSave: false, saving: true });
  expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('保存中');
  await wrapper.setProps({ saving: false, saved: true });
  expect(wrapper.text()).toContain('已保存');
});

it('uses the save button as the sole status display and retains the restored draft notice', async () => {
  const wrapper = mount(SettingsPage, { props });
  const saveBar = wrapper.get('.settings-save-bar');
  const button = saveBar.get('button');
  expect(saveBar.text()).toBe('保存修改');
  expect(button.attributes('disabled')).toBeDefined();
  await button.trigger('click');
  expect(wrapper.emitted('save')).toBeUndefined();

  await wrapper.setProps({ canSave: true, restoredDraft: true });
  expect(wrapper.get('.settings-note').text()).toBe('已恢复未保存的修改');
  expect(saveBar.text()).toBe('保存修改');
  expect(button.attributes('disabled')).toBeUndefined();
  await wrapper.setProps({ canSave: false, saving: true });
  expect(saveBar.text()).toBe('保存中…');
  expect(button.attributes('aria-busy')).toBe('true');
  expect(button.get('[aria-live="polite"]').text()).toBe('保存中…');
  await wrapper.setProps({ saving: false, saved: true, restoredDraft: false });
  expect(saveBar.text()).toBe('已保存');
  expect(button.attributes('disabled')).toBeDefined();
  expect(wrapper.find('.settings-note').exists()).toBe(false);
});

it('gives settings-home section headings a semibold hierarchy', () => {
  const stylesheet = readFileSync(
    resolve(__dirname, '../../pages/settings/settings-page.css'),
    'utf8'
  );
  const declarations: Record<string, string> = {};
  postcss.parse(stylesheet).walkRules('.settings-group-title', rule => {
    rule.walkDecls(declaration => {
      declarations[declaration.prop] = declaration.value;
    });
  });
  expect(Number(declarations['font-weight'])).toBeGreaterThanOrEqual(600);
});

it('keeps a pressed save button neutral as soon as it becomes disabled', async () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(
    resolve(__dirname, '../../pages/settings/settings-page.css'),
    'utf8'
  ).replace(/:active/g, '[data-test-active]');
  document.head.appendChild(style);
  const wrapper = mount(SettingsPage, { props: { ...props, canSave: true } });
  document.body.appendChild(wrapper.element);
  try {
    const button = wrapper.get('button').element;
    expect(getComputedStyle(button).backgroundColor).toBe('rgb(102, 8, 116)');
    button.setAttribute('data-test-active', '');
    expect(getComputedStyle(button).backgroundColor).toBe('rgb(81, 6, 93)');
    await wrapper.setProps({ canSave: false, saving: true });
    expect(getComputedStyle(button).backgroundColor).toBe('rgb(244, 244, 245)');
    expect(getComputedStyle(button).color).toBe('rgb(152, 162, 179)');
  } finally {
    const element = wrapper.element;
    wrapper.unmount();
    element.remove();
    style.remove();
  }
});

it('preserves display and notification controls without unsupported support routes', () => {
  const source = (file: string) =>
    readFileSync(resolve(__dirname, '../../pages/settings', file), 'utf8');
  expect(source('components/display.vue')).toContain('showCalories');
  expect(source('components/display.vue')).toContain('showNutrition');
  expect(source('components/display.vue')).not.toContain('待接入');
  expect(source('components/display.vue')).toContain(
    'account.settings.showAvailableCaloriesPerServing'
  );
  expect(zhHans.settings.showAvailableCaloriesPerServing).toContain('每份热量');
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
