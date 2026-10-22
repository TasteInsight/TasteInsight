import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';
import { mount } from '@vue/test-utils';
import CanteenWindowList from '@/pages/canteen/components/CanteenWindowList.vue';

function declarations(file: string, selector: string) {
  const source = readFileSync(resolve(__dirname, '../../', file), 'utf8');
  const styles = file.endsWith('.css') ? [{ content: source }] : parse(source).descriptor.styles;
  const result: Record<string, string> = {};
  for (const style of styles) {
    postcss.parse(style.content).walkRules(rule => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls(declaration => {
        result[declaration.prop] = declaration.value;
      });
    });
  }
  return result;
}

test('window entries keep names, floors and destination IDs with a navigation affordance', async () => {
  const windows = [
    { id: 'w1', name: '川菜窗口', floor: { level: '2', name: '二楼' } },
    { id: 'w2', name: '清淡家常菜与时令蔬菜窗口', floor: { level: '1' } },
  ];
  const wrapper = mount(CanteenWindowList, { props: { windows: windows as any } });
  const entries = wrapper.findAll('.canteen-window');
  expect(entries).toHaveLength(2);
  expect(entries[0].get('.canteen-window-copy').text()).toContain('川菜窗口');
  expect(entries[0].get('.canteen-window-floor').text()).toBe('二楼');
  expect(entries[1].get('.canteen-window-floor').text()).toBe('1层');
  expect(entries[1].attributes('title')).toBe(windows[1].name);
  expect(entries[1].attributes('aria-label')).toBe(`浏览${windows[1].name}`);
  expect(entries[0].get('uni-icons').attributes('type')).toBe('right');
  await entries[1].trigger('tap');
  expect(wrapper.emitted('click')).toEqual([['w2']]);
  await wrapper.setProps({ windows: [] });
  expect(wrapper.find('.canteen-windows').exists()).toBe(false);
  wrapper.unmount();
});

test.each([
  ['pages/canteen/components/CanteenWindowList.vue', '.canteen-window'],
  ['pages/index/index.vue', '.home-text-button'],
  ['components/meal-plan/PlanEditDialog.vue', '.plan-select'],
])('%s keeps lightweight controls frameless with touch-sized targets', (file, selector) => {
  const css = declarations(file, selector);
  expect(css.border).toBe('0');
  expect(css.background).toBe('transparent');
  expect(parseInt(css['min-height'])).toBeGreaterThanOrEqual(44);
  expect(css['box-shadow']).toBeUndefined();
});

test('navigation buttons suppress the native outline while preserving keyboard focus feedback', () => {
  expect(
    declarations('pages/canteen/components/CanteenWindowList.vue', '.canteen-window::after').border
  ).toBe('0');
  expect(
    declarations('styles/list-interaction.css', '.list-row-action:focus-visible::before').outline
  ).toBe('2px solid #660874');
  for (const [file, selector] of [
    ['pages/index/index.vue', '.home-text-button'],
    ['styles/error-feedback.css', '.error-feedback__action'],
  ]) {
    expect(declarations(file, `${selector}::after`).border).toBe('0');
    expect(declarations(file, `${selector}:focus-visible`).outline).toBe('2px solid #660874');
  }
});

test('catalogue filters can wrap and truncate long names without altering date or meal boundaries', () => {
  const file = 'components/meal-plan/PlanEditDialog.vue';
  expect(declarations(file, '.plan-location-filters')['flex-wrap']).toBe('wrap');
  expect(declarations(file, '.plan-location-picker')['max-width']).toBe('100%');
  expect(declarations(file, '.plan-select-label')).toMatchObject({
    'min-width': '0',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  });
  expect(declarations(file, '.plan-select-icon')['flex-shrink']).toBe('0');
  expect(declarations(file, '.plan-field').border).toBe('1px solid var(--field-border-color)');
  expect(declarations(file, '.plan-sheet .plan-meal-selected')['border-color']).toBe('#660874');
});
