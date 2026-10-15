import { effectScope, ref, type Ref } from 'vue';
import config from '@/config';
import { useWechatAuthorization } from '@/composables/use-wechat-authorization';

jest.mock('@/config', () => ({ __esModule: true, default: { platform: 'mp-weixin' } }));

const scopes: ReturnType<typeof effectScope>[] = [];
function authorization(enabled?: Ref<boolean>) {
  const scope = effectScope();
  scopes.push(scope);
  return { scope, ...scope.run(() => useWechatAuthorization(enabled))! };
}

beforeEach(() => {
  config.platform = 'mp-weixin';
  uni.getProvider = jest.fn();
  uni.login = jest.fn(({ success }: any) => success({ code: 'authorization-code' }));
});
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

test('miniapp authorization preserves its own login contract', async () => {
  const auth = authorization();
  expect(auth.available.value).toBe(true);
  expect(uni.getProvider).not.toHaveBeenCalled();
  await expect(auth.authorize()).resolves.toBe('authorization-code');
  expect(uni.login).toHaveBeenCalledWith(expect.objectContaining({ provider: 'weixin' }));
  expect((uni.login as jest.Mock).mock.calls[0][0]).not.toHaveProperty('onlyAuthorize');
});

test.each(['app', 'app-plus'])(
  'native %s uses onlyAuthorize after SDK provider discovery',
  async platform => {
    config.platform = platform;
    const auth = authorization();
    expect(auth.available.value).toBe(false);
    (uni.getProvider as jest.Mock).mock.calls[0][0].success({ provider: ['weixin'] });
    expect(auth.available.value).toBe(true);
    await expect(auth.authorize()).resolves.toBe('authorization-code');
    expect(uni.login).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'weixin', onlyAuthorize: true })
    );
  }
);

test('web does not invoke an unavailable native login API', async () => {
  config.platform = 'h5';
  const auth = authorization();
  expect(auth.available.value).toBe(false);
  await expect(auth.authorize()).rejects.toThrow('当前平台未配置微信登录');
  expect(uni.getProvider).not.toHaveBeenCalled();
  expect(uni.login).not.toHaveBeenCalled();
});

test('provider discovery cannot reactivate a disposed scope', async () => {
  config.platform = 'app';
  const auth = authorization();
  const discovery = (uni.getProvider as jest.Mock).mock.calls[0][0];
  auth.scope.stop();
  discovery.success({ provider: ['weixin'] });
  expect(auth.available.value).toBe(false);
  await expect(auth.authorize()).rejects.toThrow('当前平台未配置微信登录');
  expect(uni.login).not.toHaveBeenCalled();
});

test('disabled native WeChat does not probe an optional OAuth module', async () => {
  config.platform = 'app';
  const enabled = ref(false);
  const auth = authorization(enabled);
  expect(uni.getProvider).not.toHaveBeenCalled();
  await expect(auth.authorize()).rejects.toThrow('当前平台未配置微信登录');
  expect(uni.login).not.toHaveBeenCalled();
  enabled.value = true;
  expect(auth.checking.value).toBe(true);
  const discovery = (uni.getProvider as jest.Mock).mock.calls[0][0];
  enabled.value = false;
  discovery.success({ provider: ['weixin'] });
  expect(auth.available.value).toBe(false);
  expect(auth.checking.value).toBe(false);
});

test('miniapp policy changes availability without invoking a native provider API', () => {
  const enabled = ref(false);
  const auth = authorization(enabled);
  expect(auth.available.value).toBe(false);
  enabled.value = true;
  expect(auth.available.value).toBe(true);
  enabled.value = false;
  expect(auth.available.value).toBe(false);
  expect(uni.getProvider).not.toHaveBeenCalled();
});
