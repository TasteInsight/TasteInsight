import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * 创建 axios 实例
 * 注意：请根据实际后端服务地址配置 VITE_API_BASE_URL 环境变量
 * 在项目根目录创建 .env 文件，添加：VITE_API_BASE_URL=https://your-api-domain.com
 */
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器 - 添加 token
 */
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器 - 处理错误
 */
request.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // 401 未授权，清除 token 并跳转到登录页
      if (status === 401) {
        localStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin_token');
        // 这里不直接跳转，由调用方处理
      }

      // 返回错误信息
      const message = data?.message || data?.error || '请求失败，请稍后重试';
      return Promise.reject(new Error(message));
    } else if (error.request) {
      return Promise.reject(new Error('网络连接失败，请检查网络'));
    } else {
      return Promise.reject(error);
    }
  }
);

export default request;

