// @/utils/request.ts

// 导入 Pinia store，用于获取 token
import { useUserStore } from '@/store/modules/use-user-store'; 
// 导入配置
import config from '@/config';
// 导入类型定义
import type { RequestOptions, ApiResponse } from '@/types/api';

/**
 * 封装的网络请求函数
 * @template T - API 响应中 data 字段的类型
 * @param {RequestOptions} options - 请求配置项
 * @returns {Promise<ApiResponse<T>>} 返回 Promise，resolve 的值是完整的 ApiResponse 对象
 */
function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  return new Promise<ApiResponse<T>>((resolve, reject) => {
    
    // --- 阶段一: 请求拦截器 ---
    // 在这里，我们对即将发出的请求进行最后加工

    const userStore = useUserStore();
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.header, // 允许页面传入自定义的 header
    };

    // 核心：自动为需要授权的接口注入 Token
    if (userStore.token) {
      // 'Authorization' 是后端接口文档中约定的字段
      // 'Bearer ' 是 JWT 规范中推荐的前缀，具体看后端要求
      header['Authorization'] = `Bearer ${userStore.token}`;
    }

    // --- 阶段二: 发起 uniapp 网络请求 ---
    uni.request({
      // 1. 基础配置
      url: config.baseUrl + options.url, // 自动拼接完整的请求地址
      method: options.method || 'GET',
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

        // 2.1 HTTP 状态码判断
        if (statusCode >= 200 && statusCode < 300) {
          
          // 2.2 业务状态码判断
          // 假设后端约定 code 为 200 或 201 代表业务成功
          if (responseData.code === 200 || responseData.code === 201) {
            // ✅ 请求完全成功，返回完整的 ApiResponse 对象
            resolve(responseData);
          } else {
            // 业务失败 (例如：参数错误、验证码错误等)
            // 统一弹出错误提示
            uni.showToast({
              title: responseData.message || '操作失败',
              icon: 'none',
            });
            // 业务失败，也 reject Promise，让页面中的 .catch() 能捕获到
            reject(new Error(responseData.message || '操作失败'));
          }
        } else {
          // HTTP 状态码非 2xx，代表请求出错了（404, 500 等）
          // 交给统一的错误处理器
          handleHttpError(statusCode, responseData);
          reject(new Error(`HTTP ${statusCode}`));
        }
      },

      // 3. 失败回调 (网络层面，比如断网)
      fail: (err: UniApp.GeneralCallbackResult) => {
        console.error('网络请求失败:', err);
        uni.showToast({
          title: '网络连接异常，请稍后重试',
          icon: 'none',
        });
        reject(new Error('网络连接异常'));
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

  uni.showToast({
    title: message,
    icon: 'none',
  });
}

// 导出封装好的 request 函数
export default request;