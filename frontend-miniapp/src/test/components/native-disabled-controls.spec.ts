import { shallowMount } from '@vue/test-utils';
import IconButton from '@/components/IconButton.vue';
import FloatingActionButton from '@/components/FloatingActionButton.vue';
import SuggestionChips from '@/pages/ai-chat/components/SuggestionChips.vue';

test.each([
  ['icon', IconButton, { name: 'close', label: '关闭', tone: 'inverse' }, '.icon-button', 'click'],
  [
    'floating action',
    FloatingActionButton,
    { icon: 'plus', label: '新增' },
    '.floating-action-button',
    'click',
  ],
  ['suggestion', SuggestionChips, { suggestions: ['推荐午餐'] }, '.suggestion-chip', 'select'],
] as const)(
  '%s keeps native disabled styling and activation in sync',
  async (_, component, props, selector, event) => {
    const wrapper = shallowMount(component as any, { props: { ...props, disabled: false } });
    const button = wrapper.get(selector);
    expect(button.classes()).not.toContain('is-disabled');
    await button.trigger('click');
    expect(wrapper.emitted(event)).toHaveLength(1);

    await wrapper.setProps({ disabled: true });
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.classes()).toContain('is-disabled');
    await button.trigger('click');
    await button.trigger('keydown', { key: 'Enter' });
    await button.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted(event)).toHaveLength(1);

    await wrapper.setProps({ disabled: false });
    expect(button.classes()).not.toContain('is-disabled');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    expect(wrapper.emitted(event)).toHaveLength(2);
    if (selector === '.icon-button') expect(button.classes()).toContain('icon-button--inverse');
    wrapper.unmount();
  }
);
