const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

// vue3-jest 的缓存键未包含外部 TypeScript 配置，配置变更时切换缓存目录。
const tsConfigHash = createHash('sha256')
  .update(readFileSync(join(__dirname, 'tsconfig.jest.json')))
  .digest('hex');

module.exports = {
  cacheDirectory: join(tmpdir(), 'tasteinsight-miniapp-jest', tsConfigHash),
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  moduleFileExtensions: ['js', 'ts', 'json', 'vue'],
  transform: {
    '^.+\\.ts$': 'babel-jest',
    '^.+\\.js$': 'babel-jest',
    '^.+\\.vue$': '@vue/vue3-jest',
  },
  // ESM 解析器依赖通过现有 Babel 转换加载。
  transformIgnorePatterns: ['node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:eventsource-parser|markdown-it-cjk-friendly|get-east-asian-width)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'vue-jest': {
      tsConfig: 'tsconfig.jest.json',
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/components/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/e2e-perf/'],
  // Coverage settings: exclude mock, types and non-app entry files
  coveragePathIgnorePatterns: [
    '<rootDir>/src/mock/',
    '<rootDir>/src/types/',
    '<rootDir>/src/test/',
    '<rootDir>/src/static/',
    '<rootDir>/src/App.vue',
    '<rootDir>/src/env.d.ts',
    '<rootDir>/src/main.ts',
    '<rootDir>/src/shime-uni.d.ts',
    '<rootDir>/src/api/index.ts',
    // Exclude store root and app-specific store module from coverage
    '<rootDir>/src/store/index.ts',
    '<rootDir>/src/store/modules/use-app-store.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts,vue}',
    '!src/**/*.spec.{js,ts,vue}',
    '!src/test/**',
    '!src/mock/**',
    '!src/types/**',
    // exclude top-level entry / declaration files that shouldn't count
    '!src/App.vue',
    '!src/env.d.ts',
    '!src/main.ts',
    '!src/shime-uni.d.ts',
    '!src/api/index.ts',
    '!src/static/**',
    '!src/pages/**/*.vue',
    '!src/**/*.d.ts',
    // Exclude store root and app store module from coverage collection
    '!src/store/index.ts',
    '!src/store/modules/use-app-store.ts'
  ],};
