import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { uniH5PickerCompat } from '../../../scripts/uni-h5-picker-compat';

const packagePath = require.resolve('@dcloudio/uni-h5/package.json');
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
const runtimePath = join(dirname(packagePath), 'dist/uni-h5.es.js');
const source = readFileSync(runtimePath, 'utf8');
const transform = uniH5PickerCompat(version).transform as Function;

it('restores cancelled wheel state on open using the installed runtime without editing it', () => {
  const result = transform(source, runtimePath);
  const method = result.code.match(
    /function _show\(event\) \{[\s\S]*?(?=\n  function _getFormData)/
  )![0];
  const state = { valueChangeSource: 'click', valueSync: 1, valueArray: [0], visible: false };
  const node = { remove: jest.fn(), style: {} };
  const parent = { appendChild: jest.fn() };
  const restoreValue = jest.fn(() => {
    state.valueArray = [state.valueSync];
  });
  const show = new Function(
    'props2',
    'state2',
    '_setValueArray',
    'pickerRef',
    'document',
    'setTimeout',
    `${method}; return _show;`
  )(
    { disabled: false },
    state,
    restoreValue,
    { value: node },
    { querySelector: () => parent },
    (callback: Function) => callback()
  );
  show({
    currentTarget: { getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 48 }) },
  });
  expect(state.valueArray).toEqual([1]);
  expect(state.visible).toBe(true);
  expect(restoreValue).toHaveBeenCalledTimes(1);
  expect(parent.appendChild).toHaveBeenCalledWith(node);
  expect(readFileSync(runtimePath, 'utf8')).toBe(source);
});

it('does not transform unrelated modules', () => {
  expect(transform(source, '/src/UiPicker.vue')).toBeNull();
});

it('requires an explicit review when the pinned version or runtime shape changes', () => {
  expect(() => uniH5PickerCompat('3.0.0-future')).toThrow('Review the H5 picker');
  expect(() => transform('changed runtime', runtimePath)).toThrow('implementation changed');
  expect(() => transform(source + source, runtimePath)).toThrow('implementation changed');
});
