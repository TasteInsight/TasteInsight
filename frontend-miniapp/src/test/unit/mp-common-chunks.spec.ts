/** @jest-environment node */
import path from 'node:path';
import { uniMpCommonChunks } from '../../../scripts/uni-mp-common-chunks';

const inputDir = path.resolve(__dirname, '../../');

function configure(original: (id: string) => string | undefined) {
  process.env.UNI_INPUT_DIR = inputDir;
  const plugin = uniMpCommonChunks();
  const output = { manualChunks: original };
  (plugin.configResolved as Function)({ build: { rollupOptions: { output } } });
  return output.manualChunks;
}

test('coalesces main-package support code while delegating package ownership to the optimizer', () => {
  const chunks = configure(id =>
    id.includes('dish') ? 'pages/dish/common/vendor' : 'utils/shared'
  );
  expect(chunks(`${inputDir}/utils/shared.ts`)).toBe('common/vendor');
  expect(chunks(`${inputDir}/api/dish.ts`)).toBe('pages/dish/common/vendor');
});

test('preserves compiler-owned entry, component, asset and dependency output', () => {
  const chunks = configure(id => (id.endsWith('main.ts') ? undefined : 'common/assets'));
  expect(chunks(`${inputDir}/main.ts`)).toBeUndefined();
  expect(chunks(`${inputDir}/components/UiIcon.vue?vue&type=script`)).toBe('common/assets');
  expect(chunks(`${inputDir}/assets/icon.png`)).toBe('common/assets');
  expect(chunks(path.resolve(inputDir, '../node_modules/library/index.js'))).toBe('common/assets');
});
