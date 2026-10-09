import { createEnvConfig, resolveTestLogin } from './env';

// Vite replaces this expression at build time. Jest reads the same variable at
// runtime, which keeps the configuration contract independently testable.
const mode = process.env.VITE_BUILD_MODE || 'production';
const config = {
  ...createEnvConfig(process.env.VITE_API_BASE_URL),
  mode,
  platform: process.env.UNI_PLATFORM || 'unknown',
  testLoginEnabled: resolveTestLogin(mode, process.env.VITE_ENABLE_TEST_LOGIN),
};

export default config;
