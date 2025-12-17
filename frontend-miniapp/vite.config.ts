import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'

// 判断是否是 H5 或 App 平台，因为只有小程序才需要 weapp-tailwindcss 插件
const isH5 = process.env.UNI_PLATFORM === 'h5'
const isApp = process.env.UNI_PLATFORM === 'app'
const WeappTailwindcssDisabled = isH5 || isApp // H5/App 平台不需要启用

export default defineConfig({
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
})