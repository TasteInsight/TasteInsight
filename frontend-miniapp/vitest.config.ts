import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    include: ['src/test/components/**/*.spec.ts'],
    setupFiles: ['src/test/components/setup.ts'],
  },
});
