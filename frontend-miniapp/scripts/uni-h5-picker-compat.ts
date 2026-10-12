import type { Plugin } from 'vite';

const supportedVersion = '3.0.0-5020620260917001';
const openPicker = '    state2.valueChangeSource = "";\n    let $picker = pickerRef.value;';

/**
 * Uni 5.26 在取消后保留临时 valueArray，重开时须从已确认的 valueSync 恢复。
 * 仅转换 H5 构建输入，不改动依赖文件；升级 Uni 时重新核对上游实现。
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
      if (code.split(openPicker).length !== 2) {
        throw new Error('Uni H5 picker implementation changed; review its cancel/reopen behavior');
      }
      return {
        code: code.replace(
          openPicker,
          '    state2.valueChangeSource = "";\n    _setValueArray();\n    let $picker = pickerRef.value;'
        ),
        map: null,
      };
    },
  };
}
