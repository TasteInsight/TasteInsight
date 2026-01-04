/**
 * 场景2: 用户上传菜品审核 (User Upload Auditing)
 * 
 * 【测试目标】
 * 测试审核队列处理能力
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取"待审核的用户上传菜品"列表
 * 3. 如果不为空，随机选择一个 ID
 * 4. 随机执行"通过（Approve）"或"拒绝（Reject）"操作
 * 
 * 【代码核实】
 * - 获取上传列表接口: GET /admin/dishes/uploads
 *   - Controller: @Controller('admin/dishes/uploads')
 *   - 方法: @Get('') getUploads()
 *   - 查询参数 DTO (AdminGetUploadsDto):
 *     - page?: number (默认 1, @Min(1))
 *     - pageSize?: number (默认 20, @Min(1), @Max(100))
 *     - status?: 'pending' | 'approved' | 'rejected'
 *   - 需要权限: upload:approve
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * - 审核通过接口: POST /admin/dishes/uploads/:id/approve
 *   - Controller: @Controller('admin/dishes/uploads')
 *   - 方法: @Post(':id/approve') approveUpload()
 *   - 请求体: 无（空 body）
 *   - 需要权限: upload:approve
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * - 审核拒绝接口: POST /admin/dishes/uploads/:id/reject
 *   - Controller: @Controller('admin/dishes/uploads')
 *   - 方法: @Post(':id/reject') rejectUpload()
 *   - 请求体 DTO (AdminRejectUploadDto):
 *     - reason: string (必填, @IsNotEmpty, @IsString)
 *   - 需要权限: upload:approve
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * 【⚠️ 重要说明】
 * - 此场景操作的是 DishUpload 表（待审核的菜品上传记录）
 * - 审核通过后，系统会在 Dish 表创建对应的菜品记录
 * - 审核拒绝时必须提供拒绝原因 (reason 字段)
 * - 只有 status='pending' 的记录可以被审核
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
        upload_audit: {
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
        'http_req_duration{name:get_pending_uploads}': ['p(95)<500'],
        'http_req_duration{name:approve_upload}': ['p(95)<300'],
        'http_req_duration{name:reject_upload}': ['p(95)<300'],
    },
};

// 预定义的拒绝原因列表
const REJECT_REASONS = [
    '菜品信息不完整，请补充描述',
    '图片质量不佳，请重新上传',
    '价格信息有误，请核实',
    '菜品名称与系统已有记录重复',
    '菜品分类错误，请重新选择',
    '未提供有效的窗口信息',
];

/**
 * 用户上传菜品审核主测试函数
 */
export default function uploadAuditTest() {
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
    
    // ==================== Step 2: 获取待审核上传列表 ====================
    let pendingUploads = [];
    group('Step 2: 获取待审核上传列表', function () {
        const response = httpGet(
            API_PATHS.ADMIN_UPLOADS.LIST,
            token,
            'get_pending_uploads',
            { 
                page: 1, 
                pageSize: 50,
                status: 'pending'  // 只获取待审核的
            }
        );
        
        const success = check(response, {
            '获取待审核列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            pendingUploads = extractListItems(body);
            console.log(`获取到 ${pendingUploads.length} 个待审核上传`);
        } else {
            console.error(`获取待审核列表失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 如果没有待审核数据，跳过后续步骤
    if (pendingUploads.length === 0) {
        console.log('没有待审核的上传数据，跳过审核测试');
        sleep(2);
        return;
    }
    
    // ==================== Step 3: 随机选择一个待审核上传 ====================
    const selectedUpload = randomChoice(pendingUploads);
    console.log(`选中待审核上传: id=${selectedUpload.id}, name=${selectedUpload.name}`);
    
    // ==================== Step 4: 随机执行通过或拒绝操作 ====================
    const shouldApprove = Math.random() > 0.5;
    
    if (shouldApprove) {
        group('Step 4: 审核通过', function () {
            console.log(`执行审核通过操作: uploadId=${selectedUpload.id}`);
            
            // 【代码核实】审核通过接口不需要请求体
            const response = httpPost(
                API_PATHS.ADMIN_UPLOADS.APPROVE(selectedUpload.id),
                {}, // 空 body
                token,
                'approve_upload'
            );
            
            const success = check(response, {
                '审核通过 - 状态码 200': (r) => r.status === 200,
            });
            
            if (success) {
                console.log(`审核通过成功: uploadId=${selectedUpload.id}`);
            } else {
                // 可能已经被其他并发请求处理了
                console.warn(`审核通过失败: status=${response.status}, body=${response.body}`);
                // 不计入错误，因为并发情况下这是正常的
            }
        });
    } else {
        group('Step 4: 审核拒绝', function () {
            const reason = randomChoice(REJECT_REASONS);
            console.log(`执行审核拒绝操作: uploadId=${selectedUpload.id}, reason=${reason}`);
            
            // 【代码核实】审核拒绝接口必须提供 reason 字段
            const requestBody = {
                reason: reason,
            };
            
            const response = httpPost(
                API_PATHS.ADMIN_UPLOADS.REJECT(selectedUpload.id),
                requestBody,
                token,
                'reject_upload'
            );
            
            const success = check(response, {
                '审核拒绝 - 状态码 200': (r) => r.status === 200,
            });
            
            if (success) {
                console.log(`审核拒绝成功: uploadId=${selectedUpload.id}`);
            } else {
                // 可能已经被其他并发请求处理了
                console.warn(`审核拒绝失败: status=${response.status}, body=${response.body}`);
                // 不计入错误，因为并发情况下这是正常的
            }
        });
    }
    
    // 模拟用户思考时间
    sleep(Math.random() * 3 + 2); // 2-5 秒
}
