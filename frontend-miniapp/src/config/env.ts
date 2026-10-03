export interface EnvConfig {
  baseUrl: string;
}

export function createEnvConfig(apiBaseUrl: string | undefined): EnvConfig {
  const baseUrl = apiBaseUrl?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL must be configured for the current mode');
  }

  return { baseUrl };
}
