// @/utils/request.ts

// 导入 Pinia store，用于获取 token
import { useUserStore } from '@/store/modules/use-user-store'; 
// 导入配置
import config from '@/config';
// 导入类型定义
import type { RequestOptions, ApiResponse } from '@/types/api';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';
// 导入 Mock 拦截器
import { mockInterceptor } from '@/mock/mock-adapter';
// 初始化 Mock 路由（副作用导入，确保路由被注册）
import '@/mock/mock-routes';

// 全局刷新token的Promise缓存，避免竞态条件
let refreshTokenPromise: Promise<void> | null = null;

function buildUserFriendlyError(err: unknown): Error {
  return new Error(toUserFriendlyErrorMessage(err));
}

/**
 * 执行token刷新操作，返回Promise以便缓存和等待
 */
function performTokenRefresh(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const userStore = useUserStore();
    const refreshUrl = config.baseUrl + '/auth/refresh';
    
    // eslint-disable-next-line no-console
    console.log('[request] -> Refreshing Token', refreshUrl);
    
    uni.request({
      url: refreshUrl,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        // 携带 refresh token，具体视后端要求而定
         'Authorization': `Bearer ${userStore.refreshToken}` 
      },
      data: {},
      success: (refreshRes) => {
        const refreshData = refreshRes.data as any; // 简化类型
        if (refreshRes.statusCode >= 200 && refreshRes.statusCode < 300 && refreshData.code === 200 && refreshData.data?.token) {
          // eslint-disable-next-line no-console
          console.log('[request] Token refreshed successfully');
          const newToken = refreshData.data.token;
          
          // 更新 store 和 storage
          userStore.token = newToken.accessToken;
          uni.setStorageSync('token', newToken.accessToken);
          
          if (newToken.refreshToken) {
            userStore.refreshToken = newToken.refreshToken;
            uni.setStorageSync('refreshToken', newToken.refreshToken);
          }
          
          resolve();
        } else {
          // 刷新失败
          handleHttpError(401, refreshData);
          reject(buildUserFriendlyError(new Error('HTTP 401')));
        }
      },
      fail: (err) => {
        handleHttpError(401, {});
        reject(buildUserFriendlyError(err));
      }
    });
  });
}


/**
 * 封装的网络请求函数
 * @template T - API 响应中 data 字段的类型
 * @param {RequestOptions} options - 请求配置项
 * @returns {Promise<ApiResponse<T>>} 返回 Promise，resolve 的值是完整的 ApiResponse 对象
 */
async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  // --- 阶段零: Mock 拦截 ---
  // 如果开启了 Mock 且匹配到 Mock 路由，直接返回 Mock 数据
  const mockResponse = await mockInterceptor<T>(options);
  if (mockResponse !== null) {
    return mockResponse;
  }

  return new Promise<ApiResponse<T>>((resolve, reject) => {
    
    // --- 阶段一: 请求拦截器 ---
    // 在这里，我们对即将发出的请求进行最后加工

    const userStore = useUserStore();
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 核心：自动为需要授权的接口注入 Token
    if (userStore.token) {
      // 'Authorization' 是后端接口文档中约定的字段
      // 'Bearer ' 是 JWT 规范中推荐的前缀，具体看后端要求
      header['Authorization'] = `Bearer ${userStore.token}`;
    }

    // 允许页面传入自定义的 header 覆盖默认值
    if (options.header) {
      Object.assign(header, options.header);
    }

    // --- 阶段二: 发起 uniapp 网络请求 ---
    // 打印请求信息以便调试（可在开发时查看实际请求 URL）
    const fullUrl = config.baseUrl + options.url;
    // eslint-disable-next-line no-console
    console.log('[request] ->', options.method || 'GET', fullUrl, options.data || {});

    uni.request({
      // 1. 基础配置
      url: fullUrl, // 自动拼接完整的请求地址
      method: (options.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT',
      data: options.data || {},
      header: header,
      timeout: options.timeout || 15000, // 默认15秒超时

      // 2. 成功回调
      success: (res: UniApp.RequestSuccessCallbackResult) => {
        // --- 阶段三: 响应拦截器 ---
        // 在这里，我们对收到的响应进行预处理
        
        const statusCode = res.statusCode;
        // 类型断言：告诉 TypeScript 响应数据的结构
        const responseData = res.data as ApiResponse<T>;

        // 调试输出响应（开发时可用）
        // eslint-disable-next-line no-console
        console.log('[response] <-', statusCode, responseData, fullUrl);

        // 2.1 HTTP 状态码判断
        if (statusCode >= 200 && statusCode < 300) {
          
          // 2.2 业务状态码判断
          // 假设后端约定 code 为 200 或 201 代表业务成功
          if (responseData.code === 200 || responseData.code === 201) {
            // ✅ 请求完全成功，返回完整的 ApiResponse 对象
            resolve(responseData);
          } else {
            // 业务失败 (例如：参数错误、验证码错误等)
            // 业务失败，也 reject Promise，让页面中的 .catch() 能捕获到
            reject(buildUserFriendlyError(new Error(responseData.message || '操作失败')));
          }
        } else if (statusCode === 401) {
          // 401 未授权，尝试刷新 Token
          const userStore = useUserStore();
          
          // 如果是刷新 token 的请求本身失败了，或者没有 refresh token，则直接退出登录
          if (fullUrl.includes('/auth/refresh') || !userStore.refreshToken) {
            handleHttpError(statusCode, responseData);
            reject(buildUserFriendlyError(new Error(`HTTP ${statusCode}`)));
            return;
          }

          // 检查是否已有刷新操作在进行
          if (!refreshTokenPromise) {
            // 没有正在进行的刷新，发起新的刷新操作
            refreshTokenPromise = performTokenRefresh()
              .finally(() => {
                // 无论成功还是失败，都清除缓存的promise
                refreshTokenPromise = null;
              });
          }

          // 如果当前请求已经重试过一次，则不再尝试刷新并重试
          if ((options as any)._retry) {
            // 已经重试过，直接登出并返回错误
            handleHttpError(statusCode, responseData);
            reject(buildUserFriendlyError(new Error(`HTTP ${statusCode}`)));
            return;
          }

          // 等待刷新完成，然后重试原请求，确保重试时不会携带旧 Authorization
          refreshTokenPromise
            .then(() => {
              // 刷新成功，重试原请求
              // 确保不会使用旧的 Authorization header（如果调用方传入了 header.Authorization）
              const newOptions = {
                ...(options as any),
                _retry: true,
                header: options.header ? { ...options.header } : undefined,
              } as RequestOptions & { _retry?: boolean };
              if (newOptions.header && newOptions.header['Authorization']) {
                delete newOptions.header['Authorization'];
              }
              request<T>(newOptions).then(resolve).catch(reject);
            })
            .catch((error) => {
              // 刷新失败，直接reject
              reject(buildUserFriendlyError(error));
            });
        } else {
          // HTTP 状态码非 2xx，代表请求出错了（404, 500 等）
          // 交给统一的错误处理器
          handleHttpError(statusCode, responseData);
          reject(buildUserFriendlyError(new Error(`HTTP ${statusCode}`)));
        }
      },

      // 3. 失败回调 (网络层面，比如断网)
      fail: (err: UniApp.GeneralCallbackResult) => {
        console.error('网络请求失败:', err);
        reject(buildUserFriendlyError(new Error('网络连接异常')));
      },
    });
  });
}

/**
 * 独立的 HTTP 错误处理函数，让代码更清晰
 * @param {number} statusCode - HTTP 状态码
 * @param {any} responseData - 响应数据
 */
function handleHttpError(statusCode: number, responseData: any): void {
  let message = '';
  switch (statusCode) {
    case 401:
      message = '登录状态已过期，请重新登录';
      // 清除本地的用户信息和 token
      const userStore = useUserStore();
      userStore.logoutAction();
      // 跳转到登录页
      uni.reLaunch({
        url: '/pages/login/index' 
      });
      break;
    case 403:
      message = '没有权限执行此操作';
      break;
    case 404:
      message = '请求的资源不存在';
      break;
    case 500:
      message = '服务器内部错误';
      break;
    default:
      message = `请求错误 - ${statusCode}`;
  }
}

// 导出封装好的 request 函数
export default request;