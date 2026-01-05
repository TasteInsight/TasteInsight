/**
 * 场景3: 评价与举报处理 (Moderation)
 * 
 * 【测试目标】
 * 测试多表关联操作的性能
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取"待处理举报"列表
 * 3. 如果不为空，随机选择一个举报 ID，提交处理结果（如删除内容）
 * 4. 顺便请求一次"待审核评价"列表（只读操作）
 * 
 * 【代码核实】
 * - 获取举报列表接口: GET /admin/reports
 *   - Controller: @Controller('admin/reports')
 *   - 方法: @Get() getReports()
 *   - 查询参数:
 *     - page?: number (默认 1)
 *     - pageSize?: number (默认 20)
 *     - status?: 'pending' | 'approved' | 'rejected'
 *     - targetType?: string
 *   - 需要权限: report:handle
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * - 处理举报接口: POST /admin/reports/:id/handle
 *   - Controller: @Controller('admin/reports')
 *   - 方法: @Post(':id/handle') handleReport()
 *   - 请求体 DTO (HandleReportDto):
 *     - action: 'delete_content' | 'warn_user' | 'reject_report' (必填, @IsIn)
 *     - result?: string (可选)
 *   - 需要权限: report:handle
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * - 获取待审核评价接口: GET /admin/reviews/pending
 *   - Controller: @Controller('admin/reviews')
 *   - 方法: @Get('pending') getPendingReviews()
 *   - 查询参数:
 *     - page?: number (默认 1)
 *     - pageSize?: number (默认 20)
 *   - 需要权限: review:approve
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * 【⚠️ 重要说明】
 * - 举报处理支持三种操作：delete_content（删除被举报内容）、warn_user（警告用户）、reject_report（驳回举报）
 * - result 字段为可选，用于记录处理说明
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpPost,
    checkResponse,
    parseResponseBody,
    extractListItems,
    randomChoice,
    sleep,
    requestErrors,
} from '../utils.js';

// 场景配置
export const options = {
    scenarios: {
        moderation: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 3 },
                { duration: '1m', target: 5 },
                { duration: '30s', target: 3 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        'http_req_duration{name:get_pending_reports}': ['p(95)<500'],
        'http_req_duration{name:handle_report}': ['p(95)<400'],
        'http_req_duration{name:get_pending_reviews}': ['p(95)<500'],
    },
};

// 举报处理操作选项
const REPORT_ACTIONS = [
    { action: 'delete_content', result: '内容违规已删除' },
    { action: 'warn_user', result: '已向用户发送警告通知' },
    { action: 'reject_report', result: '举报内容不违规，已驳回' },
];

/**
 * 评价与举报处理主测试函数
 */
export default function moderationTest() {
    // ==================== Step 1: 管理员登录 ====================
    let token;
    group('Step 1: 管理员登录', function () {
        token = adminLogin(ADMIN_CREDENTIALS.username, ADMIN_CREDENTIALS.password);
        
        if (!token) {
            console.error('登录失败，跳过后续测试');
            return;
        }
    });
    
    if (!token) {
        sleep(1);
        return;
    }
    
    // ==================== Step 2: 获取待处理举报列表 ====================
    let pendingReports = [];
    group('Step 2: 获取待处理举报列表', function () {
        const response = httpGet(
            API_PATHS.ADMIN_REPORTS.LIST,
            token,
            'get_pending_reports',
            { 
                page: 1, 
                pageSize: 50,
                status: 'pending'  // 只获取待处理的举报
            }
        );
        
        const success = check(response, {
            '获取举报列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            pendingReports = extractListItems(body);
            console.log(`获取到 ${pendingReports.length} 个待处理举报`);
        } else {
            console.error(`获取举报列表失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 3: 处理举报 ====================
    if (pendingReports.length > 0) {
        group('Step 3: 处理举报', function () {
            const selectedReport = randomChoice(pendingReports);
            const selectedAction = randomChoice(REPORT_ACTIONS);
            
            console.log(`处理举报: reportId=${selectedReport.id}, action=${selectedAction.action}`);
            
            // 【代码核实】请求体必须包含 action 字段，result 为可选
            const requestBody = {
                action: selectedAction.action,
                result: selectedAction.result,
            };
            
            const response = httpPost(
                API_PATHS.ADMIN_REPORTS.HANDLE(selectedReport.id),
                requestBody,
                token,
                'handle_report'
            );
            
            const success = check(response, {
                '处理举报 - 状态码 200': (r) => r.status === 200,
            });
            
            if (success) {
                console.log(`举报处理成功: reportId=${selectedReport.id}`);
            } else {
                // 可能已经被其他并发请求处理了
                console.warn(`举报处理失败: status=${response.status}, body=${response.body}`);
            }
        });
    } else {
        console.log('没有待处理的举报数据');
    }
    
    // ==================== Step 4: 获取待审核评价列表（只读） ====================
    group('Step 4: 获取待审核评价列表', function () {
        // 随机分页
        const page = Math.floor(Math.random() * 3) + 1;
        const pageSize = 20;
        
        const response = httpGet(
            API_PATHS.ADMIN_REVIEWS.PENDING,
            token,
            'get_pending_reviews',
            { page, pageSize }
        );
        
        const success = check(response, {
            '获取待审核评价 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            const reviews = extractListItems(body);
            console.log(`获取到 ${reviews.length} 个待审核评价`);
        } else {
            console.error(`获取待审核评价失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // 模拟用户思考时间
    sleep(Math.random() * 3 + 2); // 2-5 秒
}
