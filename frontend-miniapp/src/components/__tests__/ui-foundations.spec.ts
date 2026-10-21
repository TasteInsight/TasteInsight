import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { mount } from '@vue/test-utils';
import UiIcon from '../UiIcon.vue';
import IconButton from '../IconButton.vue';
import EmptyState from '../EmptyState.vue';

describe('shared UI foundations', () => {
  it('renders a decorative local icon and updates its size and tone', async () => {
    const wrapper = mount(UiIcon, { props: { name: 'user' } });

    expect(wrapper.attributes('src')).toBe('/static/icons/ui/user-muted.png');
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('style')).toContain('width: 20px');

    await wrapper.setProps({ name: 'eye-off', size: 28, tone: 'primary' });

    expect(wrapper.attributes('src')).toBe('/static/icons/ui/eye-off-primary.png');
    expect(wrapper.attributes('style')).toContain('width: 28px');
    expect(wrapper.attributes('style')).toContain('height: 28px');
  });

  it('ships every declared icon tone as a transparent 3x raster from a matching line source', () => {
    const iconDirectory = path.resolve(__dirname, '../../static/icons/ui');
    const iconTypes = readFileSync(path.resolve(__dirname, '../../types/ui-icon.ts'), 'utf8');
    const iconDeclaration = iconTypes.split('export type UiIconName =')[1].split(';')[0];
    const names = Array.from(iconDeclaration.matchAll(/'([^']+)'/g), match => match[1]);
    const tones = ['muted', 'primary', 'inverse', 'danger'];

    expect(readdirSync(path.join(iconDirectory, 'source')).sort()).toEqual(
      names.map(name => `${name}.svg`).sort()
    );
    for (const name of names) {
      const source = readFileSync(path.join(iconDirectory, 'source', `${name}.svg`), 'utf8');
      expect(source).toContain('viewBox="0 0 24 24"');
      expect(source).toContain('stroke-width="1.7"');
      expect(source).toContain('stroke-linecap="round"');
      expect(source).toContain('stroke-linejoin="round"');
      for (const tone of tones) {
        const raster = readFileSync(path.join(iconDirectory, `${name}-${tone}.png`));
        expect(raster.subarray(1, 4).toString()).toBe('PNG');
        expect(raster.readUInt32BE(16)).toBe(72);
        expect(raster.readUInt32BE(20)).toBe(72);
        expect(raster[25]).toBe(6);
      }
    }
  });

  it('keeps a title-only empty result compact and non-interactive', () => {
    const wrapper = mount(EmptyState, { props: { title: '暂无动态', icon: 'chat' } });

    expect(wrapper.get('.empty-state__title').text()).toBe('暂无动态');
    expect(wrapper.getComponent(UiIcon).props()).toMatchObject({ name: 'chat', size: 28 });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('only offers an action when its label is supplied and emits once per activation', async () => {
    const wrapper = mount(EmptyState, { props: { title: '暂无评价' } });
    expect(wrapper.getComponent(UiIcon).props('name')).toBe('info');

    await wrapper.setProps({ actionText: '去看看菜品' });
    expect(wrapper.get('button').text()).toBe('去看看菜品');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('action')).toEqual([[]]);

    await wrapper.setProps({ actionText: '' });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('supports Enter and Space without repeat activation or a stale key after blur', async () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无规划', icon: 'calendar', actionText: '添加规划' },
    });
    const action = wrapper.get('button');
    expect(action.attributes('role')).toBe('button');
    expect(action.attributes('tabindex')).toBe('0');

    await action.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('action')).toBeUndefined();
    await action.trigger('keydown', { key: 'Enter' });
    await action.trigger('keydown', { key: 'Enter', repeat: true });
    await action.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('action')).toHaveLength(1);

    await action.trigger('keydown', { key: ' ' });
    await action.trigger('blur');
    await action.trigger('keyup', { key: ' ' });
    expect(wrapper.emitted('action')).toHaveLength(1);

    await action.trigger('keydown', { key: ' ' });
    await action.trigger('keyup', { key: ' ' });
    expect(wrapper.emitted('action')).toHaveLength(2);
  });

  it('gives an icon-only action a name, optional pressed state and badge slot', async () => {
    const wrapper = mount(IconButton, {
      props: { name: 'bell', label: '消息，2 条未读' },
      slots: { default: '<span aria-hidden="true">2</span>' },
    });
    expect(wrapper.attributes('aria-label')).toBe('消息，2 条未读');
    expect(wrapper.attributes('aria-pressed')).toBeUndefined();
    expect(wrapper.attributes('tabindex')).toBe('0');
    expect(wrapper.findComponent(UiIcon).props()).toMatchObject({
      name: 'bell',
      size: 20,
      tone: 'muted',
    });
    expect(wrapper.get('span').attributes('aria-hidden')).toBe('true');

    await wrapper.setProps({ pressed: false });
    expect(wrapper.attributes('aria-pressed')).toBe('false');
    await wrapper.setProps({ pressed: true, tone: 'primary' });
    expect(wrapper.attributes('aria-pressed')).toBe('true');
    expect(wrapper.findComponent(UiIcon).props('tone')).toBe('primary');
  });

  it('emits one icon action and keeps pointer and activation keys out of the parent', async () => {
    const onParentClick = jest.fn();
    const onParentKeydown = jest.fn();
    const onParentKeyup = jest.fn();
    const wrapper = mount({
      components: { IconButton },
      setup: () => ({ onParentClick, onParentKeydown, onParentKeyup }),
      template: `<div @click="onParentClick" @keydown="onParentKeydown" @keyup="onParentKeyup">
        <IconButton name="edit" label="编辑" />
      </div>`,
    });
    const button = wrapper.getComponent(IconButton);
    await button.trigger('click');
    expect(button.emitted('click')).toEqual([[]]);
    expect(onParentClick).not.toHaveBeenCalled();

    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    button.element.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    await button.trigger('keydown', { key: ' ', repeat: true });
    await button.trigger('keyup', { key: ' ' });
    expect(button.emitted('click')).toHaveLength(2);
    expect(onParentKeydown).not.toHaveBeenCalled();
    expect(onParentKeyup).not.toHaveBeenCalled();

    await button.trigger('keydown', { key: 'Enter' });
    await button.trigger('blur');
    await button.trigger('keyup', { key: 'Enter' });
    expect(button.emitted('click')).toHaveLength(2);
  });

  it('does not activate a disabled icon action with pointer or keyboard', async () => {
    const wrapper = mount(IconButton, {
      props: { name: 'trash', label: '删除', disabled: true },
    });
    expect(wrapper.attributes('tabindex')).toBe('-1');
    await wrapper.trigger('click');
    await wrapper.trigger('keydown', { key: 'Enter' });
    await wrapper.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('click')).toBeUndefined();

    await wrapper.setProps({ disabled: false });
    await wrapper.trigger('keydown', { key: 'Enter' });
    await wrapper.setProps({ disabled: true });
    await wrapper.trigger('keyup', { key: 'Enter' });
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
