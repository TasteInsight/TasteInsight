/**
 * 场景：人员权限管理 (Permission/Admin Lifecycle)
 * 
 * 【测试目标】
 * 测试子管理员的完整生命周期：创建 -> 修改权限 -> 删除
 * 
 * 【业务流程】
 * 1. 超级管理员登录
 * 2. 获取现有子管理员列表
 * 3. 创建新的子管理员（随机用户名 + 强密码）
 * 4. 修改该子管理员的权限列表
 * 5. 删除该子管理员（清理测试数据）
 * 
 * 【代码核实】
 * 
 * === 管理员管理控制器 ===
 * Ref: src/admin-admins/admin-admins.controller.ts
 * - @Controller('admin/admins')
 * - @UseGuards(AdminAuthGuard, PermissionsGuard)
 * 
 * GET /admin/admins
 *   - @RequirePermissions('admin:view')
 *   - Query: page, pageSize
 *   - 返回当前管理员创建的子管理员列表（superadmin 可看全部）
 * 
 * POST /admin/admins
 *   - @RequirePermissions('admin:create')
 *   - Body: CreateAdminDto
 * 
 * PUT /admin/admins/:id/permissions
 *   - @RequirePermissions('admin:edit')
 *   - Body: UpdatePermissionsDto
 * 
 * DELETE /admin/admins/:id
 *   - @RequirePermissions('admin:delete')
 * 
 * === CreateAdminDto ===
 * Ref: src/admin-admins/dto/create-admin.dto.ts
 * - username: string (必填, @MinLength(3), @MaxLength(20))
 * - password: string (必填, @MinLength(8), 必须包含大小写+数字+特殊符号)
 * - canteenId?: string | null (可选，绑定食堂)
 * - permissions: string[] (必填, @ArrayMinSize(1))
 * 
 * === UpdatePermissionsDto ===
 * Ref: src/admin-admins/dto/update-permissions.dto.ts
 * - permissions: string[] (必填, @ArrayMinSize(1))
 * - canteenId?: string | null (可选)
 * 
 * === 可用权限值 ===
 * Ref: prisma/import_canteens.ts (从 seed 文件提取)
 * - dish:view, dish:create, dish:edit, dish:delete
 * - canteen:view, canteen:create, canteen:edit, canteen:delete
 * - upload:approve
 * - review:approve, review:delete
 * - comment:approve
 * - report:handle
 * - admin:view, admin:create, admin:edit, admin:delete
 * 
 * === 密码要求 ===
 * Ref: src/admin-admins/dto/create-admin.dto.ts:22-27
 * 正则: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])[A-Za-z\d!@#$%^&*()_+\-=[\]{}|;:,.<>?]+$/
 * 即：必须包含小写字母、大写字母、数字和特殊符号，不能有空格
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
    sleep,
    requestErrors,
} from '../utils.js';

// 场景配置
export const options = {
    scenarios: {
        permission_lifecycle: {
            executor: 'per-vu-iterations',
            vus: 2,
            iterations: 3,
            maxDuration: '5m',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<600'],
        'http_req_duration{name:get_admins}': ['p(95)<400'],
        'http_req_duration{name:create_admin}': ['p(95)<500'],
        'http_req_duration{name:update_permissions}': ['p(95)<400'],
        'http_req_duration{name:delete_admin}': ['p(95)<300'],
    },
};

// 可用权限值 (Ref: prisma/import_canteens.ts)
const AVAILABLE_PERMISSIONS = [
    'dish:view',
    'dish:create',
    'dish:edit',
    'dish:delete',
    'canteen:view',
    'canteen:create',
    'canteen:edit',
    'canteen:delete',
    'upload:approve',
    'review:approve',
    'review:delete',
    'comment:approve',
    'report:handle',
];

/**
 * 生成符合密码策略的随机密码
 * 必须包含：小写字母、大写字母、数字、特殊符号
 * Ref: src/admin-admins/dto/create-admin.dto.ts:22-27
 */
function generateStrongPassword() {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // 确保每种字符至少一个
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    // 填充到 12 位
    const allChars = lowercase + uppercase + digits + specials;
    for (let i = 0; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 打乱顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 生成随机用户名
 */
function generateUsername() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `k6test_${random}_${timestamp % 10000}`;
}

/**
 * 随机选择多个权限
 */
function randomPermissions(count = 3) {
    const shuffled = [...AVAILABLE_PERMISSIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * 人员权限管理主测试函数
 */
export default function permissionLifecycleTest() {
    // ==================== Step 1: 超级管理员登录 ====================
    let token;
    group('Step 1: 超级管理员登录', function () {
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
    
    // ==================== Step 2: 获取现有子管理员列表 ====================
    let existingAdmins = [];
    group('Step 2: 获取子管理员列表', function () {
        // Ref: GET /admin/admins - src/admin-admins/admin-admins.controller.ts:35
        const response = httpGet(
            API_PATHS.ADMIN_ADMINS.LIST,
            token,
            'get_admins',
            { page: 1, pageSize: 20 }
        );
        
        const success = check(response, {
            '获取子管理员列表 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            const body = parseResponseBody(response);
            existingAdmins = extractListItems(body);
            console.log(`当前有 ${existingAdmins.length} 个子管理员`);
        } else {
            console.error(`获取子管理员列表失败: status=${response.status}`);
            requestErrors.add(1);
        }
    });
    
    // ==================== Step 3: 创建新的子管理员 ====================
    let newAdminId = null;
    const newUsername = generateUsername();
    const newPassword = generateStrongPassword();
    const initialPermissions = randomPermissions(3);
    
    group('Step 3: 创建子管理员', function () {
        console.log(`创建子管理员: username=${newUsername}, permissions=${initialPermissions.join(',')}`);
        
        // Ref: POST /admin/admins - src/admin-admins/admin-admins.controller.ts:48
        // Body 参考: src/admin-admins/dto/create-admin.dto.ts
        const requestBody = {
            username: newUsername,
            password: newPassword,
            canteenId: null,  // 不绑定特定食堂
            permissions: initialPermissions,
        };
        
        const response = httpPost(
            API_PATHS.ADMIN_ADMINS.CREATE,
            requestBody,
            token,
            'create_admin'
        );
        
        const success = check(response, {
            '创建子管理员 - 状态码 201': (r) => r.status === 201,
            '创建子管理员 - 返回 ID': (r) => {
                const body = parseResponseBody(r);
                return body && (body.data?.id || body.id);
            },
        });
        
        if (success) {
            const body = parseResponseBody(response);
            newAdminId = body.data?.id || body.id;
            console.log(`子管理员创建成功: id=${newAdminId}`);
        } else {
            console.error(`创建子管理员失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    if (!newAdminId) {
        console.error('子管理员创建失败，跳过后续步骤');
        sleep(1);
        return;
    }
    
    // 短暂等待
    sleep(0.5);
    
    // ==================== Step 4: 修改子管理员权限 ====================
    group('Step 4: 修改子管理员权限', function () {
        // 选择新的权限组合（与初始不同）
        const newPermissions = randomPermissions(4);
        console.log(`修改权限: adminId=${newAdminId}, newPermissions=${newPermissions.join(',')}`);
        
        // Ref: PUT /admin/admins/:id/permissions - src/admin-admins/admin-admins.controller.ts:63
        // Body 参考: src/admin-admins/dto/update-permissions.dto.ts
        const requestBody = {
            permissions: newPermissions,
            canteenId: null,  // 保持不绑定食堂
        };
        
        const response = httpPut(
            API_PATHS.ADMIN_ADMINS.UPDATE_PERMISSIONS(newAdminId),
            requestBody,
            token,
            'update_permissions'
        );
        
        const success = check(response, {
            '修改权限 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            console.log('权限修改成功');
        } else {
            console.error(`修改权限失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 短暂等待
    sleep(0.5);
    
    // ==================== Step 5: 删除子管理员 ====================
    group('Step 5: 删除子管理员', function () {
        console.log(`删除子管理员: id=${newAdminId}`);
        
        // Ref: DELETE /admin/admins/:id - src/admin-admins/admin-admins.controller.ts:56
        const response = httpDelete(
            API_PATHS.ADMIN_ADMINS.DELETE(newAdminId),
            token,
            'delete_admin'
        );
        
        const success = check(response, {
            '删除子管理员 - 状态码 200': (r) => r.status === 200,
        });
        
        if (success) {
            console.log('子管理员删除成功');
        } else {
            console.error(`删除子管理员失败: status=${response.status}, body=${response.body}`);
            requestErrors.add(1);
        }
    });
    
    // 完成一个完整周期后稍作等待
    sleep(1);
}
