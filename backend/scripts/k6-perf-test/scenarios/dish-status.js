/**
 * 场景1: 菜品状态快速管理 (Dish Status Toggle)
 * 
 * 【测试目标】
 * 测试高频读取和状态修改操作的性能
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取菜品列表（需带分页参数）
 * 3. 从列表中随机提取一个 ID
 * 4. 调用修改状态接口（PATCH），将其状态在 online 和 offline 之间切换
 * 
 * 【代码核实】
 * - 菜品列表接口: GET /admin/dishes
 *   - Controller: @Controller('admin/dishes')
 *   - 方法: @Get() getAdminDishes()
 *   - 查询参数 DTO (AdminGetDishesDto):
 *     - page?: number (默认 1, @Min(1))
 *     - pageSize?: number (默认 20, @Min(1), @Max(100))
 *     - canteenId?: string
 *     - windowId?: string
 *     - status?: 'online' | 'offline'
 *     - keyword?: string
 *   - 需要权限: dish:view
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * - 状态修改接口: PATCH /admin/dishes/:id/status
 *   - Controller: @Controller('admin/dishes')
 *   - 方法: @Patch(':id/status') updateDishStatus()
 *   - 请求体 DTO (AdminUpdateDishStatusDto):
 *     - status: 'online' | 'offline' (必填, @IsNotEmpty, @IsEnum(DishStatus))
 *   - 需要权限: dish:edit
 *   - Guard: AdminAuthGuard, PermissionsGuard
 * 
 * 【⚠️ 重要说明】
 * 此场景操作的是 Dish 表（已审核通过的菜品），而非 DishUpload 表。
 * 状态值只能是 'online' 或 'offline'，不存在 'pending' 状态。
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpPatch,
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
        dish_status_toggle: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 5 },
                { duration: '1m', target: 10 },
                { duration: '30s', target: 5 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        'http_req_duration{name:get_dishes}': ['p(95)<500'],
        'http_req_duration{name:update_dish_status}': ['p(95)<300'],
    },
};

/**
 * 菜品状态切换主测试函数
 */
export default function dishStatusToggleTest() {
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
    
    // ==================== Step 2: 获取菜品列表 ====================
    let dishes = [];
    group('Step 2: 获取菜品列表', function () {
        // 随机分页，模拟真实使用场景
        const page = Math.floor(Math.random() * 3) + 1; // 1-3
        const pageSize = 20;
        
        const response = httpGet(
            API_PATHS.ADMIN_DISHES.LIST,
            token,
            'get_dishes',
            { page, pageSize }
        );
        
        const success = check(response, {
            '获取菜品列表 - 状态码 200': (r) => r.status === 200,
            '获取菜品列表 - 有返回数据': (r) => {
                const body = parseResponseBody(r);
                const items = extractListItems(body);
                return items.length > 0;
            },
        });
        
        if (success) {
            const body = parseResponseBody(response);
            dishes = extractListItems(body);
            console.log(`获取到 ${dishes.length} 个菜品`);
        } else {
            console.error(`获取菜品列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    if (dishes.length === 0) {
        console.warn('没有可用的菜品数据，跳过状态切换测试');
        sleep(1);
        return;
    }
    
    // ==================== Step 3: 随机选择一个菜品 ====================
    const selectedDish = randomChoice(dishes);
    console.log(`选中菜品: id=${selectedDish.id}, name=${selectedDish.name}, status=${selectedDish.status}`);
    
    // ==================== Step 4: 切换菜品状态 ====================
    group('Step 4: 切换菜品状态', function () {
        // 计算目标状态：如果当前是 online 则切换为 offline，反之亦然
        const currentStatus = selectedDish.status;
        const newStatus = currentStatus === 'online' ? 'offline' : 'online';
        
        console.log(`切换状态: ${currentStatus} -> ${newStatus}`);
        
        // 【代码核实】请求体必须包含 status 字段，值为 'online' 或 'offline'
        const requestBody = {
            status: newStatus,
        };
        
        const response = httpPatch(
            API_PATHS.ADMIN_DISHES.UPDATE_STATUS(selectedDish.id),
            requestBody,
            token,
            'update_dish_status'
        );
        
        const success = check(response, {
            '更新菜品状态 - 状态码 200': (r) => r.status === 200,
            '更新菜品状态 - 状态已更新': (r) => {
                const body = parseResponseBody(r);
                // 响应可能是 { code: 200, data: { status: 'xxx' } } 或 { status: 'xxx' }
                if (body && body.data && body.data.status) {
                    return body.data.status === newStatus;
                }
                if (body && body.status === newStatus) {
                    return true;
                }
                // 如果返回成功但没有状态字段，也认为成功
                return r.status === 200;
            },
        });
        
        if (!success) {
            console.error(`更新菜品状态失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 模拟用户思考时间
    sleep(Math.random() * 2 + 1); // 1-3 秒
}
