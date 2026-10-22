import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite';
import { createRequire } from 'node:module';
import { resolveApiBaseUrl, resolveTestLogin } from './src/config/env';
import { uniH5PickerCompat } from './scripts/uni-h5-picker-compat';

// 判断是否是 H5 或 App 平台，因为只有小程序才需要 weapp-tailwindcss 插件
const isH5 = process.env.UNI_PLATFORM === 'h5';
const isApp = process.env.UNI_PLATFORM === 'app';
const WeappTailwindcssDisabled = isH5 || isApp; // H5/App 平台不需要启用
const nodeRequire = createRequire(import.meta.url);
const markdownDependencyAliases = Object.fromEntries(
  ['markdown-it', 'markdown-it-cjk-friendly'].flatMap(packageName => {
    const ownerRequire = createRequire(nodeRequire.resolve(`${packageName}/package.json`));
    const { dependencies = {} } = ownerRequire('./package.json');
    return Object.keys(dependencies).map(dependency => [
      dependency,
      ownerRequire.resolve(dependency),
    ]);
  })
);

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBaseUrl = resolveApiBaseUrl(
    mode,
    process.env.VITE_API_BASE_URL ?? buildEnv.VITE_API_BASE_URL
  );
  const testLoginEnabled = resolveTestLogin(
    mode,
    process.env.VITE_ENABLE_TEST_LOGIN ?? buildEnv.VITE_ENABLE_TEST_LOGIN
  );

  return {
    define: {
      'process.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'process.env.VITE_BUILD_MODE': JSON.stringify(mode),
      'process.env.VITE_ENABLE_TEST_LOGIN': JSON.stringify(String(testLoginEnabled)),
      'process.env.UNI_PLATFORM': JSON.stringify(process.env.UNI_PLATFORM || 'unknown'),
    },
    resolve: {
      // Resolve parser dependencies from their owning packages for UniApp's pnpm resolver.
      alias: markdownDependencyAliases,
    },
    build: {
      // 解决 terserOptions 警告：显式使用 terser 以匹配插件配置
      minify: 'terser',
    },
    plugins: [
      isH5 && uniH5PickerCompat(nodeRequire('@dcloudio/uni-h5/package.json').version),
      uni(),
      // 只有在非 H5/App 平台（即小程序平台）时，才启用这个插件
      !WeappTailwindcssDisabled &&
        uvwt({
          // 可以在这里传递选项，例如配置 rpx 转换的基准值
          // (插件会自动处理反斜杠和 rpx 转换)
        }),
    ].filter(Boolean), // 过滤掉禁用的插件
  };
});
