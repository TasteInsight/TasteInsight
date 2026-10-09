import { resolveTestLogin } from '@/config/env';

test.each(['development','e2e','production','staging'])('test login defaults off in %s', mode => {
  expect(resolveTestLogin(mode,undefined)).toBe(false);
  expect(resolveTestLogin(mode,'false')).toBe(false);
});
test.each(['development','e2e'])('explicitly allows test login only in %s', mode => {
  expect(resolveTestLogin(mode,'true')).toBe(true);
});
test.each(['production','staging','mock'])('rejects test login in %s', mode => {
  expect(()=>resolveTestLogin(mode,'true')).toThrow('VITE_ENABLE_TEST_LOGIN');
});
test('rejects malformed flag values', () => {
  expect(()=>resolveTestLogin('development','yes')).toThrow('VITE_ENABLE_TEST_LOGIN');
});
