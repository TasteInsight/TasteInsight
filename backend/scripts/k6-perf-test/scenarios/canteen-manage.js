/**
 * 场景：食堂信息管理 (Canteen Info Management)
 * 
 * 【测试目标】
 * 测试食堂和窗口信息的读取与更新性能，采用非破坏性设计
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取食堂列表（分页查询）
 * 3. 随机选择一个食堂，获取详情
 * 4. 获取该食堂的窗口列表
 * 5. 更新食堂营业时间（复杂 JSON 写入）
 * 6. 随机选择一个窗口，更新窗口信息
 * 
 * 【代码核实】
 * 
 * === 食堂管理 ===
 * Ref: src/admin-canteens/admin-canteens.controller.ts
 * - @Controller('admin/canteens')
 * - @UseGuards(AdminAuthGuard, PermissionsGuard)
 * 
 * GET /admin/canteens
 *   - @RequirePermissions('canteen:view')
 *   - Query: page, pageSize
 * 
 * GET /admin/canteens/:id
 *   - @RequirePermissions('canteen:view')
 * 
 * GET /admin/canteens/:canteenId/windows
 *   - @RequirePermissions('canteen:view')
 *   - Query: page, pageSize
 * 
 * PUT /admin/canteens/:id
 *   - @RequirePermissions('canteen:edit')
 *   - Body: UpdateCanteenDto (extends PartialType(CreateCanteenDto))
 * 
 * === 窗口管理 ===
 * Ref: src/admin-windows/admin-windows.controller.ts
 * - @Controller('admin/windows')
 * 
 * PUT /admin/windows/:id
 *   - @RequirePermissions('canteen:edit')
 *   - Body: UpdateWindowDto
 *     - name: string (必填)
 *     - number?: string
 *     - position?: string
 *     - description?: string
 *     - tags?: string[]
 * 
 * === 营业时间数据结构 ===
 * Ref: src/admin-canteens/dto/create-canteen.dto.ts
 * 
 * openingHours: FloorOpeningHours[] = [
 *   {
 *     floorLevel?: string,
 *     schedule: DailyOpeningHours[] = [
 *       {
 *         dayOfWeek: 'Monday' | ... | 'Sunday' (Ref: src/common/enums.ts - DayOfWeek)
 *         slots: TimeSlot[] = [
 *           {
 *             mealType: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack' (Ref: MealTime)
 *             openTime: string (如 "07:00")
 *             closeTime: string (如 "09:00")
 *           }
 *         ],
 *         isClosed: boolean
 *       }
 *     ]
 *   }
 * ]
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpPut,
    checkResponse,
    parseResponseBody,
    extractListItems,
    randomChoice,
    generateRandomName,
    sleep,
    requestErrors,
} from '../utils.js';

// 场景配置
export const options = {
    scenarios: {
        canteen_manage: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '20s', target: 3 },
                { duration: '40s', target: 5 },
                { duration: '20s', target: 3 },
                { duration: '20s', target: 0 },
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        'http_req_duration{name:get_canteens}': ['p(95)<400'],
        'http_req_duration{name:get_canteen_detail}': ['p(95)<300'],
        'http_req_duration{name:get_canteen_windows}': ['p(95)<400'],
        'http_req_duration{name:update_canteen}': ['p(95)<500'],
        'http_req_duration{name:update_window}': ['p(95)<400'],
    },
};

// 星期枚举值 (Ref: src/common/enums.ts)
const DAYS_OF_WEEK = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

// 餐次枚举值 (Ref: src/common/enums.ts)
const MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'nightsnack'];

/**
 * 生成随机的营业时间配置
 * 用于模拟更新食堂营业时间的场景
 */
function generateOpeningHours(floorLevel = '1F') {
    const schedule = DAYS_OF_WEEK.map(day => {
        // 周末可能休息
        const isClosed = (day === 'Saturday' || day === 'Sunday') && Math.random() < 0.2;
        
        if (isClosed) {
            return {
                dayOfWeek: day,
                slots: [],
                isClosed: true,
            };
        }
        
        // 随机生成一些时间段
        const slots = [];
        
        // 早餐
        if (Math.random() > 0.1) {
            slots.push({
                mealType: 'breakfast',
                openTime: '06:30',
                closeTime: '09:00',
            });
        }
        
        // 午餐
        slots.push({
            mealType: 'lunch',
            openTime: '11:00',
            closeTime: '13:30',
        });
        
        // 晚餐
        slots.push({
            mealType: 'dinner',
            openTime: '17:00',
            closeTime: '20:00',
        });
        
        // 夜宵（随机）
        if (Math.random() > 0.7) {
            slots.push({
                mealType: 'nightsnack',
                openTime: '21:00',
                closeTime: '23:00',
            });
        }
        
        return {
            dayOfWeek: day,
            slots: slots,
            isClosed: false,
        };
    });
    
    return [{
        floorLevel: floorLevel,
        schedule: schedule,
    }];
}

/**
 * 食堂信息管理主测试函数
 */
export default function canteenManageTest() {
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
    
    // ==================== Step 2: 获取食堂列表 ====================
    let canteens = [];
    group('Step 2: 获取食堂列表', function () {
        // Ref: GET /admin/canteens - src/admin-canteens/admin-canteens.controller.ts:30
        const response = httpGet(
            API_PATHS.ADMIN_CANTEENS.LIST,
            token,
            'get_canteens',
            { page: 1, pageSize: 20 }
        );
        
        const success = check(response, {
            '获取食堂列表 - 状态码 200': (r) => r.status === 200,
            '获取食堂列表 - 有数据返回': (r) => {
                const body = parseResponseBody(r);
                const items = extractListItems(body);
                return items.length > 0;
            },
        });
        
        if (success) {
            const body = parseResponseBody(response);
            canteens = extractListItems(body);
            console.log(`获取到 ${canteens.length} 个食堂`);
        } else {
            console.error(`获取食堂列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    if (canteens.length === 0) {
        console.warn('没有可用的食堂数据，跳过后续测试');
        sleep(1);
        return;
    }
    
    // ==================== Step 3: 获取食堂详情 ====================
    const selectedCanteen = randomChoice(canteens);
    let canteenDetail = null;
    
    group('Step 3: 获取食堂详情', function () {
        console.log(`选中食堂: id=${selectedCanteen.id}, name=${selectedCanteen.name}`);
        
        // Ref: GET /admin/canteens/:id - src/admin-canteens/admin-canteens.controller.ts:38
        const response = httpGet(
            `${API_PATHS.ADMIN_CANTEENS.BASE}/${selectedCanteen.id}`,
            token,
            'get_canteen_detail',
            {}
        );
        
        const success = check(response, {
            '获取食堂详情 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            canteenDetail = body.data || body;
            console.log(`食堂详情获取成功: ${canteenDetail.name || selectedCanteen.name}`);
        } else {
            console.error(`获取食堂详情失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 4: 获取食堂窗口列表 ====================
    let windows = [];
    group('Step 4: 获取食堂窗口列表', function () {
        // Ref: GET /admin/canteens/:canteenId/windows - src/admin-canteens/admin-canteens.controller.ts:45
        const response = httpGet(
            API_PATHS.ADMIN_CANTEENS.WINDOWS(selectedCanteen.id),
            token,
            'get_canteen_windows',
            { page: 1, pageSize: 50 }
        );
        
        const success = check(response, {
            '获取窗口列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            windows = extractListItems(body);
            console.log(`获取到 ${windows.length} 个窗口`);
        } else {
            console.error(`获取窗口列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 5: 更新食堂营业时间 ====================
    group('Step 5: 更新食堂营业时间', function () {
        // 获取楼层信息用于生成营业时间
        const floorLevel = canteenDetail?.floors?.[0]?.level || '1F';
        const newOpeningHours = generateOpeningHours(floorLevel);
        
        console.log(`更新食堂营业时间: canteenId=${selectedCanteen.id}`);
        
        // Ref: PUT /admin/canteens/:id - src/admin-canteens/admin-canteens.controller.ts:62
        // Body 参考: src/admin-canteens/dto/update-canteen.dto.ts
        const requestBody = {
            openingHours: newOpeningHours,
        };
        
        const response = httpPut(
            `${API_PATHS.ADMIN_CANTEENS.BASE}/${selectedCanteen.id}`,
            requestBody,
            token,
            'update_canteen'
        );
        
        const success = check(response, {
            '更新食堂营业时间 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            console.log('食堂营业时间更新成功');
        } else {
            console.error(`更新食堂营业时间失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 6: 更新窗口信息 ====================
    if (windows.length > 0) {
        group('Step 6: 更新窗口信息', function () {
            const selectedWindow = randomChoice(windows);
            console.log(`选中窗口: id=${selectedWindow.id}, name=${selectedWindow.name}`);
            
            // 构造更新数据（保持原名称，只更新描述）
            // Ref: PUT /admin/windows/:id - src/admin-windows/admin-windows.controller.ts:40
            // Body 参考: src/admin-windows/dto/update-window.dto.ts
            const timestamp = new Date().toISOString();
            const requestBody = {
                name: selectedWindow.name, // 必填字段，保持不变
                description: `K6 性能测试更新于 ${timestamp}`,
                tags: selectedWindow.tags || ['K6测试'],
            };
            
            const response = httpPut(
                `${API_PATHS.ADMIN_WINDOWS.BASE}/${selectedWindow.id}`,
                requestBody,
                token,
                'update_window'
            );
            
            const success = check(response, {
                '更新窗口信息 - 状态码 200': (r) => r.status === 200,
            });
            
            if (success) {
                console.log('窗口信息更新成功');
            } else {
                console.error(`更新窗口信息失败: status=${response.status}, body=${response.body}`);
                requestErrors.add(1);
            }
        });
    } else {
        console.log('没有可用的窗口数据，跳过窗口更新测试');
    }
    
    // 模拟用户思考时间
    sleep(Math.random() * 2 + 1); // 1-3 秒
}
