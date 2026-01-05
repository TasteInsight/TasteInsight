/**
 * K6 性能测试工具函数
 * 
 * 包含登录、随机选择、响应验证等通用功能
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, API_PATHS, DEFAULT_HEADERS, getAuthHeaders } from './config.js';

// ==================== 自定义指标 ====================
export const loginSuccessRate = new Rate('login_success_rate');
export const requestErrors = new Counter('request_errors');
export const loginDuration = new Trend('login_duration');

// ==================== 缓存管理 ====================
// 用于存储 Token，避免每次请求都登录
const tokenCache = {};

/**
 * 管理员登录并获取 JWT Token
 * 
 * 【代码核实】
 * - Controller: @Controller('auth')
 * - 方法: @Post('admin/login') 
 * - 完整路由: POST /auth/admin/login
 * - 请求体 DTO (AdminLoginDto):
 *   - username: string (必填, @IsString, @IsNotEmpty)
 *   - password: string (必填, @IsString, @IsNotEmpty, @MinLength(6))
 * - 响应格式: { code: 200, data: { token: { accessToken: string, refreshToken: string }, admin: {...} } }
 * 
 * @param {string} username - 管理员用户名
 * @param {string} password - 管理员密码
 * @param {boolean} useCache - 是否使用缓存的 Token
 * @returns {string|null} JWT Token 或 null
 */
export function adminLogin(username, password, useCache = true) {
    const cacheKey = `admin_${username}`;
    
    // 检查缓存
    if (useCache && tokenCache[cacheKey]) {
        return tokenCache[cacheKey];
    }
    
    const url = `${BASE_URL}${API_PATHS.AUTH.ADMIN_LOGIN}`;
    const payload = JSON.stringify({
        username: username,
        password: password,
    });
    
    const startTime = Date.now();
    const response = http.post(url, payload, {
        headers: DEFAULT_HEADERS,
        tags: { name: 'admin_login' },
    });
    const duration = Date.now() - startTime;
    
    loginDuration.add(duration);
    
    // 验证响应
    // 后端返回格式: { code: 200, data: { token: { accessToken: "xxx" } } }
    const success = check(response, {
        '登录状态码为 200': (r) => r.status === 200,
        '响应包含 accessToken': (r) => {
            try {
                const body = JSON.parse(r.body);
                // 兼容两种响应格式
                return (body.data && body.data.token && body.data.token.accessToken) || 
                       body.access_token !== undefined;
            } catch {
                return false;
            }
        },
    });
    
    loginSuccessRate.add(success ? 1 : 0);
    
    if (!success) {
        console.error(`登录失败: status=${response.status}, body=${response.body}`);
        requestErrors.add(1);
        return null;
    }
    
    try {
        const body = JSON.parse(response.body);
        // 兼容两种响应格式
        const token = (body.data && body.data.token && body.data.token.accessToken) || 
                      body.access_token;
        
        // 缓存 Token
        if (useCache) {
            tokenCache[cacheKey] = token;
        }
        
        return token;
    } catch (e) {
        console.error(`解析登录响应失败: ${e.message}`);
        requestErrors.add(1);
        return null;
    }
}

/**
 * 清除 Token 缓存
 * @param {string} username - 用户名，不传则清除所有
 */
export function clearTokenCache(username = null) {
    if (username) {
        delete tokenCache[`admin_${username}`];
    } else {
        Object.keys(tokenCache).forEach(key => delete tokenCache[key]);
    }
}

/**
 * 从数组中随机选择一个元素
 * @param {Array} array - 源数组
 * @returns {*} 随机选中的元素
 */
export function randomChoice(array) {
    if (!array || array.length === 0) {
        return null;
    }
    const index = Math.floor(Math.random() * array.length);
    return array[index];
}

/**
 * 生成带时间戳的随机名称
 * @param {string} prefix - 前缀
 * @returns {string} 随机名称
 */
export function generateRandomName(prefix = 'K6_TEST') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * 通用的响应检查函数
 * @param {object} response - HTTP 响应对象
 * @param {string} operationName - 操作名称，用于日志
 * @param {number} expectedStatus - 期望的状态码，默认 200
 * @returns {boolean} 是否成功
 */
export function checkResponse(response, operationName, expectedStatus = 200) {
    const success = check(response, {
        [`${operationName} - 状态码正确`]: (r) => r.status === expectedStatus,
    });
    
    if (!success) {
        console.error(`${operationName} 失败: status=${response.status}, body=${response.body}`);
        requestErrors.add(1);
    }
    
    return success;
}

/**
 * 解析响应体
 * @param {object} response - HTTP 响应对象
 * @returns {object|null} 解析后的 JSON 对象或 null
 */
export function parseResponseBody(response) {
    try {
        return JSON.parse(response.body);
    } catch (e) {
        console.error(`解析响应体失败: ${e.message}`);
        return null;
    }
}

/**
 * 安全提取列表数据
 * 后端响应格式通常为: { code: 200, message: 'success', data: { items: [...], total: number, ... } }
 * 或者直接是: { items: [...], total: number, ... }
 * 
 * @param {object} responseBody - 解析后的响应体
 * @returns {Array} 列表数据
 */
export function extractListItems(responseBody) {
    if (!responseBody) {
        return [];
    }
    
    // 尝试多种响应格式
    // 格式1: { data: { items: [...] } }
    if (responseBody.data && Array.isArray(responseBody.data.items)) {
        return responseBody.data.items;
    }
    
    // 格式2: { items: [...] }
    if (Array.isArray(responseBody.items)) {
        return responseBody.items;
    }
    
    // 格式3: { data: [...] }
    if (Array.isArray(responseBody.data)) {
        return responseBody.data;
    }
    
    // 格式4: 直接是数组
    if (Array.isArray(responseBody)) {
        return responseBody;
    }
    
    return [];
}

/**
 * GET 请求封装
 * @param {string} path - API 路径
 * @param {string} token - JWT Token
 * @param {string} tagName - 请求标签名称
 * @param {object} params - URL 查询参数
 * @returns {object} HTTP 响应
 */
export function httpGet(path, token, tagName, params = {}) {
    // 构建 URL 参数
    const queryString = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    
    const url = queryString ? `${BASE_URL}${path}?${queryString}` : `${BASE_URL}${path}`;
    
    return http.get(url, {
        headers: getAuthHeaders(token),
        tags: { name: tagName },
    });
}

/**
 * POST 请求封装
 * @param {string} path - API 路径
 * @param {object} body - 请求体
 * @param {string} token - JWT Token
 * @param {string} tagName - 请求标签名称
 * @returns {object} HTTP 响应
 */
export function httpPost(path, body, token, tagName) {
    const url = `${BASE_URL}${path}`;
    const payload = JSON.stringify(body);
    
    return http.post(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: tagName },
    });
}

/**
 * PUT 请求封装
 * @param {string} path - API 路径
 * @param {object} body - 请求体
 * @param {string} token - JWT Token
 * @param {string} tagName - 请求标签名称
 * @returns {object} HTTP 响应
 */
export function httpPut(path, body, token, tagName) {
    const url = `${BASE_URL}${path}`;
    const payload = JSON.stringify(body);
    
    return http.put(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: tagName },
    });
}

/**
 * PATCH 请求封装
 * @param {string} path - API 路径
 * @param {object} body - 请求体
 * @param {string} token - JWT Token
 * @param {string} tagName - 请求标签名称
 * @returns {object} HTTP 响应
 */
export function httpPatch(path, body, token, tagName) {
    const url = `${BASE_URL}${path}`;
    const payload = JSON.stringify(body);
    
    return http.patch(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: tagName },
    });
}

/**
 * DELETE 请求封装
 * @param {string} path - API 路径
 * @param {string} token - JWT Token
 * @param {string} tagName - 请求标签名称
 * @returns {object} HTTP 响应
 */
export function httpDelete(path, token, tagName) {
    const url = `${BASE_URL}${path}`;
    
    return http.del(url, null, {
        headers: getAuthHeaders(token),
        tags: { name: tagName },
    });
}

/**
 * 休眠指定时间（秒）
 * K6 原生 sleep 需要从 k6 导入
 */
export { sleep } from 'k6';
