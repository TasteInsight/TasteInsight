import { flushPromises, mount } from '@vue/test-utils';
import ProfileActionsSheet from '@/pages/profile/components/ProfileActionsSheet.vue';

const items = ['头像与昵称', '个人简介', '账号与校园身份', '访客预览'];
const wrappers: any[] = [];
let origin: HTMLButtonElement;
beforeEach(() => {
  origin = document.createElement('button');
  document.body.appendChild(origin);
  origin.focus();
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  origin.remove();
});
async function sheet(canRestoreFocus = () => true) {
  const wrapper = mount(ProfileActionsSheet, { props: { items, canRestoreFocus } });
  wrappers.push(wrapper);
  document.body.appendChild(wrapper.element);
  await flushPromises();
  return wrapper;
}

test('starts on the first option and traps forward and reverse Tab at the dialog edges', async () => {
  const wrapper = await sheet();
  const buttons = wrapper.findAll('button');
  expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('个人资料');
  expect(document.activeElement).toBe(buttons[0].element);
  expect(
    buttons.every(
      button => button.attributes('tabindex') === '0' && button.attributes('role') === 'button'
    )
  ).toBe(true);
  const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
  document.dispatchEvent(reverse);
  expect(reverse.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(buttons[4].element);
  const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
  document.dispatchEvent(forward);
  expect(forward.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(buttons[0].element);
});

test('option activation emits the correct index once and closing restores the original focus', async () => {
  const wrapper = await sheet();
  const option = wrapper.findAll('button')[1];
  await option.trigger('keydown', { key: ' ' });
  await option.trigger('keydown', { key: ' ', repeat: true });
  await option.trigger('keyup', { key: ' ' });
  await option.trigger('keyup', { key: ' ' });
  expect(wrapper.emitted('select')).toEqual([[1]]);
  await option.trigger('keydown', { key: 'Enter' });
  await option.trigger('blur');
  await option.trigger('keyup', { key: 'Enter' });
  expect(wrapper.emitted('select')).toEqual([[1]]);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  expect(wrapper.emitted('close')).toEqual([[]]);
  wrapper.unmount();
  expect(document.activeElement).toBe(origin);
  const escaped = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  document.dispatchEvent(escaped);
  expect(escaped.defaultPrevented).toBe(false);
});

test('a page that is no longer visible does not receive focus when its sheet unmounts', async () => {
  let visible = true;
  const wrapper = await sheet(() => visible);
  visible = false;
  wrapper.unmount();
  expect(document.activeElement).not.toBe(origin);
});

test('dismisses a normalized Uni backdrop click without dismissing inner option clicks', async () => {
  const wrapper = await sheet();
  const event = new Event('click', { bubbles: true });
  // Uni normalizes target and currentTarget into separate descriptors.
  Object.defineProperties(event, {
    target: { value: { id: 'mask' } },
    currentTarget: { value: { id: 'mask' } },
  });
  wrapper.get('.profile-actions-mask').element.dispatchEvent(event);
  expect(wrapper.emitted('close')).toEqual([[]]);

  await wrapper.findAll('button')[0].trigger('click');
  expect(wrapper.emitted('select')).toEqual([[0]]);
  expect(wrapper.emitted('close')).toEqual([[]]);
});
