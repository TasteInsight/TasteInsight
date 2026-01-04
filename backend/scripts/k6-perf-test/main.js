/**
 * K6 性能测试入口文件
 * 
 * TasteInsight 后端 API 性能测试
 * 
 * 【项目说明】
 * 本测试套件针对 TasteInsight 后端管理端 API 进行性能测试，
 * 包含 8 个核心业务场景的测试用例。
 * 
 * 【使用方法】
 * 
 * 1. 运行所有场景：
 *    k6 run main.js
 * 
 * 2. 运行单个场景：
 *    k6 run scenarios/dish-status.js
 *    k6 run scenarios/upload-audit.js
 *    k6 run scenarios/moderation.js
 *    k6 run scenarios/dish-lifecycle.js
 *    k6 run scenarios/canteen-manage.js
 *    k6 run scenarios/permission-lifecycle.js
 *    k6 run scenarios/review-audit.js
 *    k6 run scenarios/content-moderation.js
 * 
 * 3. 自定义配置（通过环境变量）：
 *    k6 run -e BASE_URL=https://your-api.com main.js
 *    k6 run -e ADMIN_USERNAME=your_admin -e ADMIN_PASSWORD=your_password main.js
 * 
 * 4. 生成 HTML 报告：
 *    k6 run --out json=results.json main.js
 *    # 然后使用 k6-reporter 或其他工具生成 HTML 报告
 * 
 * 5. 调整并发数和持续时间：
 *    k6 run --vus 10 --duration 5m main.js
 * 
 * 【环境变量】
 * - BASE_URL: API 基础地址（默认: https://www.zens.top）
 * - ADMIN_USERNAME: 管理员用户名（默认: admin）
 * - ADMIN_PASSWORD: 管理员密码（默认: admin123456）
 * - ENABLE_DELETE: 是否启用删除操作（默认: false）- 用于内容审核场景
 * 
 * 【代码核实总结】
 * 
 * 根据对后端源代码的分析，以下是关键发现：
 * 
 * 1. main.ts 中没有使用 setGlobalPrefix，API 无统一前缀
 * 
 * 2. 登录接口: POST /auth/admin/login
 *    - 请求体: { username: string, password: string }
 *    - 响应: { access_token: string, ... }
 * 
 * 3. 菜品创建流程（重要！）:
 *    - 管理员创建菜品（POST /admin/dishes）后，数据进入 DishUpload 表
 *    - 初始状态为 'pending'（待审核）
 *    - 需要通过 POST /admin/dishes/uploads/:id/approve 审核通过
 *    - 审核通过后才会在 Dish 表创建真正的菜品记录
 * 
 * 4. 所有管理端接口都需要 AdminAuthGuard 和 PermissionsGuard
 *    - 需要在请求头携带 Bearer Token
 *    - 需要对应的权限（如 dish:view, dish:create, dish:edit 等）
 * 
 * 5. 状态枚举值:
 *    - DishStatus: 'online' | 'offline'（用于 Dish 表）
 *    - DishUploadStatus: 'pending' | 'approved' | 'rejected'（用于 DishUpload 表）
 *    - Report 处理 action: 'delete_content' | 'warn_user' | 'reject_report'
 * 
 * 6. 管理员权限体系:
 *    - 权限值包括: admin:view, admin:create, admin:edit, admin:delete
 *    - canteen:view, canteen:edit, window:view, window:edit
 *    - review:view, review:edit, review:delete
 *    - comment:view, comment:edit, comment:delete
 *    - 密码要求: 至少 8 字符，包含大小写、数字、特殊字符
 */

import { group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 导入各个场景的测试函数（核心业务场景 1-4）
import dishStatusToggleTest from './scenarios/dish-status.js';
import uploadAuditTest from './scenarios/upload-audit.js';
import moderationTest from './scenarios/moderation.js';
import dishLifecycleTest from './scenarios/dish-lifecycle.js';

// 导入扩展场景的测试函数（扩展场景 5-8）
import canteenManageTest from './scenarios/canteen-manage.js';
import permissionLifecycleTest from './scenarios/permission-lifecycle.js';
import reviewAuditTest from './scenarios/review-audit.js';
import contentModerationTest from './scenarios/content-moderation.js';

// 导入配置
import { SCENARIOS, THRESHOLDS } from './config.js';

// ==================== 自定义指标 ====================
export const scenarioCounter = new Counter('scenario_executions');
export const overallSuccessRate = new Rate('overall_success_rate');

// ==================== 测试配置 ====================
export const options = {
    // 场景配置
    scenarios: {
        // 场景1: 菜品状态切换（高频读取和修改）
        dish_status_toggle: {
            executor: 'ramping-vus',
            exec: 'runDishStatusTest',
            startVUs: 0,
            stages: [
                { duration: '20s', target: 5 },
                { duration: '40s', target: 10 },
                { duration: '20s', target: 5 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'dish_status_toggle' },
        },
        
        // 场景2: 用户上传审核
        upload_audit: {
            executor: 'ramping-vus',
            exec: 'runUploadAuditTest',
            startVUs: 0,
            startTime: '10s', // 错开启动时间，避免同时大量请求
            stages: [
                { duration: '20s', target: 3 },
                { duration: '40s', target: 5 },
                { duration: '20s', target: 3 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'upload_audit' },
        },
        
        // 场景3: 评价与举报处理
        moderation: {
            executor: 'ramping-vus',
            exec: 'runModerationTest',
            startVUs: 0,
            startTime: '20s',
            stages: [
                { duration: '20s', target: 3 },
                { duration: '40s', target: 5 },
                { duration: '20s', target: 3 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'moderation' },
        },
        
        // 场景4: 菜品全生命周期（CRUD）
        dish_lifecycle: {
            executor: 'per-vu-iterations',
            exec: 'runDishLifecycleTest',
            vus: 2,
            iterations: 3,
            startTime: '30s',
            maxDuration: '5m',
            tags: { scenario: 'dish_lifecycle' },
        },
        
        // ==================== 扩展场景 5-8 ====================
        
        // 场景5: 食堂与窗口管理
        canteen_manage: {
            executor: 'ramping-vus',
            exec: 'runCanteenManageTest',
            startVUs: 0,
            startTime: '40s',
            stages: [
                { duration: '15s', target: 3 },
                { duration: '30s', target: 5 },
                { duration: '15s', target: 3 },
                { duration: '15s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'canteen_manage' },
        },
        
        // 场景6: 子管理员权限生命周期
        permission_lifecycle: {
            executor: 'per-vu-iterations',
            exec: 'runPermissionLifecycleTest',
            vus: 2,
            iterations: 2,
            startTime: '50s',
            maxDuration: '5m',
            tags: { scenario: 'permission_lifecycle' },
        },
        
        // 场景7: 评价与评论审核
        review_audit: {
            executor: 'ramping-vus',
            exec: 'runReviewAuditTest',
            startVUs: 0,
            startTime: '60s',
            stages: [
                { duration: '15s', target: 3 },
                { duration: '30s', target: 5 },
                { duration: '15s', target: 3 },
                { duration: '15s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'review_audit' },
        },
        
        // 场景8: 评价和评论内容管理
        content_moderation: {
            executor: 'ramping-vus',
            exec: 'runContentModerationTest',
            startVUs: 0,
            startTime: '70s',
            stages: [
                { duration: '15s', target: 2 },
                { duration: '30s', target: 3 },
                { duration: '15s', target: 2 },
                { duration: '15s', target: 0 },
            ],
            gracefulRampDown: '10s',
            tags: { scenario: 'content_moderation' },
        },
    },
    
    // 性能阈值
    thresholds: {
        // 全局阈值
        http_req_failed: ['rate<0.05'],           // 总体失败率小于 5%
        http_req_duration: ['p(95)<1000'],        // 95% 请求在 1s 内完成
        
        // 登录相关
        'http_req_duration{name:admin_login}': ['p(95)<500'],
        
        // 菜品状态切换场景
        'http_req_duration{name:get_dishes}': ['p(95)<500'],
        'http_req_duration{name:update_dish_status}': ['p(95)<300'],
        
        // 上传审核场景
        'http_req_duration{name:get_pending_uploads}': ['p(95)<500'],
        'http_req_duration{name:approve_upload}': ['p(95)<400'],
        'http_req_duration{name:reject_upload}': ['p(95)<400'],
        
        // 审核场景
        'http_req_duration{name:get_pending_reports}': ['p(95)<500'],
        'http_req_duration{name:handle_report}': ['p(95)<400'],
        'http_req_duration{name:get_pending_reviews}': ['p(95)<500'],
        
        // 生命周期场景
        'http_req_duration{name:create_dish}': ['p(95)<600'],
        'http_req_duration{name:update_dish}': ['p(95)<500'],
        'http_req_duration{name:delete_dish}': ['p(95)<400'],
        
        // 食堂管理场景
        'http_req_duration{name:get_canteens}': ['p(95)<500'],
        'http_req_duration{name:get_canteen}': ['p(95)<300'],
        'http_req_duration{name:update_canteen}': ['p(95)<400'],
        'http_req_duration{name:get_windows}': ['p(95)<400'],
        'http_req_duration{name:update_window}': ['p(95)<400'],
        
        // 权限管理场景
        'http_req_duration{name:get_admins}': ['p(95)<500'],
        'http_req_duration{name:create_admin}': ['p(95)<600'],
        'http_req_duration{name:update_permissions}': ['p(95)<400'],
        'http_req_duration{name:delete_admin}': ['p(95)<400'],
        
        // 评价审核场景
        'http_req_duration{name:get_dish_reviews}': ['p(95)<500'],
        'http_req_duration{name:approve_review}': ['p(95)<400'],
        'http_req_duration{name:reject_review}': ['p(95)<400'],
        'http_req_duration{name:get_review_comments}': ['p(95)<400'],
        'http_req_duration{name:approve_comment}': ['p(95)<400'],
        'http_req_duration{name:reject_comment}': ['p(95)<400'],
        
        // 内容管理场景
        'http_req_duration{name:delete_review}': ['p(95)<500'],
        'http_req_duration{name:delete_comment}': ['p(95)<500'],
    },
    
    // 其他配置
    noConnectionReuse: false,  // 复用连接
    userAgent: 'K6-TasteInsight-PerfTest/1.0',
};

// ==================== 场景执行函数 ====================

/**
 * 执行菜品状态切换测试
 */
export function runDishStatusTest() {
    group('场景1: 菜品状态快速管理', function () {
        dishStatusToggleTest();
    });
    scenarioCounter.add(1, { scenario: 'dish_status_toggle' });
}

/**
 * 执行用户上传审核测试
 */
export function runUploadAuditTest() {
    group('场景2: 用户上传菜品审核', function () {
        uploadAuditTest();
    });
    scenarioCounter.add(1, { scenario: 'upload_audit' });
}

/**
 * 执行评价与举报处理测试
 */
export function runModerationTest() {
    group('场景3: 评价与举报处理', function () {
        moderationTest();
    });
    scenarioCounter.add(1, { scenario: 'moderation' });
}

/**
 * 执行菜品全生命周期测试
 */
export function runDishLifecycleTest() {
    group('场景4: 菜品全生命周期管理', function () {
        dishLifecycleTest();
    });
    scenarioCounter.add(1, { scenario: 'dish_lifecycle' });
}

// ==================== 扩展场景执行函数（5-8）====================

/**
 * 执行食堂与窗口管理测试
 */
export function runCanteenManageTest() {
    group('场景5: 食堂与窗口管理', function () {
        canteenManageTest();
    });
    scenarioCounter.add(1, { scenario: 'canteen_manage' });
}

/**
 * 执行子管理员权限生命周期测试
 */
export function runPermissionLifecycleTest() {
    group('场景6: 子管理员权限生命周期', function () {
        permissionLifecycleTest();
    });
    scenarioCounter.add(1, { scenario: 'permission_lifecycle' });
}

/**
 * 执行评价与评论审核测试
 */
export function runReviewAuditTest() {
    group('场景7: 评价与评论审核', function () {
        reviewAuditTest();
    });
    scenarioCounter.add(1, { scenario: 'review_audit' });
}

/**
 * 执行评价和评论内容管理测试
 */
export function runContentModerationTest() {
    group('场景8: 评价和评论内容管理', function () {
        contentModerationTest();
    });
    scenarioCounter.add(1, { scenario: 'content_moderation' });
}

// ==================== 默认函数（单独运行时使用）====================
export default function () {
    // 如果直接运行 main.js 而不是通过 scenarios 配置
    // 则按顺序执行所有场景
    console.log('Running all scenarios sequentially...');
    
    // 核心场景 1-4
    runDishStatusTest();
    sleep(1);
    
    runUploadAuditTest();
    sleep(1);
    
    runModerationTest();
    sleep(1);
    
    runDishLifecycleTest();
    sleep(1);
    
    // 扩展场景 5-8
    runCanteenManageTest();
    sleep(1);
    
    runPermissionLifecycleTest();
    sleep(1);
    
    runReviewAuditTest();
    sleep(1);
    
    runContentModerationTest();
}

// ==================== 测试生命周期钩子 ====================

/**
 * 测试开始前执行
 */
export function setup() {
    console.log('========================================');
    console.log('TasteInsight API 性能测试开始');
    console.log('========================================');
    console.log(`时间: ${new Date().toISOString()}`);
    console.log(`Base URL: ${__ENV.BASE_URL || 'https://www.zens.top'}`);
    console.log('========================================');
    
    // 可以在这里执行一些初始化操作，如预热请求
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
    console.log('TasteInsight API 性能测试结束');
    console.log('========================================');
    console.log(`总耗时: ${duration} 秒`);
    console.log('========================================');
}
