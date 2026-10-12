import request from '@/utils/request';
import { uploadImage } from '@/api/modules/upload';
import { useUserStore } from '@/store/modules/use-user-store';
import { mockInterceptor } from '@/mock/mock-adapter';

jest.mock('@/store/modules/use-user-store');
jest.mock('@/config', () => ({ baseUrl: 'http://api.test' }));
jest.mock('@/mock/mock-adapter', () => ({
  USE_MOCK: false,
  mockInterceptor: jest.fn(),
  registerMockRoute: jest.fn(),
}));

describe('image upload authentication lifecycle', () => {
  let user: any;
  beforeEach(() => {
    jest.clearAllMocks();
    user = {
      token: 'old',
      refreshToken: 'refresh',
      sessionVersion: 1,
      updateTokens: jest.fn((_version, token, refresh) => {
        user.token = token;
        user.refreshToken = refresh;
        return true;
      }),
      logoutAction: jest.fn(),
    };
    (useUserStore as unknown as jest.Mock).mockReturnValue(user);
    (mockInterceptor as jest.Mock).mockResolvedValue(null);
    (global as any).uni = { request: jest.fn(), uploadFile: jest.fn(), reLaunch: jest.fn() };
  });

  test('refreshes once and retries a contribution image with current credentials', async () => {
    (uni.request as jest.Mock).mockImplementation(({ success }) =>
      success({
        statusCode: 200,
        data: { code: 200, data: { token: { accessToken: 'new', refreshToken: 'next' } } },
      })
    );
    (uni.uploadFile as jest.Mock).mockImplementation(({ header, success }) =>
      success({
        statusCode: header.Authorization === 'Bearer old' ? 401 : 200,
        data: JSON.stringify({
          code: 200,
          data: { url: 'https://cdn.test/image.jpg', filename: 'image.jpg' },
        }),
      })
    );
    await expect(
      uploadImage('/image.jpg', { purpose: 'dish-contribution' })
    ).resolves.toMatchObject({ filename: 'image.jpg' });
    expect(uni.request).toHaveBeenCalledTimes(1);
    expect(uni.uploadFile).toHaveBeenCalledTimes(2);
    expect(uni.uploadFile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: 'http://api.test/upload/image?purpose=dish-contribution',
        header: { Authorization: 'Bearer new' },
      })
    );
  });

  test('normal requests and uploads share one refresh operation', async () => {
    let finishRefresh: any;
    (uni.request as jest.Mock).mockImplementation(({ url, header, success }) => {
      if (url.endsWith('/auth/refresh')) {
        finishRefresh = success;
        return;
      }
      success({
        statusCode: header.Authorization === 'Bearer old' ? 401 : 200,
        data: { code: 200, data: {} },
      });
    });
    (uni.uploadFile as jest.Mock).mockImplementation(({ header, success }) =>
      success({
        statusCode: header.Authorization === 'Bearer old' ? 401 : 200,
        data: JSON.stringify({
          code: 200,
          data: { url: 'https://cdn.test/x.jpg', filename: 'x.jpg' },
        }),
      })
    );
    const image = uploadImage('/image.jpg');
    const query = request({ url: '/user/uploads' });
    await Promise.resolve();
    finishRefresh({
      statusCode: 200,
      data: { code: 200, data: { token: { accessToken: 'new', refreshToken: 'next' } } },
    });
    await Promise.all([image, query]);
    expect(
      (uni.request as jest.Mock).mock.calls.filter(([options]) =>
        options.url.endsWith('/auth/refresh')
      )
    ).toHaveLength(1);
  });

  test('does not retry an upload under a replacement account', async () => {
    let finishRefresh: any;
    (uni.request as jest.Mock).mockImplementation(({ success }) => {
      finishRefresh = success;
    });
    (uni.uploadFile as jest.Mock).mockImplementation(({ success }) =>
      success({ statusCode: 401, data: '{}' })
    );
    const pending = uploadImage('/image.jpg');
    const result = expect(pending).rejects.toThrow('登录会话已变更');
    await Promise.resolve();
    user.sessionVersion += 1;
    user.token = 'other-account';
    finishRefresh({
      statusCode: 200,
      data: { code: 200, data: { token: { accessToken: 'new', refreshToken: 'next' } } },
    });
    await result;
    expect(uni.uploadFile).toHaveBeenCalledTimes(1);
    expect(user.updateTokens).not.toHaveBeenCalled();
    expect(user.logoutAction).not.toHaveBeenCalled();
  });

  test('keeps the account and draft owner during a transient refresh failure', async () => {
    (uni.request as jest.Mock).mockImplementation(({ fail }) =>
      fail({ errMsg: 'request:fail timeout' })
    );
    (uni.uploadFile as jest.Mock).mockImplementation(({ success }) =>
      success({ statusCode: 401, data: '{}' })
    );
    await expect(uploadImage('/image.jpg')).rejects.toThrow('网络开小差');
    expect(user.logoutAction).not.toHaveBeenCalled();
    expect(user.sessionVersion).toBe(1);
    expect(uni.uploadFile).toHaveBeenCalledTimes(1);
  });

  test('preserves actionable authorization and conflict messages', async () => {
    (uni.request as jest.Mock).mockImplementation(({ success }) =>
      success({
        statusCode: 403,
        data: { code: 'STUDENT_VERIFICATION_REQUIRED', message: '请先完成有效的在校学生认证' },
      })
    );
    await expect(request({ url: '/dishes/upload', method: 'POST' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'STUDENT_VERIFICATION_REQUIRED',
      message: '请先完成有效的在校学生认证',
    });
  });
});
