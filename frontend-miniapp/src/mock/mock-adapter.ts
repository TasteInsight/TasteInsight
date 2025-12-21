/**
 * Mock 适配器 - 统一拦截请求并返回 mock 数据
 * 
 * 使用路由注册表模式，将 URL 模式与 mock 处理函数关联
 * 这样 API 模块不需要关心是否使用 mock，完全解耦
 */

import type { ApiResponse, RequestOptions } from '@/types/api';

// Mock 配置
export const USE_MOCK = false;
// Mock 处理函数类型
type MockHandler<T = any> = (
  url: string,
  options: RequestOptions,
  params: Record<string, string>
) => Promise<ApiResponse<T>>;

// Mock 路由配置
interface MockRoute {
  pattern: RegExp;
  method: string;
  handler: MockHandler;
}

// Mock 路由注册表
const mockRoutes: MockRoute[] = [];

/**
 * 注册 Mock 路由
 * @param method HTTP 方法
 * @param pattern URL 模式（支持路径参数，如 /dishes/:id）
 * @param handler Mock 处理函数
 */
export function registerMockRoute<T = any>(
  method: string,
  pattern: string,
  handler: MockHandler<T>
): void {
  // 将路径模式转换为正则表达式
  // /dishes/:id -> /dishes/([^/]+)
  const regexPattern = pattern
    .replace(/:[^/]+/g, '([^/]+)')
    .replace(/\//g, '\\/');
  
  mockRoutes.push({
    pattern: new RegExp(`^${regexPattern}$`),
    method: method.toUpperCase(),
    handler,
  });
}

/**
 * 从 URL 中提取路径参数
 */
function extractParams(url: string, pattern: RegExp, template: string): Record<string, string> {
  const params: Record<string, string> = {};
  const match = url.match(pattern);
  
  if (match) {
    // 提取模板中的参数名
    const paramNames = template.match(/:[^/]+/g) || [];
    paramNames.forEach((name, index) => {
      params[name.slice(1)] = match[index + 1]; // 去掉冒号
    });
  }
  
  return params;
}

/**
 * 查找匹配的 Mock 路由
 */
export function findMockRoute(
  url: string,
  method: string
): { handler: MockHandler; params: Record<string, string> } | null {
  const normalizedMethod = method.toUpperCase();
  
  for (const route of mockRoutes) {
    if (route.method === normalizedMethod && route.pattern.test(url)) {
      // 需要从原始模式获取参数名，这里简化处理
      const params: Record<string, string> = {};
      const match = url.match(route.pattern);
      if (match) {
        // 将匹配的组存入 params（使用索引作为临时键）
        match.slice(1).forEach((value, index) => {
          params[`$${index}`] = value;
        });
      }
      return { handler: route.handler, params };
    }
  }
  
  return null;
}

/**
 * Mock 请求拦截器
 * 如果找到匹配的 mock 路由，返回 mock 数据
 * 否则返回 null，让真实请求继续
 */
export async function mockInterceptor<T>(
  options: RequestOptions
): Promise<ApiResponse<T> | null> {
  if (!USE_MOCK) {
    console.debug('[Mock] Mock disabled');
    return null;
  }
  
  const url = options.url;
  const method = options.method || 'GET';
  
  console.log('[Mock] Checking route:', method, url);
  const match = findMockRoute(url, method);
  
  if (match) {
    console.log('[Mock] 拦截请求:', method, url);
    try {
      const response = await match.handler(url, options, match.params);
      console.log('[Mock] 返回数据:', response);
      return response as ApiResponse<T>;
    } catch (error) {
      console.error('[Mock] 处理失败:', error);
      return {
        code: 500,
        message: 'Mock 处理失败',
        data: null as any,
      };
    }
  }
  
  return null;
}

/**
 * 创建成功响应
 */
export function mockSuccess<T>(data: T, message = 'success'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
  };
}

/**
 * 创建失败响应
 */
export function mockError(code: number, message: string): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
  };
}
