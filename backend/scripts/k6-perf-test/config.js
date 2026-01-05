/**
 * K6 性能测试配置文件
 * 
 * 【代码核实】
 * - 根据 main.ts 检查，后端本身没有使用 setGlobalPrefix，因此 API 无前缀
 * - 但 Docker 环境使用 Nginx 反向代理，路由前缀为 /api/v1
 * - 线上环境直接连接后端，无 /api/v1 前缀
 * 
 * 【环境说明】
 * - 本地 Docker: http://localhost/api/v1 (Nginx 反向代理)
 * - 线上生产环境: https://www.zens.top (直连后端)
 * 
 * 【路由前缀总结】
 * - 登录接口: POST /auth/admin/login
 * - 管理端菜品: /admin/dishes
 * - 管理端上传审核: /admin/dishes/uploads
 * - 管理端评价: /admin/reviews
 * - 管理端举报: /admin/reports
 * - 管理端食堂: /admin/canteens
 */

// ==================== 环境配置 ====================
// 预定义环境配置
const ENVIRONMENTS = {
    // 本地 Docker 环境（通过 Nginx 反向代理）
    local: 'http://localhost/api/v1',
    // 线上生产环境（也需要 /api/v1 前缀）
    production: 'https://www.zens.top/api/v1',
};

/**
 * 根据环境变量选择 BASE_URL
 * 
 * 使用方法：
 *   本地测试: k6 run -e ENV=local main.js
 *   线上测试: k6 run -e ENV=production main.js
 *   自定义URL: k6 run -e BASE_URL=http://your-server.com main.js
 */
export const BASE_URL = __ENV.BASE_URL || ENVIRONMENTS[__ENV.ENV] || ENVIRONMENTS.production;

// 打印当前使用的环境（调试用）
console.log(`[K6 Config] Using BASE_URL: ${BASE_URL}`);
console.log(`[K6 Config] Environment: ${__ENV.ENV || 'production (default)'}`);

// ==================== 管理员账号配置 ====================
/**
 * 管理员账号配置
 * 
 * 【生产环境安全】
 * ⚠️ 严禁硬编码生产环境凭证！
 * 
 * 凭证读取优先级：
 *   1. K6 命令行环境变量 (-e INITIAL_ADMIN_USERNAME=xxx)
 *   2. 从 .env 文件读取（需要 shell 脚本传递）
 *   3. 仅在本地调试时使用默认值
 * 
 * 使用方法：
 *   # 方式1：直接传递（推荐用于生产）
 *   k6 run -e INITIAL_ADMIN_USERNAME=admin -e INITIAL_ADMIN_PASSWORD=yourpwd main.js
 * 
 *   # 方式2：从 .env 加载
 *   source ../../.env && k6 run -e INITIAL_ADMIN_USERNAME=$INITIAL_ADMIN_USERNAME \
 *       -e INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD main.js
 */

// 生产环境检测
const isProduction = __ENV.ENV === 'production' || BASE_URL.includes('zens.top');

// 凭证配置（生产环境必须通过环境变量传入）
const username = __ENV.INITIAL_ADMIN_USERNAME || __ENV.ADMIN_USERNAME;
const password = __ENV.INITIAL_ADMIN_PASSWORD || __ENV.ADMIN_PASSWORD;

// 生产环境安全检查
if (isProduction && (!username || !password)) {
    console.error('⚠️ [安全警告] 生产环境必须通过 -e INITIAL_ADMIN_USERNAME=xxx -e INITIAL_ADMIN_PASSWORD=xxx 传递凭证！');
    console.error('⚠️ 请使用: source ../../.env && k6 run -e INITIAL_ADMIN_USERNAME=$INITIAL_ADMIN_USERNAME -e INITIAL_ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD -e ENV=production main.js');
}

// 仅本地环境允许使用默认值（用于调试）
const defaultUsername = isProduction ? null : 'testadmin';
const defaultPassword = isProduction ? null : 'password123';

export const ADMIN_CREDENTIALS = {
    username: username || defaultUsername,
    password: password || defaultPassword,
};

// 日志输出（隐藏密码）
if (ADMIN_CREDENTIALS.username) {
    console.log(`[K6 Config] Admin username: ${ADMIN_CREDENTIALS.username}`);
    console.log(`[K6 Config] Admin password: ${'*'.repeat(8)} (hidden)`);
} else {
    console.error('[K6 Config] ⚠️ No admin credentials provided!');
}

// ==================== API 路径配置 ====================
export const API_PATHS = {
    // 认证相关
    AUTH: {
        ADMIN_LOGIN: '/auth/admin/login',
        REFRESH: '/auth/refresh',
    },
    
    // 菜品管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/dishes')
    ADMIN_DISHES: {
        BASE: '/admin/dishes',
        // GET /admin/dishes - 获取菜品列表
        LIST: '/admin/dishes',
        // POST /admin/dishes - 创建菜品（注意：创建后进入 DishUpload 表，状态为 pending）
        CREATE: '/admin/dishes',
        // GET /admin/dishes/:id - 获取单个菜品
        GET_BY_ID: (id) => `/admin/dishes/${id}`,
        // PUT /admin/dishes/:id - 更新菜品
        UPDATE: (id) => `/admin/dishes/${id}`,
        // PATCH /admin/dishes/:id/status - 更新菜品状态
        UPDATE_STATUS: (id) => `/admin/dishes/${id}/status`,
        // DELETE /admin/dishes/:id - 删除菜品
        DELETE: (id) => `/admin/dishes/${id}`,
    },
    
    // 菜品上传审核（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/dishes/uploads')
    ADMIN_UPLOADS: {
        BASE: '/admin/dishes/uploads',
        // GET /admin/dishes/uploads - 获取上传列表
        LIST: '/admin/dishes/uploads',
        // GET /admin/dishes/uploads/:id - 获取单个上传
        GET_BY_ID: (id) => `/admin/dishes/uploads/${id}`,
        // POST /admin/dishes/uploads/:id/approve - 审核通过
        APPROVE: (id) => `/admin/dishes/uploads/${id}/approve`,
        // POST /admin/dishes/uploads/:id/reject - 审核拒绝
        REJECT: (id) => `/admin/dishes/uploads/${id}/reject`,
    },
    
    // 评价管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/reviews')
    ADMIN_REVIEWS: {
        BASE: '/admin/reviews',
        // GET /admin/reviews/pending - 获取待审核评价列表
        PENDING: '/admin/reviews/pending',
        // POST /admin/reviews/:id/approve - 通过评价
        APPROVE: (id) => `/admin/reviews/${id}/approve`,
        // POST /admin/reviews/:id/reject - 拒绝评价（需要 body: { reason: string }）
        REJECT: (id) => `/admin/reviews/${id}/reject`,
        // DELETE /admin/reviews/:id - 删除评价
        DELETE: (id) => `/admin/reviews/${id}`,
    },
    
    // 举报管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/reports')
    ADMIN_REPORTS: {
        BASE: '/admin/reports',
        // GET /admin/reports - 获取举报列表（可带 status, targetType 参数）
        LIST: '/admin/reports',
        // POST /admin/reports/:id/handle - 处理举报
        // body: { action: 'delete_content' | 'warn_user' | 'reject_report', result?: string }
        HANDLE: (id) => `/admin/reports/${id}/handle`,
    },
    
    // 食堂管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/canteens')
    ADMIN_CANTEENS: {
        BASE: '/admin/canteens',
        // GET /admin/canteens - 获取食堂列表
        LIST: '/admin/canteens',
        // GET /admin/canteens/:id - 获取食堂详情
        GET_BY_ID: (id) => `/admin/canteens/${id}`,
        // PUT /admin/canteens/:id - 更新食堂
        UPDATE: (id) => `/admin/canteens/${id}`,
        // GET /admin/canteens/:canteenId/windows - 获取食堂下的窗口列表
        WINDOWS: (canteenId) => `/admin/canteens/${canteenId}/windows`,
    },
    
    // 窗口管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/windows')
    ADMIN_WINDOWS: {
        BASE: '/admin/windows',
        // GET /admin/windows/:id - 获取窗口详情
        GET_BY_ID: (id) => `/admin/windows/${id}`,
        // PUT /admin/windows/:id - 更新窗口
        UPDATE: (id) => `/admin/windows/${id}`,
    },
    
    // 管理员管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/admins')
    ADMIN_ADMINS: {
        BASE: '/admin/admins',
        // GET /admin/admins - 获取子管理员列表
        LIST: '/admin/admins',
        // POST /admin/admins - 创建子管理员
        CREATE: '/admin/admins',
        // PUT /admin/admins/:id/permissions - 更新子管理员权限
        UPDATE_PERMISSIONS: (id) => `/admin/admins/${id}/permissions`,
        // DELETE /admin/admins/:id - 删除子管理员
        DELETE: (id) => `/admin/admins/${id}`,
    },
    
    // 评论管理（管理端）
    // 【代码核实】Controller 路径: @Controller('admin/comments')
    ADMIN_COMMENTS: {
        BASE: '/admin/comments',
        // GET /admin/comments/pending - 获取待审核评论列表
        PENDING: '/admin/comments/pending',
        // POST /admin/comments/:id/approve - 通过评论
        APPROVE: (id) => `/admin/comments/${id}/approve`,
        // POST /admin/comments/:id/reject - 拒绝评论
        REJECT: (id) => `/admin/comments/${id}/reject`,
        // DELETE /admin/comments/:id - 删除评论
        DELETE: (id) => `/admin/comments/${id}`,
    },
};

// ==================== 测试场景配置 ====================
export const SCENARIOS = {
    // 场景1: 菜品状态切换 - 高频状态修改测试
    DISH_STATUS: {
        name: 'dish-status-toggle',
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
            { duration: '30s', target: 5 },
            { duration: '1m', target: 10 },
            { duration: '30s', target: 5 },
            { duration: '30s', target: 0 },
        ],
    },
    
    // 场景2: 用户上传审核 - 审核队列处理
    UPLOAD_AUDIT: {
        name: 'upload-audit',
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
            { duration: '30s', target: 3 },
            { duration: '1m', target: 5 },
            { duration: '30s', target: 3 },
            { duration: '30s', target: 0 },
        ],
    },
    
    // 场景3: 评价与举报处理 - 多表关联操作
    MODERATION: {
        name: 'moderation',
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
            { duration: '30s', target: 3 },
            { duration: '1m', target: 5 },
            { duration: '30s', target: 3 },
            { duration: '30s', target: 0 },
        ],
    },
    
    // 场景4: 菜品全生命周期 - CRUD 测试
    DISH_LIFECYCLE: {
        name: 'dish-lifecycle',
        executor: 'per-vu-iterations',
        vus: 3,
        iterations: 5,
        maxDuration: '5m',
    },
};

// ==================== 阈值配置 ====================
export const THRESHOLDS = {
    // HTTP 请求失败率
    http_req_failed: ['rate<0.01'], // 失败率小于 1%
    
    // HTTP 请求持续时间
    http_req_duration: [
        'p(95)<500',  // 95% 的请求在 500ms 内完成
        'p(99)<1000', // 99% 的请求在 1s 内完成
    ],
    
    // 登录接口延迟
    'http_req_duration{name:admin_login}': ['p(95)<300'],
    
    // 菜品列表接口延迟
    'http_req_duration{name:get_dishes}': ['p(95)<500'],
    
    // 状态修改接口延迟
    'http_req_duration{name:update_dish_status}': ['p(95)<300'],
};

// ==================== 公共 HTTP 请求参数 ====================
export const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

/**
 * 构造带认证的请求头
 * @param {string} token - JWT Token
 * @returns {object} 请求头对象
 */
export function getAuthHeaders(token) {
    return {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`,
    };
}
