import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import {
  configureVueProject,
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

configureVueProject({ scriptLangs: ['js', 'ts'] });

export default defineConfigWithVueTs(
  { files: ['**/*.{js,cjs,mjs,ts,vue}'] },
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    'src/static/**',
    'src/assets/iconfont/**',
  ]),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest, uni: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
      'vue/block-lang': [
        'error',
        { script: { lang: ['js', 'ts', 'renderjs'], allowNoLang: true } },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
    },
  },
  {
    files: ['src/test/**/*.ts', 'src/**/__tests__/**/*.ts', 'e2e/**/*.ts', 'e2e-perf/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
  {
    files: ['**/*.cjs', '*.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['src/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends',
          allowObjectTypes: 'always',
        },
      ],
    },
  },
  skipFormatting
);
