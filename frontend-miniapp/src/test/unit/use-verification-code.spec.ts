import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { useVerificationCode } from '@/composables/use-verification-code';
import { useUserStore } from '@/store/modules/use-user-store';

const scopes: ReturnType<typeof effectScope>[] = [];
const challenge = (id = 'challenge') => ({
  code: 200,
  message: 'success',
  data: { challengeId: id, expiresIn: 300, retryAfter: 60 },
});
function deferred() {
  let resolve!: (value: ReturnType<typeof challenge>) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<ReturnType<typeof challenge>>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function verification(send = jest.fn().mockResolvedValue(challenge())) {
  const scope = effectScope();
  scopes.push(scope);
  return { state: scope.run(() => useVerificationCode(send))!, send, scope };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-09T00:00:00Z'));
  Object.assign(uni, {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('sends once while pending and blocks resend until the server cooldown elapses', async () => {
  const pending = deferred();
  const { state, send } = verification(jest.fn().mockReturnValue(pending.promise));
  state.target.value = ' 13800138000 ';
  await nextTick();
  const first = state.sendCode();
  await state.sendCode();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('13800138000');
  pending.resolve(challenge());
  await first;
  expect(state.remaining.value).toBe(60);
  await state.sendCode();
  jest.advanceTimersByTime(59000);
  await state.sendCode();
  expect(send).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000);
  send.mockResolvedValue(challenge('replacement'));
  await state.sendCode();
  expect(send).toHaveBeenCalledTimes(2);
  expect(state.challengeId.value).toBe('replacement');
});

test('a replacement challenge cannot be verified with the previous code during or after resend', async () => {
  const { state, send } = verification();
  state.target.value = 'student@campus.test';
  await nextTick();
  await state.sendCode();
  state.code.value = '123456';
  expect(state.canVerify.value).toBe(true);
  jest.advanceTimersByTime(60000);
  const pending = deferred();
  send.mockReturnValue(pending.promise);
  const resend = state.sendCode();
  expect(state.canVerify.value).toBe(false);
  pending.resolve(challenge('replacement'));
  await resend;
  expect(state.challengeId.value).toBe('replacement');
  expect(state.code.value).toBe('');
  expect(state.canVerify.value).toBe(false);
});

test('changing the target synchronously clears its challenge, code and target-specific cooldown', async () => {
  const { state, send } = verification();
  state.target.value = '13800138000';
  await nextTick();
  await state.sendCode();
  state.code.value = '123456';
  expect(state.canVerify.value).toBe(true);
  state.target.value = '13900139000';
  expect(state.canVerify.value).toBe(false);
  expect(state.challengeId.value).toBe('');
  expect(state.code.value).toBe('');
  expect(state.remaining.value).toBe(0);
  await state.sendCode();
  expect(send).toHaveBeenLastCalledWith('13900139000');
});

test.each(['success', 'failure'])(
  'a previous session send %s cannot populate or finish the new send',
  async outcome => {
    const previous = deferred();
    const current = deferred();
    const { state, send } = verification(
      jest.fn().mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise)
    );
    state.target.value = 'student-a@campus.test';
    await nextTick();
    const first = state.sendCode();
    useUserStore().logoutAction();
    expect(state.target.value).toBe('');
    expect(state.sending.value).toBe(false);
    state.target.value = 'student-b@campus.test';
    const second = state.sendCode();
    expect(send).toHaveBeenCalledTimes(2);
    if (outcome === 'success') previous.resolve(challenge('previous'));
    else previous.reject(new Error('old delivery failed'));
    await first;
    expect(state.sending.value).toBe(true);
    expect(state.challengeId.value).toBe('');
    expect(state.error.value).toBe('');
    current.resolve(challenge('current'));
    await second;
    expect(state.sending.value).toBe(false);
    expect(state.challengeId.value).toBe('current');
  }
);

test('only a six-digit code is eligible and eligibility ends at the challenge expiry', async () => {
  const { state } = verification();
  state.target.value = '13800138000';
  await nextTick();
  await state.sendCode();
  for (const code of ['', '12345', '1234567', 'abcdef']) {
    state.code.value = code;
    expect(state.canVerify.value).toBe(false);
  }
  state.code.value = '000000';
  expect(state.canVerify.value).toBe(true);
  jest.advanceTimersByTime(299000);
  expect(state.canVerify.value).toBe(true);
  jest.advanceTimersByTime(1000);
  expect(state.canVerify.value).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('a failed delivery exposes a retry and never creates a usable challenge', async () => {
  const { state, send } = verification(jest.fn().mockRejectedValue(new Error('发送失败')));
  state.target.value = '13800138000';
  await nextTick();
  await state.sendCode();
  expect(state.error.value).toBe('发送失败');
  expect(state.sending.value).toBe(false);
  expect(state.challengeId.value).toBe('');
  expect(state.remaining.value).toBe(0);
  send.mockResolvedValue(challenge());
  await state.sendCode();
  expect(state.error.value).toBe('');
  expect(state.challengeId.value).toBe('challenge');
});

test('a disposed form ignores late challenge delivery and does not start a timer', async () => {
  const pending = deferred();
  const { state, scope } = verification(jest.fn().mockReturnValue(pending.promise));
  state.target.value = '13800138000';
  await nextTick();
  const sent = state.sendCode();
  scope.stop();
  pending.resolve(challenge());
  await sent;
  expect(state.challengeId.value).toBe('');
  expect(jest.getTimerCount()).toBe(0);
});
