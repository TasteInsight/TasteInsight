import { globalIgnores } from 'eslint/config'
import globals from 'globals'
import {
  configureVueProject,
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginPlaywright from 'eslint-plugin-playwright'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

configureVueProject({ scriptLangs: ['js', 'ts'] })

/** @type {ReturnType<typeof defineConfigWithVueTs>} */
const config = defineConfigWithVueTs(
  { files: ['**/*.{js,mjs,ts,mts,tsx,vue}'] },
  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    // 显式动态类型与组件命名沿用项目约定；严格类型检查由 vue-tsc 执行。
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    // 测试覆盖失败输入与框架夹具；检查聚焦用例、断言和异步调用。
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    files: ['tests/unit/**/*.spec.ts'],
    plugins: { vitest: pluginVitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/valid-expect': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    plugins: { playwright: pluginPlaywright },
    rules: {
      'playwright/no-focused-test': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/valid-expect': 'error',
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-undef': 'error' },
  },
  skipFormatting,
)

export default config
