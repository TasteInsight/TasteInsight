import type { Plugin } from 'vite';

const supportedVersion = '3.0.0-5020620260917001';
const pickerMethods =
  'function usePickerMethods(props2, state2, trigger, rootRef, pickerRef, selectRef, inputRef) {';
const openPicker = '    state2.valueChangeSource = "";\n    let $picker = pickerRef.value;';
const closePicker = '  function _close() {\n    state2.visible = false;\n    setTimeout(() => {';

/**
 * Uni 5.26 选择器重开时恢复已确认值，并取消上一轮关闭动画的延迟回调。
 * 仅转换 H5 构建输入；升级 Uni 时重新核对上游实现。
 */
export function uniH5PickerCompat(version: string): Plugin {
  if (version !== supportedVersion) {
    throw new Error(`Review the H5 picker compatibility patch for Uni ${version}`);
  }
  return {
    name: 'tasteinsight-uni-h5-picker-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].replace(/\\/g, '/').endsWith('/@dcloudio/uni-h5/dist/uni-h5.es.js')) {
        return null;
      }
      for (const method of [pickerMethods, openPicker, closePicker]) {
        if (code.split(method).length !== 2) {
          throw new Error(
            'Uni H5 picker implementation changed; review its cancel/reopen behavior'
          );
        }
      }
      return {
        code: code
          .replace(
            pickerMethods,
            `${pickerMethods}\n  let closePickerTimer;\n  onBeforeUnmount(() => clearTimeout(closePickerTimer));`
          )
          .replace(
            openPicker,
            '    state2.valueChangeSource = "";\n    clearTimeout(closePickerTimer);\n    _setValueArray();\n    let $picker = pickerRef.value;'
          )
          .replace(
            closePicker,
            '  function _close() {\n    state2.visible = false;\n    clearTimeout(closePickerTimer);\n    closePickerTimer = setTimeout(() => {'
          ),
        map: null,
      };
    },
  };
}
