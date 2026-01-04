/**
 * K6 连通性测试脚本
 * 
 * 用于在正式压测前验证：
 * 1. 目标服务器可达
 * 2. 网络无防火墙阻拦
 * 3. 管理员登录凭证正确
 * 
 * 使用方法：
 *   # 本地环境
 *   k6 run -e ENV=local connectivity-test.js
 * 
 *   # 生产环境
 *   source ../../.env && k6 run -e ENV=production \
 *       -e INITIAL_ADMIN_USERNAME=$INITIAL_ADMIN_USERNAME \
 *       -e INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD \
 *       connectivity-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, ADMIN_CREDENTIALS, API_PATHS, DEFAULT_HEADERS } from './config.js';

export const options = {
    vus: 1,
    iterations: 1,
    thresholds: {
        'checks': ['rate==1.0'], // 所有检查必须通过
    },
};

export default function () {
    console.log('========================================');
    console.log('🔍 K6 连通性测试开始');
    console.log('========================================');
    console.log(`目标地址: ${BASE_URL}`);
    console.log(`用户名: ${ADMIN_CREDENTIALS.username}`);
    console.log('----------------------------------------');

    // ==================== Step 1: 基础连通性 ====================
    console.log('\n[Step 1] 测试基础网络连通性...');
    
    // 尝试访问根路径或 health check
    const healthResponse = http.get(`${BASE_URL}/`, {
        headers: DEFAULT_HEADERS,
        timeout: '10s',
    });
    
    const step1Pass = check(healthResponse, {
        '服务器可达 (status != 0)': (r) => r.status !== 0,
        '无网络超时': (r) => r.timings.duration < 10000,
    });
    
    console.log(`  ├─ HTTP 状态码: ${healthResponse.status}`);
    console.log(`  ├─ 响应时间: ${healthResponse.timings.duration.toFixed(2)}ms`);
    console.log(`  └─ 结果: ${step1Pass ? '✅ 通过' : '❌ 失败'}`);
    
    if (!step1Pass) {
        console.error('\n❌ 基础连通性测试失败，请检查：');
        console.error('   1. 服务器是否在线');
        console.error('   2. 网络/防火墙是否阻拦');
        console.error('   3. URL 是否正确');
        return;
    }

    sleep(0.5);

    // ==================== Step 2: 登录接口测试 ====================
    console.log('\n[Step 2] 测试管理员登录接口...');
    
    if (!ADMIN_CREDENTIALS.username || !ADMIN_CREDENTIALS.password) {
        console.error('❌ 未提供管理员凭证！');
        console.error('   请使用 -e INITIAL_ADMIN_USERNAME=xxx -e INITIAL_ADMIN_PASSWORD=xxx');
        return;
    }
    
    const loginPayload = JSON.stringify({
        username: ADMIN_CREDENTIALS.username,
        password: ADMIN_CREDENTIALS.password,
    });
    
    const loginResponse = http.post(
        `${BASE_URL}${API_PATHS.AUTH.ADMIN_LOGIN}`,
        loginPayload,
        {
            headers: DEFAULT_HEADERS,
            timeout: '10s',
        }
    );
    
    console.log(`  ├─ 请求 URL: ${BASE_URL}${API_PATHS.AUTH.ADMIN_LOGIN}`);
    console.log(`  ├─ HTTP 状态码: ${loginResponse.status}`);
    console.log(`  ├─ 响应时间: ${loginResponse.timings.duration.toFixed(2)}ms`);
    
    let loginBody = null;
    try {
        loginBody = JSON.parse(loginResponse.body);
    } catch (e) {
        console.error(`  ├─ 响应体解析失败: ${loginResponse.body?.substring(0, 200)}`);
    }
    
    const step2Pass = check(loginResponse, {
        '登录状态码 200': (r) => r.status === 200,
        '响应包含 token': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data?.token?.accessToken !== undefined;
            } catch {
                return false;
            }
        },
    });
    
    if (step2Pass) {
        console.log(`  ├─ Token: ${loginBody.data.token.accessToken.substring(0, 30)}...`);
        console.log(`  └─ 结果: ✅ 登录成功`);
    } else {
        console.log(`  ├─ 响应体: ${JSON.stringify(loginBody).substring(0, 200)}`);
        console.log(`  └─ 结果: ❌ 登录失败`);
        console.error('\n❌ 登录测试失败，请检查：');
        console.error('   1. 用户名/密码是否正确');
        console.error('   2. 该账号是否存在于生产数据库');
        console.error('   3. 账号是否被禁用');
        return;
    }

    sleep(0.5);

    // ==================== Step 3: API 可用性测试 ====================
    console.log('\n[Step 3] 测试管理端 API 可用性...');
    
    const token = loginBody.data.token.accessToken;
    const authHeaders = {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`,
    };
    
    // 测试获取菜品列表
    const dishesResponse = http.get(
        `${BASE_URL}${API_PATHS.ADMIN_DISHES.LIST}?page=1&pageSize=1`,
        { headers: authHeaders, timeout: '10s' }
    );
    
    const step3Pass = check(dishesResponse, {
        '菜品列表 API 可用 (status 200)': (r) => r.status === 200,
    });
    
    console.log(`  ├─ 请求 URL: ${BASE_URL}${API_PATHS.ADMIN_DISHES.LIST}`);
    console.log(`  ├─ HTTP 状态码: ${dishesResponse.status}`);
    console.log(`  ├─ 响应时间: ${dishesResponse.timings.duration.toFixed(2)}ms`);
    console.log(`  └─ 结果: ${step3Pass ? '✅ 通过' : '❌ 失败'}`);

    // ==================== 最终结果 ====================
    console.log('\n========================================');
    if (step1Pass && step2Pass && step3Pass) {
        console.log('🎉 所有连通性测试通过！');
        console.log('✅ 可以开始正式性能测试');
    } else {
        console.log('❌ 连通性测试未通过，请解决上述问题后重试');
    }
    console.log('========================================');
}
