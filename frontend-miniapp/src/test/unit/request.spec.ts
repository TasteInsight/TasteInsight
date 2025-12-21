import request from '@/utils/request';
import { useUserStore } from '@/store/modules/use-user-store';
import { mockInterceptor } from '@/mock/mock-adapter';
import config from '@/config';
import { setActivePinia, createPinia } from 'pinia';

// Mock dependencies
jest.mock('@/store/modules/use-user-store');
jest.mock('@/mock/mock-adapter');
jest.mock('@/config', () => ({
  baseUrl: 'http://api.test',
}));

// Mock uni-app APIs
const mockRequest = jest.fn();
const mockShowToast = jest.fn();
const mockReLaunch = jest.fn();
const mockSetStorageSync = jest.fn();

(global as any).uni = {
  request: mockRequest,
  showToast: mockShowToast,
  reLaunch: mockReLaunch,
  setStorageSync: mockSetStorageSync,
};

describe('request utils', () => {
  let mockUserStore: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();

    // Setup User Store Mock
    mockUserStore = {
      token: null,
      refreshToken: null,
      logoutAction: jest.fn(),
    };
    (useUserStore as unknown as jest.Mock).mockReturnValue(mockUserStore);

    // Default Mock Interceptor to return null (pass through)
    (mockInterceptor as jest.Mock).mockResolvedValue(null);
  });

  it('should return mock response if interceptor handles it', async () => {
    const mockData = { code: 200, data: 'mocked' };
    (mockInterceptor as jest.Mock).mockResolvedValue(mockData);

    const response = await request({ url: '/test' });
    expect(response).toEqual(mockData);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('should add Authorization header if token exists', async () => {
    mockUserStore.token = 'test-token';
    mockRequest.mockImplementation((opts) => {
      opts.success({ statusCode: 200, data: { code: 200, data: 'ok' } });
    });

    await request({ url: '/test' });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      header: expect.objectContaining({
        Authorization: 'Bearer test-token',
      }),
    }));
  });

  it('should resolve on success (200)', async () => {
    const responseData = { code: 200, data: 'success' };
    mockRequest.mockImplementation((opts) => {
      opts.success({ statusCode: 200, data: responseData });
    });

    const result = await request({ url: '/test' });
    expect(result).toEqual(responseData);
  });

  it('should reject on business error (code != 200/201)', async () => {
    const responseData = { code: 400, message: 'Bad Request' };
    mockRequest.mockImplementation((opts) => {
      opts.success({ statusCode: 200, data: responseData });
    });

    await expect(request({ url: '/test' })).rejects.toThrow('Bad Request');
  });

  it('should reject on network failure', async () => {
    mockRequest.mockImplementation((opts) => {
      opts.fail({ errMsg: 'Network Error' });
    });

    await expect(request({ url: '/test' })).rejects.toThrow('网络开小差了，请检查网络后重试');
  });

  it('should handle 401 and refresh token successfully', async () => {
    mockUserStore.token = 'expired-token';
    mockUserStore.refreshToken = 'valid-refresh-token';

    // 1. First request fails with 401
    mockRequest.mockImplementationOnce((opts) => {
      opts.success({ statusCode: 401, data: { code: 401 } });
    })
    // 2. Refresh request succeeds
    .mockImplementationOnce((opts) => {
      if (opts.url.includes('/auth/refresh')) {
        opts.success({
          statusCode: 200,
          data: {
            code: 200,
            data: { token: { accessToken: 'new-token', refreshToken: 'new-refresh-token' } }
          }
        });
      } else {
        opts.fail({ errMsg: 'Unexpected request' });
      }
    })
    // 3. Retry request succeeds
    .mockImplementationOnce((opts) => {
       opts.success({ statusCode: 200, data: { code: 200, data: 'retried success' } });
    });

    const result = await request({ url: '/test' });

    expect(result).toEqual({ code: 200, data: 'retried success' });
    expect(mockUserStore.token).toBe('new-token');
    expect(mockSetStorageSync).toHaveBeenCalledWith('token', 'new-token');
  });

  it('should logout if 401 and no refresh token', async () => {
    mockUserStore.token = 'expired-token';
    mockUserStore.refreshToken = null; // No refresh token

    mockRequest.mockImplementation((opts) => {
      opts.success({ statusCode: 401, data: { code: 401 } });
    });

    await expect(request({ url: '/test' })).rejects.toThrow('登录已过期，请重新登录');
    expect(mockUserStore.logoutAction).toHaveBeenCalled();
    expect(mockReLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  it('should logout if refresh token fails', async () => {
    mockUserStore.token = 'expired-token';
    mockUserStore.refreshToken = 'invalid-refresh-token';

    // First request fails with 401
    mockRequest.mockImplementationOnce((opts) => {
       opts.success({ statusCode: 401, data: { code: 401 } });
    });
    
    // Refresh request fails
    mockRequest.mockImplementationOnce((opts) => {
       if (opts.url.includes('/auth/refresh')) {
         opts.success({ statusCode: 401, data: { code: 401 } });
       }
    });

    await expect(request({ url: '/test' })).rejects.toThrow('登录已过期，请重新登录');
    // The refresh failure logic calls handleHttpError(401)
    expect(mockUserStore.logoutAction).toHaveBeenCalled();
    expect(mockReLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  it('should handle other HTTP errors (e.g., 500)', async () => {
    mockRequest.mockImplementation((opts) => {
      opts.success({ statusCode: 500, data: { message: 'Server Error' } });
    });

    await expect(request({ url: '/test' })).rejects.toThrow('服务器开小差了，请稍后再试');
  });
});
