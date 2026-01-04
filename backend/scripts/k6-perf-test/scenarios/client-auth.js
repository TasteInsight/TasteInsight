/**
 * 客户端认证辅助模块
 * 
 * 提供微信 Mock 登录功能，用于 K6 测试
 * 
 * 【凭证配置】
 * Mock 用户的 code 从环境变量读取，避免硬编码：
 *   k6 run -e K6_MOCK_USER_CODE_BASELINE=xxx -e K6_MOCK_USER_CODE_SECONDARY=yyy main-client.js
 * 
 * 或者从 .env 加载：
 *   source ../../.env && k6 run \
 *     -e K6_MOCK_USER_CODE_BASELINE=$K6_MOCK_USER_CODE_BASELINE \
 *     -e K6_MOCK_USER_CODE_SECONDARY=$K6_MOCK_USER_CODE_SECONDARY \
 *     main-client.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, DEFAULT_HEADERS } from '../config.js';

// ==================== Mock 用户凭证配置 ====================
// 从环境变量读取，如未提供则使用默认值（仅用于本地调试）
const BASELINE_CODE = __ENV.K6_MOCK_USER_CODE_BASELINE || 'baseline_user_code_placeholder';
const SECONDARY_CODE = __ENV.K6_MOCK_USER_CODE_SECONDARY || 'secondary_user_code_placeholder';

// 生产环境检测
const isProduction = __ENV.ENV === 'production' || BASE_URL.includes('zens.top');

// 安全警告：生产环境必须通过环境变量传入凭证
if (isProduction && (!__ENV.K6_MOCK_USER_CODE_BASELINE || !__ENV.K6_MOCK_USER_CODE_SECONDARY)) {
    console.warn('⚠️ [安全警告] 生产环境建议通过环境变量传递 Mock 用户凭证');
    console.warn('⚠️ 请使用: source ../../.env && k6 run -e K6_MOCK_USER_CODE_BASELINE=$K6_MOCK_USER_CODE_BASELINE ...');
}

// 测试用户配置（从环境变量读取）
export const TEST_USERS = {
    baseline: {
        code: BASELINE_CODE,
        openId: 'baseline_user_openid',
        name: 'Baseline User'
    },
    secondary: {
        code: SECONDARY_CODE,
        openId: 'secondary_user_openid',
        name: 'Secondary User'
    }
};

/**
 * 客户端用户登录（使用 Mock 微信登录）
 * 
 * 需要后端配置 ENABLE_MOCK_AUTH=true
 * 
 * @param {string} userType - 'baseline' 或 'secondary'
 * @returns {object} { accessToken, refreshToken, user }
 */
export function clientLogin(userType = 'baseline') {
    const user = TEST_USERS[userType];
    if (!user) {
        throw new Error(`Unknown user type: ${userType}. Use 'baseline' or 'secondary'.`);
    }

    const url = `${BASE_URL}/auth/wechat/login`;
    const payload = JSON.stringify({ code: user.code });
    
    const res = http.post(url, payload, {
        headers: DEFAULT_HEADERS,
        tags: { name: 'client_wechat_login' }
    });

    const success = check(res, {
        '微信登录 - 状态码 200': (r) => r.status === 200,
        '微信登录 - 返回 accessToken': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data?.token?.accessToken !== undefined;
            } catch {
                return false;
            }
        },
        '微信登录 - 返回用户信息': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data?.user?.id !== undefined;
            } catch {
                return false;
            }
        }
    });

    if (!success) {
        console.error(`客户端登录失败: ${res.status} - ${res.body}`);
        return null;
    }

    try {
        const body = JSON.parse(res.body);
        return {
            accessToken: body.data.token.accessToken,
            refreshToken: body.data.token.refreshToken,
            user: body.data.user
        };
    } catch (e) {
        console.error(`解析登录响应失败: ${e.message}`);
        return null;
    }
}

/**
 * 获取带 Token 的请求头
 * 
 * @param {string} accessToken - JWT Access Token
 * @returns {object} 带 Authorization 的请求头
 */
export function getAuthHeaders(accessToken) {
    return {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${accessToken}`
    };
}

/**
 * 创建客户端会话
 * 
 * @param {string} userType - 用户类型
 * @returns {object} { accessToken, headers, user, login() }
 */
export function createClientSession(userType = 'baseline') {
    const loginResult = clientLogin(userType);
    
    if (!loginResult) {
        return null;
    }

    return {
        accessToken: loginResult.accessToken,
        refreshToken: loginResult.refreshToken,
        user: loginResult.user,
        headers: getAuthHeaders(loginResult.accessToken)
    };
}
