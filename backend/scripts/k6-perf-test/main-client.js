/**
 * K6 客户端 API 性能测试入口文件
 *
 * TasteInsight 小程序客户端 API 性能测试
 *
 * 【项目说明】
 * 本测试套件针对 TasteInsight 小程序客户端 API 进行性能测试，
 * 模拟真实用户的使用场景，包含 4 个核心业务场景。
 *
 * 【前置要求】
 * ⚠️ 重要：需要启用 Mock 认证才能运行此测试
 * 在后端 .env 文件中添加：ENABLE_MOCK_AUTH=true
 *
 * 【使用方法】
 *
 * 1. 运行所有客户端场景：
 *    k6 run main-client.js
 *
 * 2. 运行单个场景：
 *    k6 run scenarios/client-browsing.js   # 干饭人的一天
 *    k6 run scenarios/client-social.js     # 社交互动
 *    k6 run scenarios/client-posting.js    # 发布评价
 *    k6 run scenarios/client-planning.js   # 饮食规划
 *
 * 3. 自定义配置（通过环境变量）：
 *    k6 run -e BASE_URL=https://your-api.com/api/v1 main-client.js
 *
 * 4. 生成 HTML 报告：
 *    k6 run --out json=client-results.json main-client.js
 *
 * 5. 调整并发数和持续时间：
 *    k6 run --vus 10 --duration 5m main-client.js
 *
 * 【环境变量】
 * - BASE_URL: API 基础地址（默认: https://www.zens.top/api/v1）
 *
 * 【测试场景说明】
 *
 * 场景1: 干饭人的一天 (client_browsing)
 *   - 登录 → 获取推荐 → 搜索菜品 → 查看详情 → 收藏菜品
 *   - 模拟学生日常浏览和搜索菜品的行为
 *
 * 场景2: 社交互动 (client_social)
 *   - 登录 → 查看评价列表 → 查看评论 → 发布评论 → 点赞
 *   - 模拟用户参与社交互动的行为
 *
 * 场景3: 发布评价 (client_posting)
 *   - 登录 → 搜索菜品 → 查看详情 → 发布评价 → 查看个人资料
 *   - 模拟用户发布评价和管理个人内容的行为
 *
 * 场景4: 饮食规划 (client_planning)
 *   - 登录 → 浏览菜品 → 创建计划 → 查看/更新/删除计划 → 查看历史
 *   - 模拟用户进行饮食规划的行为
 *
 * 【Mock 认证说明】
 * 测试使用 Mock 微信登录机制：
 * - baseline_user_code_placeholder → baseline_user_openid
 * - secondary_user_code_placeholder → secondary_user_openid
 */

import { group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 导入客户端测试场景
import clientBrowsingTest from './scenarios/client-browsing.js';
import clientSocialTest from './scenarios/client-social.js';
import clientPostingTest from './scenarios/client-posting.js';
import clientPlanningTest from './scenarios/client-planning.js';

// 导入配置
import { BASE_URL, THRESHOLDS } from './config.js';

// ==================== 自定义指标 ====================
export const clientScenarioCounter = new Counter('client_scenario_executions');
export const clientSuccessRate = new Rate('client_overall_success_rate');

// ==================== 测试配置 ====================
export const options = {
    scenarios: {
        // 场景1: 干饭人的一天 - 浏览和搜索（高频读取）
        client_browsing: {
            executor: 'ramping-vus',
            exec: 'runBrowsingTest',
            startVUs: 0,
            stages: [
                { duration: '15s', target: 5 },   // 预热
                { duration: '1m', target: 10 },   // 正常负载
                { duration: '30s', target: 15 },  // 峰值
                { duration: '15s', target: 0 },   // 冷却
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'client_browsing' },
        },

        // 场景2: 社交互动（中等频率读写）
        client_social: {
            executor: 'ramping-vus',
            exec: 'runSocialTest',
            startVUs: 0,
            startTime: '15s',
            stages: [
                { duration: '10s', target: 3 },
                { duration: '1m', target: 8 },
                { duration: '30s', target: 12 },
                { duration: '10s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'client_social' },
        },

        // 场景3: 发布评价（写操作为主，较低并发）
        client_posting: {
            executor: 'ramping-vus',
            exec: 'runPostingTest',
            startVUs: 0,
            startTime: '30s',
            stages: [
                { duration: '10s', target: 2 },
                { duration: '1m', target: 5 },
                { duration: '30s', target: 8 },
                { duration: '10s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'client_posting' },
        },

        // 场景4: 饮食规划（CRUD 操作）
        client_planning: {
            executor: 'ramping-vus',
            exec: 'runPlanningTest',
            startVUs: 0,
            startTime: '45s',
            stages: [
                { duration: '10s', target: 2 },
                { duration: '1m', target: 5 },
                { duration: '30s', target: 8 },
                { duration: '10s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'client_planning' },
        },
    },

    // 性能阈值
    thresholds: {
        // 全局阈值
        http_req_failed: ['rate<0.05'],           // 总体失败率小于 5%
        http_req_duration: ['p(95)<1500'],        // 95% 请求在 1.5s 内完成

        // 客户端登录
        'http_req_duration{name:client_login}': ['p(95)<600'],

        // 浏览场景
        'http_req_duration{name:client_recommend}': ['p(95)<800'],
        'http_req_duration{name:client_get_dishes}': ['p(95)<500'],
        'http_req_duration{name:client_get_dish_detail}': ['p(95)<300'],
        'http_req_duration{name:client_favorite}': ['p(95)<300'],

        // 社交场景
        'http_req_duration{name:client_get_reviews}': ['p(95)<500'],
        'http_req_duration{name:client_get_comments}': ['p(95)<400'],
        'http_req_duration{name:client_post_comment}': ['p(95)<500'],

        // 发布场景
        'http_req_duration{name:client_post_review}': ['p(95)<800'],
        'http_req_duration{name:client_get_user_reviews}': ['p(95)<500'],
        'http_req_duration{name:client_get_profile}': ['p(95)<300'],

        // 饮食规划场景
        'http_req_duration{name:client_create_meal_plan}': ['p(95)<800'],
        'http_req_duration{name:client_get_meal_plans}': ['p(95)<500'],
        'http_req_duration{name:client_update_meal_plan}': ['p(95)<600'],
        'http_req_duration{name:client_delete_meal_plan}': ['p(95)<300'],
    },

    // 其他配置
    noConnectionReuse: false,
    userAgent: 'K6-TasteInsight-Client-PerfTest/1.0',
};

// ==================== 场景执行函数 ====================

/**
 * 执行浏览搜索测试
 */
export function runBrowsingTest() {
    group('场景1: 干饭人的一天', function () {
        clientBrowsingTest();
    });
    clientScenarioCounter.add(1, { scenario: 'client_browsing' });
}

/**
 * 执行社交互动测试
 */
export function runSocialTest() {
    group('场景2: 社交互动', function () {
        clientSocialTest();
    });
    clientScenarioCounter.add(1, { scenario: 'client_social' });
}

/**
 * 执行发布评价测试
 */
export function runPostingTest() {
    group('场景3: 发布评价', function () {
        clientPostingTest();
    });
    clientScenarioCounter.add(1, { scenario: 'client_posting' });
}

/**
 * 执行饮食规划测试
 */
export function runPlanningTest() {
    group('场景4: 饮食规划', function () {
        clientPlanningTest();
    });
    clientScenarioCounter.add(1, { scenario: 'client_planning' });
}

// ==================== 默认函数（单独运行时使用）====================
export default function () {
    console.log('Running all client scenarios sequentially...');

    runBrowsingTest();
    sleep(1);

    runSocialTest();
    sleep(1);

    runPostingTest();
    sleep(1);

    runPlanningTest();
}

// ==================== 测试生命周期钩子 ====================

/**
 * 测试开始前执行
 */
export function setup() {
    console.log('========================================');
    console.log('TasteInsight 客户端 API 性能测试开始');
    console.log('========================================');
    console.log(`时间: ${new Date().toISOString()}`);
    console.log(`Base URL: ${__ENV.BASE_URL || 'https://www.zens.top/api/v1'}`);
    console.log('');
    console.log('⚠️  注意: 需要启用 Mock 认证');
    console.log('   请确保后端 .env 中设置: ENABLE_MOCK_AUTH=true');
    console.log('========================================');

    return {
        startTime: Date.now(),
    };
}

/**
 * 测试结束后执行
 */
export function teardown(data) {
    const duration = ((Date.now() - data.startTime) / 1000).toFixed(2);
    console.log('========================================');
    console.log('TasteInsight 客户端 API 性能测试结束');
    console.log('========================================');
    console.log(`总耗时: ${duration} 秒`);
    console.log('========================================');
}
