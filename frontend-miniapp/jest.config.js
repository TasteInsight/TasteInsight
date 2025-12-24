module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'ts', 'json', 'vue'],
  transform: {
    '^.+\\.ts$': 'babel-jest',
    '^.+\\.js$': 'babel-jest',
    '^.+\\.vue$': '@vue/vue3-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.jest.json',
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
