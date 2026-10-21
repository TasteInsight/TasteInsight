jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => ({ isLoggedIn: true }) }));
import * as Vue from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { parse, compileScript } from '@vue/compiler-sfc';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import SettingsPage from '@/pages/settings/components/SettingsPage.vue';
import AsyncState from '@/components/AsyncState.vue';

const { Button: UniButton } = require('@dcloudio/uni-h5');
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
function h5Component(component: any, source: string) {
  const { descriptor } = parse(readFileSync(require.resolve(source), 'utf8'));
  const template = descriptor
    .template!.content.replace(/<(\/?)button\b/g, '<$1UniButton')
    .replace(/@(keydown|keyup)="([^"]+)"/g, (_match, event, expression: string) => {
      const handler = expression.includes('$event')
        ? expression.replace(/\$event/g, '$nne($event)[0]')
        : expression + '($nne($event)[0])';
      return '@' + event + '="' + handler + '"';
    });
  const render = Vue.compile(template, {
    mode: 'function',
    prefixIdentifiers: true,
    bindingMetadata: compileScript(descriptor, { id: 'settings-keyboard-test' }).bindings,
  });
  return { ...component, render };
}
const H5SettingsPage = h5Component(
  SettingsPage,
  '../../pages/settings/components/SettingsPage.vue'
);
const H5AsyncState = h5Component(AsyncState, '../../components/AsyncState.vue');
const props = {
  loading: false,
  initialized: true,
  loadError: '',
  saving: false,
  saved: false,
  canSave: false,
  restoredDraft: false,
};
const wrappers: VueWrapper[] = [];
let normalizedTargets: object[] = [];

function page(overrides: Partial<typeof props> = {}) {
  const wrapper = mount(H5SettingsPage, {
    props: { ...props, ...overrides },
    global: {
      components: { UniButton },
      stubs: { AsyncState: H5AsyncState },
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
  wrappers.push(wrapper);
  return wrapper;
}

function keyEvent(element: HTMLElement, type: string, key: string, repeat = false) {
  const event = new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  normalizedTargets = [];
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => {
    const element = wrapper.element;
    wrapper.unmount();
    element.remove();
  });
});

it('activates the real Uni H5 save button once per Enter or Space press', async () => {
  const wrapper = page({ canSave: true });
  const button = wrapper.get('.settings-save-bar uni-button').element as HTMLElement;
  expect(button.getAttribute('role')).toBe('button');
  expect(button.tabIndex).toBe(0);
  button.focus();
  expect(document.activeElement).toBe(button);
  expect(keyEvent(button, 'keydown', 'Enter').defaultPrevented).toBe(true);
  expect(keyEvent(button, 'keyup', 'Enter').defaultPrevented).toBe(true);
  expect(normalizedTargets[0]).not.toBe(normalizedTargets[1]);
  expect('click' in normalizedTargets[0]).toBe(false);
  expect(wrapper.emitted('save')).toHaveLength(1);

  keyEvent(button, 'keydown', ' ');
  keyEvent(button, 'keydown', ' ', true);
  keyEvent(button, 'keyup', ' ');
  keyEvent(button, 'keyup', ' ');
  expect(wrapper.emitted('save')).toHaveLength(2);

  keyEvent(button, 'keydown', 'Enter');
  button.blur();
  keyEvent(button, 'keyup', 'Enter');
  expect(wrapper.emitted('save')).toHaveLength(2);
  await wrapper.get('uni-button').trigger('click');
  expect(wrapper.emitted('save')).toHaveLength(3);
});

it.each([
  ['unchanged', {}],
  ['saving', { saving: true }],
  ['saved', { saved: true }],
] as const)('keeps %s saves inactive for pointer and keyboard input', async (_state, overrides) => {
  const wrapper = page(overrides);
  const button = wrapper.get('.settings-save-bar uni-button').element as HTMLElement;
  expect(button.getAttribute('disabled')).not.toBeNull();
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(button.tabIndex).toBe(-1);
  for (const key of ['Enter', ' ']) {
    keyEvent(button, 'keydown', key);
    keyEvent(button, 'keyup', key);
  }
  await wrapper.get('uni-button').trigger('click');
  expect(wrapper.emitted('save')).toBeUndefined();
});

it('does not save when a held key is released after saving starts', async () => {
  const wrapper = page({ canSave: true });
  const button = wrapper.get('.settings-save-bar uni-button').element as HTMLElement;
  keyEvent(button, 'keydown', 'Enter');
  await wrapper.setProps({ saving: true, canSave: false });
  keyEvent(button, 'keyup', 'Enter');
  expect(wrapper.emitted('save')).toBeUndefined();
});

it('keeps the read-error retry action keyboard accessible', () => {
  const wrapper = page({ initialized: false, loadError: '网络失败' });
  const button = wrapper.get('.settings-load-state.error-feedback uni-button')
    .element as HTMLElement;
  expect(button.getAttribute('role')).toBe('button');
  expect(button.tabIndex).toBe(0);
  keyEvent(button, 'keydown', 'Enter');
  keyEvent(button, 'keyup', 'Enter');
  keyEvent(button, 'keyup', 'Enter');
  expect(wrapper.emitted('retry')).toHaveLength(1);
  expect(wrapper.find('.settings-save-bar').exists()).toBe(false);
});
