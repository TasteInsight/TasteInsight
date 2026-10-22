import { locale } from '@/i18n';
import { createHttpError } from '@/utils/user-friendly-error';

afterEach(() => {
  locale.value = 'zh-Hans';
});

test.each([
  ['INVALID_VERIFICATION_CODE', 400, 'This code is invalid or expired'],
  ['VERIFICATION_RATE_LIMITED', 429, 'Too many code requests'],
  ['STUDENT_VERIFICATION_REQUIRED', 403, 'Complete student verification'],
  ['DIETARY_CONFLICT', 400, 'saved allergies'],
  ['ACTIVE_DINING_INVITATION', 409, 'Cancel the relevant dining invitations'],
  ['INVALID_CAMPUS_CONFIRMATION', 400, 'Start verification again'],
])('localizes %s while preserving its machine code and status', (code, status, text) => {
  locale.value = 'en';
  const error = createHttpError(status, { code, message: '中文服务端提示' });
  expect(error.message).toContain(text);
  expect(error).toMatchObject({ code, statusCode: status });
});

test('retains original details for unknown business errors and translates the same code in Chinese', () => {
  locale.value = 'en';
  expect(createHttpError(400, { message: 'Original review reason' }).message).toBe(
    'Original review reason'
  );
  locale.value = 'zh-Hans';
  expect(createHttpError(400, { code: 'DIETARY_CONFLICT', message: 'server' }).message).toContain(
    '忌口食材'
  );
});

test('localizes a deleted resource instead of displaying the backend system message', () => {
  locale.value = 'en';
  expect(createHttpError(404, { message: '菜品不存在' }).message).toBe(
    'The requested resource was not found.'
  );
});
