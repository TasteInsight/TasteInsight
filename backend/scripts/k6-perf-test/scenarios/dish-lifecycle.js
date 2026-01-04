/**
 * 场景4: 菜品全生命周期管理 (Full Lifecycle - CRUD)
 * 
 * 【测试目标】
 * 测试菜品的完整生命周期操作：创建 -> 审核 -> 编辑 -> 删除
 * 
 * 【业务流程】
 * 1. 管理员登录
 * 2. 获取可用的食堂和窗口信息（用于创建菜品）
 * 3. 新建菜品：构造一个完整的菜品 JSON，发送 POST 请求
 *    ⚠️ 重要：管理员创建菜品后，初始状态为 pending（待审核），进入 DishUpload 表
 * 4. 状态检查与推进：执行审核通过操作，使菜品进入 Dish 表
 * 5. 编辑菜品：修改刚才创建的菜品价格或描述
 * 6. 删除菜品：物理删除该菜品，清理测试数据
 * 
 * 【代码核实】
 * 
 * === 创建菜品 ===
 * - 接口: POST /admin/dishes
 * - Controller: @Controller('admin/dishes')
 * - 方法: @Post() createAdminDish()
 * - 请求体 DTO (AdminCreateDishDto):
 *   - name: string (必填)
 *   - price: number (必填, @Min(0))
 *   - tags?: string[]
 *   - priceUnit?: string
 *   - description?: string
 *   - images?: string[]
 *   - parentDishId?: string
 *   - subDishId?: string[]
 *   - ingredients?: string[]
 *   - allergens?: string[]
 *   - spicyLevel?: number (0-5)
 *   - sweetness?: number (0-5)
 *   - saltiness?: number (0-5)
 *   - oiliness?: number (0-5)
 *   - canteenId?: string
 *   - canteenName?: string
 *   - windowId?: string (⚠️ 必须提供有效的窗口ID、名称或编号之一)
 *   - windowName?: string
 *   - windowNumber?: string
 *   - availableMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'nightsnack')[]
 *   - availableDates?: { startDate: string, endDate: string }[]
 *   - status?: 'online' | 'offline'
 * - 需要权限: dish:create
 * 
 * 【⚠️⚠️⚠️ 重要业务逻辑发现 ⚠️⚠️⚠️】
 * 通过阅读 admin-dishes.service.ts 的 createAdminDish 方法（第258-364行），发现：
 * 
 * 1. 管理员创建菜品时，实际创建的是 DishUpload 记录，初始状态为 'pending'
 *    代码第348行: status: DishUploadStatus.PENDING
 * 
 * 2. 创建后返回的是 DishUpload 的 ID，而非 Dish 的 ID
 * 
 * 3. 需要通过 admin/dishes/uploads/:id/approve 接口审核通过后，
 *    才会在 Dish 表创建对应记录
 * 
 * 4. 审核通过后，DishUpload.approvedDishId 会被设置为新创建的 Dish ID
 * 
 * 5. 后续的编辑/删除操作应该针对 Dish 表（审核通过后），而非 DishUpload 表
 * 
 * === 审核通过 ===
 * - 接口: POST /admin/dishes/uploads/:id/approve
 * - Controller: @Controller('admin/dishes/uploads')
 * - 请求体: 无
 * - 需要权限: upload:approve
 * 
 * === 编辑菜品 ===
 * - 接口: PUT /admin/dishes/:id
 * - Controller: @Controller('admin/dishes')
 * - 方法: @Put(':id') updateAdminDish()
 * - 请求体 DTO (AdminUpdateDishDto): 与 AdminCreateDishDto 类似，所有字段可选
 * - 需要权限: dish:edit
 * 
 * === 删除菜品 ===
 * - 接口: DELETE /admin/dishes/:id
 * - Controller: @Controller('admin/dishes')
 * - 方法: @Delete(':id') deleteAdminDish()
 * - 需要权限: dish:delete
 */

import { check, group } from 'k6';
import { ADMIN_CREDENTIALS, API_PATHS } from '../config.js';
import {
    adminLogin,
    httpGet,
    httpPost,
    httpPut,
    httpDelete,
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
        dish_lifecycle: {
            executor: 'per-vu-iterations',
            vus: 3,
            iterations: 5,
            maxDuration: '5m',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'], // 全生命周期测试允许稍高的失败率
        http_req_duration: ['p(95)<1000'],
        'http_req_duration{name:create_dish}': ['p(95)<500'],
        'http_req_duration{name:approve_upload}': ['p(95)<500'],
        'http_req_duration{name:update_dish}': ['p(95)<500'],
        'http_req_duration{name:delete_dish}': ['p(95)<300'],
    },
};

// 测试菜品模板
const DISH_TEMPLATES = [
    {
        namePrefix: '红烧肉',
        tags: ['招牌菜', '肉类'],
        description: '选用优质五花肉，肥瘦相间，口感软糯',
        ingredients: ['五花肉', '生姜', '八角', '桂皮'],
        allergens: [],
        spicyLevel: 1,
        sweetness: 3,
        saltiness: 2,
        oiliness: 4,
        availableMealTime: ['lunch', 'dinner'],
    },
    {
        namePrefix: '清炒时蔬',
        tags: ['素菜', '清淡'],
        description: '新鲜时令蔬菜，清炒保持原味',
        ingredients: ['青菜', '蒜末', '食用油'],
        allergens: [],
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 1,
        oiliness: 2,
        availableMealTime: ['lunch', 'dinner'],
    },
    {
        namePrefix: '麻婆豆腐',
        tags: ['川菜', '辣'],
        description: '正宗川味麻婆豆腐，麻辣鲜香',
        ingredients: ['豆腐', '肉末', '豆瓣酱', '花椒'],
        allergens: ['大豆'],
        spicyLevel: 4,
        sweetness: 0,
        saltiness: 3,
        oiliness: 3,
        availableMealTime: ['lunch', 'dinner'],
    },
];

/**
 * 菜品全生命周期测试主函数
 */
export default function dishLifecycleTest() {
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
    
    // ==================== Step 2: 获取可用的食堂和窗口 ====================
    let windowId = null;
    let canteenId = null;
    
    group('Step 2: 获取可用的食堂和窗口', function () {
        // 首先获取食堂列表
        const canteensResponse = httpGet(
            API_PATHS.ADMIN_CANTEENS.LIST,
            token,
            'get_canteens',
            { page: 1, pageSize: 10 }
        );
        
        if (!check(canteensResponse, { '获取食堂列表成功': (r) => r.status === 200 })) {
            console.error(`获取食堂列表失败: ${canteensResponse.status}`);
            return;
        }
        
        const canteensBody = parseResponseBody(canteensResponse);
        const canteens = extractListItems(canteensBody);
        
        if (canteens.length === 0) {
            console.error('没有可用的食堂数据');
            return;
        }
        
        // 随机选择一个食堂
        const selectedCanteen = randomChoice(canteens);
        canteenId = selectedCanteen.id;
        console.log(`选中食堂: id=${canteenId}, name=${selectedCanteen.name}`);
        
        // 获取该食堂的窗口列表
        const windowsResponse = httpGet(
            API_PATHS.ADMIN_CANTEENS.WINDOWS(canteenId),
            token,
            'get_windows',
            { page: 1, pageSize: 20 }
        );
        
        if (!check(windowsResponse, { '获取窗口列表成功': (r) => r.status === 200 })) {
            console.error(`获取窗口列表失败: ${windowsResponse.status}`);
            return;
        }
        
        const windowsBody = parseResponseBody(windowsResponse);
        const windows = extractListItems(windowsBody);
        
        if (windows.length === 0) {
            console.error('该食堂没有可用的窗口');
            return;
        }
        
        // 随机选择一个窗口
        const selectedWindow = randomChoice(windows);
        windowId = selectedWindow.id;
        console.log(`选中窗口: id=${windowId}, name=${selectedWindow.name}`);
    });
    
    if (!windowId || !canteenId) {
        console.error('无法获取有效的食堂/窗口信息，跳过后续测试');
        sleep(1);
        return;
    }
    
    // ==================== Step 3: 创建菜品 ====================
    let uploadId = null;  // 创建后返回的是 DishUpload ID
    
    group('Step 3: 创建菜品', function () {
        const template = randomChoice(DISH_TEMPLATES);
        const dishName = generateRandomName(template.namePrefix);
        const price = Math.floor(Math.random() * 30) + 8; // 8-38 元
        
        console.log(`创建菜品: name=${dishName}, price=${price}`);
        
        // 【代码核实】构造请求体，windowId 是必须的
        const requestBody = {
            name: dishName,
            price: price,
            tags: template.tags,
            description: template.description,
            images: [],
            ingredients: template.ingredients,
            allergens: template.allergens,
            spicyLevel: template.spicyLevel,
            sweetness: template.sweetness,
            saltiness: template.saltiness,
            oiliness: template.oiliness,
            windowId: windowId,  // 必须提供
            canteenId: canteenId,
            availableMealTime: template.availableMealTime,
            // status 不需要传，因为创建的是 DishUpload，初始状态固定为 pending
        };
        
        const response = httpPost(
            API_PATHS.ADMIN_DISHES.CREATE,
            requestBody,
            token,
            'create_dish'
        );
        
        const success = check(response, {
            '创建菜品 - 状态码 201': (r) => r.status === 201,
            '创建菜品 - 返回菜品数据': (r) => {
                const body = parseResponseBody(r);
                // 响应格式: { code: 201, message: '创建成功，已提交审核', data: { id: '...' } }
                return body && (body.data?.id || body.id);
            },
        });
        
        if (success) {
            const body = parseResponseBody(response);
            // 获取创建的 DishUpload ID
            uploadId = body.data?.id || body.id;
            console.log(`菜品创建成功（待审核）: uploadId=${uploadId}`);
        } else {
            console.error(`创建菜品失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    if (!uploadId) {
        console.error('菜品创建失败，跳过后续步骤');
        sleep(1);
        return;
    }
    
    // 短暂等待数据同步
    sleep(0.5);
    
    // ==================== Step 4: 审核通过 ====================
    let dishId = null;  // 审核通过后的 Dish ID
    
    group('Step 4: 审核通过菜品', function () {
        console.log(`审核菜品: uploadId=${uploadId}`);
        
        // 【代码核实】审核通过接口，无请求体
        const response = httpPost(
            API_PATHS.ADMIN_UPLOADS.APPROVE(uploadId),
            {},
            token,
            'approve_upload'
        );
        
        const success = check(response, {
            '审核通过 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            // 尝试从响应中获取审核后的 Dish ID
            // 响应可能包含 approvedDishId 或 data.approvedDishId
            dishId = body.data?.approvedDishId || body.approvedDishId || body.data?.id || body.id;
            
            if (!dishId) {
                // 如果响应中没有直接返回，需要查询 DishUpload 获取 approvedDishId
                console.log('响应中未找到 dishId，尝试从上传记录获取');
                
                const uploadResponse = httpGet(
                    API_PATHS.ADMIN_UPLOADS.GET_BY_ID(uploadId),
                    token,
                    'get_upload_detail',
                    {}
                );
                
                if (uploadResponse.status === 200) {
                    const uploadBody = parseResponseBody(uploadResponse);
                    dishId = uploadBody.data?.approvedDishId || uploadBody.approvedDishId;
                }
            }
            
            console.log(`菜品审核通过: dishId=${dishId}`);
        } else {
            console.error(`审核通过失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 如果无法获取 dishId，尝试从菜品列表中查找
    if (!dishId) {
        console.warn('无法获取审核后的 dishId，尝试从列表查找');
        
        // 获取最新的菜品列表，寻找我们创建的菜品
        const listResponse = httpGet(
            API_PATHS.ADMIN_DISHES.LIST,
            token,
            'get_dishes_for_id',
            { page: 1, pageSize: 10, windowId: windowId }
        );
        
        if (listResponse.status === 200) {
            const body = parseResponseBody(listResponse);
            const dishes = extractListItems(body);
            // 最新创建的可能在最前面
            if (dishes.length > 0) {
                dishId = dishes[0].id;
                console.log(`从列表获取到 dishId: ${dishId}`);
            }
        }
    }
    
    if (!dishId) {
        console.error('无法获取审核后的菜品ID，跳过编辑和删除步骤');
        sleep(1);
        return;
    }
    
    // 短暂等待
    sleep(0.5);
    
    // ==================== Step 5: 编辑菜品 ====================
    group('Step 5: 编辑菜品', function () {
        const newPrice = Math.floor(Math.random() * 20) + 10; // 10-30 元
        const newDescription = `K6 性能测试更新于 ${new Date().toISOString()}`;
        
        console.log(`编辑菜品: dishId=${dishId}, newPrice=${newPrice}`);
        
        // 【代码核实】更新请求体，所有字段可选
        const requestBody = {
            price: newPrice,
            description: newDescription,
        };
        
        const response = httpPut(
            API_PATHS.ADMIN_DISHES.UPDATE(dishId),
            requestBody,
            token,
            'update_dish'
        );
        
        const success = check(response, {
            '编辑菜品 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            console.log(`菜品编辑成功: dishId=${dishId}`);
        } else {
            console.error(`编辑菜品失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 短暂等待
    sleep(0.5);
    
    // ==================== Step 6: 删除菜品 ====================
    group('Step 6: 删除菜品', function () {
        console.log(`删除菜品: dishId=${dishId}`);
        
        const response = httpDelete(
            API_PATHS.ADMIN_DISHES.DELETE(dishId),
            token,
            'delete_dish'
        );
        
        const success = check(response, {
            '删除菜品 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            console.log(`菜品删除成功: dishId=${dishId}`);
        } else {
            console.error(`删除菜品失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 完成一个完整周期后稍作等待
    sleep(1);
}
