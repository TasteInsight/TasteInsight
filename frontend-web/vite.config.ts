import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },
    build: {
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    },
    server: {
      port: 5173,
      proxy: env.WERSS_PROXY_TARGET
        ? {
            '^/werss(?:/|$)': {
              target: env.WERSS_PROXY_TARGET,
              changeOrigin: true,
              xfwd: true,
              ws: true,
              rewrite: (path) => path.replace(/^\/werss(?=\/|$)/, '') || '/',
            },
          }
        : {},
    },
  }
})
