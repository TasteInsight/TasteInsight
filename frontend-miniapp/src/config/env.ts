export interface EnvConfig {
  baseUrl: string;
}

export function resolveTestLogin(mode: string, value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value !== 'true') throw new Error('VITE_ENABLE_TEST_LOGIN must be true or false');
  if (mode !== 'development' && mode !== 'e2e') {
    throw new Error('VITE_ENABLE_TEST_LOGIN is only allowed in development or e2e builds');
  }
  return true;
}

export function createEnvConfig(apiBaseUrl: string | undefined): EnvConfig {
  const baseUrl = apiBaseUrl?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL must be configured for the current mode');
  }

  return { baseUrl };
}
