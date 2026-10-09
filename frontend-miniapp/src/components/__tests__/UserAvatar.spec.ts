import { mount } from '@vue/test-utils';
import UserAvatar from '../UserAvatar.vue';

test('missing or failed media uses the bundled avatar icon, and a changed URL can load', async () => {
  const wrapper = mount(UserAvatar);
  expect(wrapper.find('.user-avatar-photo').exists()).toBe(false);
  expect(wrapper.get('.user-avatar-fallback').attributes('src')).toBe('/static/tabbar/profile-line.png');
  await wrapper.setProps({src:'https://example.test/first.png',size:56,label:'小明的头像'});
  expect(wrapper.attributes('aria-label')).toBe('小明的头像');
  expect(wrapper.attributes('style')).toContain('56px');
  await wrapper.get('.user-avatar-photo').trigger('error');
  expect(wrapper.find('.user-avatar-photo').exists()).toBe(false);
  await wrapper.setProps({src:'https://example.test/second.png'});
  expect(wrapper.get('.user-avatar-photo').attributes('src')).toBe('https://example.test/second.png');
});
