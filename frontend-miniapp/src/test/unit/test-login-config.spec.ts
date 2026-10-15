import { resolveTestLogin } from '@/config/env';

test.each(['development', 'e2e', 'production', 'staging'])(
  'test login defaults off in %s',
  mode => {
    expect(resolveTestLogin(mode, undefined)).toBe(false);
    expect(resolveTestLogin(mode, 'false')).toBe(false);
  }
);
test.each(['development', 'e2e'])('explicitly allows test login only in %s', mode => {
  expect(resolveTestLogin(mode, 'true')).toBe(true);
});
test.each(['production', 'staging', 'mock'])('rejects test login in %s', mode => {
  expect(() => resolveTestLogin(mode, 'true')).toThrow('VITE_ENABLE_TEST_LOGIN');
});
test('rejects malformed flag values', () => {
  expect(() => resolveTestLogin('development', 'yes')).toThrow('VITE_ENABLE_TEST_LOGIN');
});

import { resolveApiBaseUrl } from '@/config/env';
test.each(['development', 'mock', 'e2e', 'test'])('supplies a local API default in %s', mode => {
  expect(resolveApiBaseUrl(mode, undefined)).toBe('http://localhost:3001');
  expect(resolveApiBaseUrl(mode, 'https://api.example.invalid/api/v1/')).toBe(
    'https://api.example.invalid/api/v1'
  );
});
test.each(['production', 'staging'])('requires explicit release API in %s', mode => {
  expect(() => resolveApiBaseUrl(mode, undefined)).toThrow('VITE_API_BASE_URL');
  expect(resolveApiBaseUrl(mode, '/api/v1')).toBe('/api/v1');
});
test('an explicitly empty API never falls back to a different backend', () => {
  expect(() => resolveApiBaseUrl('development', '')).toThrow('VITE_API_BASE_URL');
});
