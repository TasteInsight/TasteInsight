import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { uniH5PickerCompat } from '../../../scripts/uni-h5-picker-compat';

const packagePath = require.resolve('@dcloudio/uni-h5/package.json');
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
const runtimePath = join(dirname(packagePath), 'dist/uni-h5.es.js');
const source = readFileSync(runtimePath, 'utf8');
const transform = uniH5PickerCompat(version).transform as Function;

function picker() {
  const { code } = transform(source, runtimePath);
  const setup = code.match(/function usePickerMethods\([^)]*\) \{([\s\S]*?)(?=  const isiPad)/)![1];
  const showMethod = code.match(
    /function _show\(event\) \{[\s\S]*?(?=\n  function _getFormData)/
  )![0];
  const closeMethod = code.match(/function _close\(\) \{[\s\S]*?(?=\n  function _select)/)![0];
  const state = { valueChangeSource: 'click', valueSync: 1, valueArray: [0], visible: false };
  const node = { remove: jest.fn(), style: { display: 'none' } };
  const parent = { appendChild: jest.fn(), prepend: jest.fn() };
  const restoreValue = jest.fn(() => {
    state.valueArray = [state.valueSync];
  });
  const dispose = jest.fn();
  const methods = new Function(
    'props2',
    'state2',
    '_setValueArray',
    'pickerRef',
    'rootRef',
    'document',
    'onBeforeUnmount',
    'setTimeout',
    'clearTimeout',
    `${setup}; ${showMethod}; ${closeMethod}; return { show: _show, close: _close };`
  )(
    { disabled: false },
    state,
    restoreValue,
    { value: node },
    { value: parent },
    { querySelector: () => parent },
    dispose,
    setTimeout,
    clearTimeout
  );
  const open = () => {
    methods.show({
      currentTarget: { getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 48 }) },
    });
    jest.advanceTimersByTime(20);
  };
  return { ...methods, open, state, node, parent, restoreValue, dispose };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('restores cancelled wheel state on open using the installed runtime without editing it', () => {
  const { open, state, restoreValue, parent, node } = picker();
  open();
  expect(state.valueArray).toEqual([1]);
  expect(state.visible).toBe(true);
  expect(restoreValue).toHaveBeenCalledTimes(1);
  expect(parent.appendChild).toHaveBeenCalledWith(node);
  expect(readFileSync(runtimePath, 'utf8')).toBe(source);
});

it('keeps a rapidly reopened picker visible after the previous close transition finishes', () => {
  const { open, close, node, state, parent } = picker();
  open();
  close();
  jest.advanceTimersByTime(200);
  open();
  jest.advanceTimersByTime(300);
  expect(state.visible).toBe(true);
  expect(node.style.display).toBe('block');
  expect(parent.prepend).not.toHaveBeenCalled();
  close();
  jest.advanceTimersByTime(260);
  expect(node.style.display).toBe('none');
  expect(parent.prepend).toHaveBeenCalledTimes(1);
});

it('replaces repeated close timers and keeps another picker independent', () => {
  const first = picker();
  const second = picker();
  first.open();
  first.close();
  jest.advanceTimersByTime(200);
  first.close();
  second.open();
  jest.advanceTimersByTime(100);
  expect(first.node.style.display).toBe('block');
  jest.advanceTimersByTime(160);
  expect(first.node.style.display).toBe('none');
  expect(first.parent.prepend).toHaveBeenCalledTimes(1);
  expect(second.node.style.display).toBe('block');
  expect(second.parent.prepend).not.toHaveBeenCalled();
});

it('cancels pending close work when the picker is unmounted', () => {
  const { open, close, dispose, parent } = picker();
  open();
  close();
  expect(dispose).toHaveBeenCalledTimes(1);
  dispose.mock.calls[0][0]();
  jest.advanceTimersByTime(300);
  expect(parent.prepend).not.toHaveBeenCalled();
});

it('does not transform unrelated modules', () => {
  expect(transform(source, '/src/UiPicker.vue')).toBeNull();
});

it('requires an explicit review when the pinned version or runtime shape changes', () => {
  expect(() => uniH5PickerCompat('3.0.0-future')).toThrow('Review the H5 picker');
  expect(() => transform('changed runtime', runtimePath)).toThrow('implementation changed');
  expect(() => transform(source + source, runtimePath)).toThrow('implementation changed');
});
