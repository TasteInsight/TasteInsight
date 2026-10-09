import * as Vue from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { parse, compileScript } from '@vue/compiler-sfc';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import FilterBar from '../FilterBar.vue';

const { Button: UniButton, Slider: UniSlider } = require('@dcloudio/uni-h5');
const requireH5 = createRequire(require.resolve('@dcloudio/uni-h5'));
const runtime = readFileSync(
  join(dirname(require.resolve('@dcloudio/uni-h5')), 'uni-h5.es.js'),
  'utf8'
);
const runtimeAst = require('@babel/core').parseSync(runtime, {
  configFile: false,
  babelrc: false,
  sourceType: 'module',
});
const eventBindings = new Set([
  '$nne',
  'isBuiltInElement',
  'wrapperH5WxsEvent',
  'findUniTarget',
  'createNativeEvent',
  'wrapperEvent',
  'isKeyboardEvent',
  'isClickEvent',
  'isMouseEvent',
  'isTouchEvent',
]);
const normalizationSource = runtimeAst.program.body
  .filter(
    (node: any) =>
      eventBindings.has(node.id?.name) ||
      (node.type === 'VariableDeclaration' &&
        node.declarations.some((item: any) => eventBindings.has(item.id.name)))
  )
  .map((node: any) => runtime.slice(node.start, node.end))
  .join('\n');
const { normalizeTarget } = requireH5('@dcloudio/uni-shared');
const { extend, isPlainObject } = requireH5('@vue/shared');
const normalizeNativeEvent = new Function(
  'normalizeTarget',
  'extend',
  'isPlainObject',
  normalizationSource + '\nreturn $nne;'
)(normalizeTarget, extend, isPlainObject);
let normalizedTargets: object[] = [];
const source = readFileSync(require.resolve('../FilterBar.vue'), 'utf8');
const { descriptor } = parse(source);
const template = descriptor
  .template!.content.replace(/<(\/?)button\b/g, '<$1UniButton')
  .replace(/<(\/?)slider\b/g, '<$1UniSlider')
  .replace(/@(keydown|keyup)="([^"]+)"/g, (_match, event, expression: string) => {
    const handler = expression.includes('$event')
      ? expression.replace(/\$event/g, '$nne($event)[0]')
      : expression + '($nne($event)[0])';
    return '@' + event + '="' + handler + '"';
  });
const render = Vue.compile(template, {
  mode: 'function',
  prefixIdentifiers: true,
  bindingMetadata: compileScript(descriptor, { id: 'filter-keyboard-test' }).bindings,
});
// Execute installed UniApp controls and $nne with the production setup.
const H5FilterBar = { ...FilterBar, render };
let wrapper: VueWrapper;

const activate = async (element: HTMLElement, key: string) => {
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const up = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(down);
  element.dispatchEvent(up);
  await Vue.nextTick();
  return { down, up };
};
beforeEach(() => {
  normalizedTargets = [];
  wrapper = mount(H5FilterBar, {
    global: {
      components: { UniButton, UniSlider },
      stubs: { slider: false },
      plugins: [
        {
          install(app: Vue.App) {
            app.config.globalProperties.$nne = (event: Event) => {
              const result = normalizeNativeEvent(event);
              normalizedTargets.push(result[0].currentTarget);
              return result;
            };
          },
        },
      ],
    },
  });
  document.body.appendChild(wrapper.element);
});
afterEach(() => {
  const element = wrapper.element;
  wrapper.unmount();
  element.remove();
});

test('real UniButton entrances focus and activate once with Enter or Space', async () => {
  const trigger = wrapper.get('.filter-trigger').element as HTMLElement;
  expect(trigger.tagName).toBe('UNI-BUTTON');
  expect(trigger.getAttribute('role')).toBe('button');
  expect(trigger.tabIndex).toBe(0);
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  const activation = await activate(trigger, 'Enter');
  expect(activation.down.defaultPrevented).toBe(true);
  expect(activation.up.defaultPrevented).toBe(true);
  expect(normalizedTargets[0]).not.toBe(normalizedTargets[1]);
  expect('click' in normalizedTargets[0]).toBe(false);
  await Vue.nextTick();
  expect(document.activeElement).toBe(wrapper.get('.filter-close').element);
  const meal = wrapper.findAll('.filter-option').find(option => option.text() === '午餐')!
    .element as HTMLElement;
  meal.focus();
  meal.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  meal.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true })
  );
  meal.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
  meal.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
  await Vue.nextTick();
  expect(meal.getAttribute('aria-pressed')).toBe('true');
  const confirm = wrapper.get('.filter-apply').element as HTMLElement;
  confirm.focus();
  await activate(confirm, 'Enter');
  expect(wrapper.emitted('filter-change')).toEqual([[{ mealTime: ['lunch'] }]]);
  expect(document.activeElement).toBe(trigger);
});

test('a released key after focus moved does not activate a different control', async () => {
  const first = wrapper.get('.filter-trigger').element as HTMLElement;
  const second = wrapper.findAll('.filter-trigger')[1].element as HTMLElement;
  first.focus();
  first.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  second.focus();
  second.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
  );
  await Vue.nextTick();
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  await activate(second, 'Enter');
  expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
});

test('real drawer controls include sliders in keyboard navigation and Escape cancels', async () => {
  const trigger = wrapper.get('.filter-trigger').element as HTMLElement;
  trigger.focus();
  await activate(trigger, ' ');
  await Vue.nextTick();
  const close = wrapper.get('.filter-close').element as HTMLElement;
  const confirm = wrapper.get('.filter-apply').element as HTMLElement;
  expect(document.activeElement).toBe(close);
  close.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  );
  expect(document.activeElement).toBe(confirm);
  confirm.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  );
  expect(document.activeElement).toBe(close);
  const sliders = wrapper.findAll('[role="slider"]');
  expect(sliders).toHaveLength(8);
  for (const slider of sliders) {
    const element = slider.element as HTMLElement;
    expect(element.tagName).toBe('UNI-SLIDER');
    expect(element.tabIndex).toBe(0);
    element.focus();
    expect(document.activeElement).toBe(element);
    await slider.trigger('keydown', { key: 'ArrowRight' });
    expect(slider.attributes('aria-valuenow')).toBe('1');
    await slider.trigger('keydown', { key: 'End' });
    expect(slider.attributes('aria-valuenow')).toBe('5');
    await slider.trigger('keydown', { key: 'ArrowUp' });
    expect(slider.attributes('aria-valuenow')).toBe('5');
    await slider.trigger('keydown', { key: 'Home' });
    expect(slider.attributes('aria-valuenow')).toBe('0');
    await slider.trigger('keydown', { key: 'ArrowLeft' });
    expect(slider.attributes('aria-valuenow')).toBe('0');
    expect(slider.attributes('aria-valuetext')).toBe('不限');
  }
  (sliders[0].element as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await Vue.nextTick();
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(wrapper.emitted('filter-change')).toBeUndefined();
});

test('real slider keyboard changes reach the confirmed API range', async () => {
  const trigger = wrapper.get('.filter-trigger').element as HTMLElement;
  trigger.focus();
  await activate(trigger, 'Enter');
  const min = wrapper.get('[aria-label="辣度下限"]');
  const max = wrapper.get('[aria-label="辣度上限"]');
  await min.trigger('keydown', { key: 'ArrowRight' });
  await min.trigger('keydown', { key: 'ArrowUp' });
  await max.trigger('keydown', { key: 'End' });
  await max.trigger('keydown', { key: 'ArrowDown' });
  await activate(wrapper.get('.filter-apply').element as HTMLElement, ' ');
  expect(wrapper.emitted('filter-change')).toEqual([[{ spicyLevel: { min: 2, max: 4 } }]]);
});
