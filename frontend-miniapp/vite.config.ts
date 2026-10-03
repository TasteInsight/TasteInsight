import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { createRequire } from 'node:module'

// 判断是否是 H5 或 App 平台，因为只有小程序才需要 weapp-tailwindcss 插件
const isH5 = process.env.UNI_PLATFORM === 'h5'
const isApp = process.env.UNI_PLATFORM === 'app'
const WeappTailwindcssDisabled = isH5 || isApp // H5/App 平台不需要启用
const nodeRequire = createRequire(import.meta.url)
const markdownRequire = createRequire(nodeRequire.resolve('markdown-it'))
const markdownDependencies = [
  'entities',
  'linkify-it',
  'mdurl',
  'punycode.js',
  'uc.micro',
]
const markdownDependencyAliases = Object.fromEntries(
  markdownDependencies.map(dependency => [
    dependency,
    markdownRequire.resolve(dependency),
  ]),
)

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBaseUrl = (
    process.env.VITE_API_BASE_URL || buildEnv.VITE_API_BASE_URL
  )?.trim()

  if (!apiBaseUrl) {
    throw new Error(`VITE_API_BASE_URL is missing for Vite mode "${mode}"`)
  }

  return {
    define: {
      'process.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    resolve: {
      // UniApp resolves markdown-it through pnpm's symlinked package path but
      // misses its transitive imports. Resolve those imports from markdown-it's
      // own dependency graph without adding duplicate direct dependencies.
      alias: markdownDependencyAliases,
    },
    build: {
      // 解决 terserOptions 警告：显式使用 terser 以匹配插件配置
      minify: 'terser',
    },
    plugins: [
      uni(),
      // 只有在非 H5/App 平台（即小程序平台）时，才启用这个插件
      !WeappTailwindcssDisabled && uvwt({
        // 可以在这里传递选项，例如配置 rpx 转换的基准值
        // (插件会自动处理反斜杠和 rpx 转换)
      }),
    ].filter(Boolean), // 过滤掉禁用的插件
  }
})
