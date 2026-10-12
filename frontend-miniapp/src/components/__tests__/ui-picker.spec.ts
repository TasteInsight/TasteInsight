import { defineComponent, toRaw } from 'vue';
import { mount } from '@vue/test-utils';
import UiPicker from '../UiPicker.vue';

const NativePicker = defineComponent({
  name: 'NativePicker',
  props: {
    mode: String,
    range: Array,
    rangeKey: String,
    value: [Number, String, Array],
    disabled: [Boolean, String],
    fields: String,
    start: { type: String, default: 'native-start' },
    end: { type: String, default: 'native-end' },
    selectorType: String,
  },
  emits: ['change', 'cancel', 'columnchange'],
  template: '<div data-native-picker><slot /></div>',
});

const global = { stubs: { picker: NativePicker } };

describe('UiPicker native contract', () => {
  it('defaults to a selector with day precision and delegates omitted date bounds', () => {
    const wrapper = mount(UiPicker, { global });

    expect(wrapper.getComponent(NativePicker).props()).toEqual({
      mode: 'selector',
      range: [],
      rangeKey: '',
      value: 0,
      disabled: false,
      fields: 'day',
      start: 'native-start',
      end: 'native-end',
      selectorType: '',
    });
  });

  it('forwards object ranges and zero values without keeping a second selection state', async () => {
    const range = [
      { id: 'first', name: '第一食堂' },
      { id: 'second', name: '第二食堂' },
    ];
    const wrapper = mount(UiPicker, {
      props: { range, rangeKey: 'name', value: 0 },
      global,
    });
    const picker = wrapper.getComponent(NativePicker);

    expect(toRaw(picker.props('range'))).toBe(range);
    expect(picker.props('rangeKey')).toBe('name');
    expect(picker.props('value')).toBe(0);

    await wrapper.setProps({ value: 1 });
    expect(picker.props('value')).toBe(1);
    await wrapper.setProps({ value: 0 });
    expect(picker.props('value')).toBe(0);
  });

  it('preserves multi-selector ranges and array values', async () => {
    const range = [
      ['一', '二'],
      ['甲', '乙'],
    ];
    const value = [0, 1];
    const wrapper = mount(UiPicker, {
      props: { mode: 'multiSelector', range, value },
      global,
    });
    const picker = wrapper.getComponent(NativePicker);

    expect(picker.props('mode')).toBe('multiSelector');
    expect(toRaw(picker.props('range'))).toBe(range);
    expect(toRaw(picker.props('value'))).toBe(value);

    const nextValue = [1, 0];
    await wrapper.setProps({ value: nextValue });
    expect(toRaw(picker.props('value'))).toBe(nextValue);
  });

  it('forwards date values, explicit bounds and disabled changes', async () => {
    const wrapper = mount(UiPicker, {
      props: {
        mode: 'date',
        value: '2026-10-09',
        start: '2026-10-01',
        end: '2026-10-31',
        disabled: true,
      },
      global,
    });
    const picker = wrapper.getComponent(NativePicker);

    expect(picker.props()).toMatchObject({
      mode: 'date',
      fields: 'day',
      value: '2026-10-09',
      start: '2026-10-01',
      end: '2026-10-31',
      disabled: true,
    });

    await wrapper.setProps({ disabled: false, start: undefined, end: undefined });
    expect(picker.props('disabled')).toBe(false);
    expect(picker.props('start')).toBe('native-start');
    expect(picker.props('end')).toBe('native-end');
  });

  it('forwards time values without date conversion', () => {
    const wrapper = mount(UiPicker, {
      props: { mode: 'time', value: '12:30', start: '08:00', end: '20:00' },
      global,
    });

    expect(wrapper.getComponent(NativePicker).props()).toMatchObject({
      mode: 'time',
      value: '12:30',
      start: '08:00',
      end: '20:00',
    });
  });

  it.each(['month', 'year'] as const)('accepts explicit %s precision', fields => {
    const wrapper = mount(UiPicker, { props: { mode: 'date', fields }, global });

    expect(wrapper.getComponent(NativePicker).props('fields')).toBe(fields);
  });

  it.each(['picker', 'select'] as const)(
    'preserves explicit %s selector presentation',
    selectorType => {
      const wrapper = mount(UiPicker, { props: { selectorType }, global });

      expect(wrapper.getComponent(NativePicker).props('selectorType')).toBe(selectorType);
    }
  );

  it.each(['change', 'cancel', 'columnchange'] as const)(
    'forwards the original %s event once without rebuilding its payload',
    eventName => {
      const listener = jest.fn();
      const wrapper = mount(UiPicker, {
        attrs: { [`on${eventName[0].toUpperCase()}${eventName.slice(1)}`]: listener },
        global,
      });
      const payload = {
        type: eventName,
        detail: { value: [0, 1], column: 0 },
        target: { id: 'date-picker' },
        timeStamp: 123,
      };

      wrapper.getComponent(NativePicker).vm.$emit(eventName, payload);

      expect(wrapper.emitted(eventName)).toEqual([[payload]]);
      expect(wrapper.emitted(eventName)?.[0][0]).toBe(payload);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toBe(payload);
    }
  );

  it('retains the default slot and inherits class, style and accessibility attributes', () => {
    const wrapper = mount(UiPicker, {
      attrs: {
        class: 'calendar-date-picker',
        style: 'flex: 1',
        'aria-label': '选择用餐日期',
        'data-testid': 'calendar-date',
      },
      slots: { default: '<button><span>选择日期</span></button>' },
      global,
    });
    const picker = wrapper.getComponent(NativePicker);

    expect(picker.classes()).toContain('calendar-date-picker');
    expect(picker.attributes('style')).toContain('flex: 1');
    expect(picker.attributes('aria-label')).toBe('选择用餐日期');
    expect(picker.attributes('data-testid')).toBe('calendar-date');
    expect(picker.get('button span').text()).toBe('选择日期');
    expect(wrapper.element).toBe(picker.element);
  });
});
