# Admin Dishes API 测试说明

## 概述

管理端菜品API模块已经实现完成，包括以下功能：

1. **管理员权限系统**
   - AdminAuthGuard: 验证管理员身份
   - PermissionsGuard: 检查管理员权限
   - 支持超级管理员（拥有所有权限）
   - 支持基于权限的细粒度访问控制

2. **API接口**
   - GET /admin/dishes - 获取菜品列表（支持分页、筛选、搜索）
   - GET /admin/dishes/:id - 获取菜品详情
   - POST /admin/dishes - 创建新菜品
   - PUT /admin/dishes/:id - 更新菜品信息
   - DELETE /admin/dishes/:id - 删除菜品

3. **权限控制**
   - dish:view - 查看权限
   - dish:create - 创建权限
   - dish:edit - 编辑权限
   - dish:delete - 删除权限

4. **食堂级别权限**
   - 管理员可以被限制在特定食堂
   - 只能管理自己食堂的菜品

## 测试账户

seed.ts 中创建了以下测试账户：

1. **testadmin** (超级管理员)
   - 用户名: testadmin
   - 密码: password123
   - 权限: 所有权限

2. **normaladmin** (普通管理员)
   - 用户名: normaladmin
   - 密码: admin123
   - 权限: dish:view

3. **limitedadmin** (受限管理员)
   - 用户名: limitedadmin
   - 密码: limited123
   - 权限: dish:view, dish:edit

4. **canteenadmin** (食堂管理员)
   - 用户名: canteenadmin
   - 密码: canteen123
   - 权限: dish:view, dish:create, dish:edit, dish:delete
   - 限制: 仅能管理第一食堂的菜品

## 运行测试

### 运行所有测试
```bash
cd backend
pnpm test
```

### 只运行 admin-dishes 模块测试
```bash
cd backend
pnpm test:e2e:admin-dishes
```

### 运行特定模块测试
```bash
# Auth 模块测试
pnpm test:e2e:auth

# Dishes 模块测试
pnpm test:e2e:dishes

# Admin Dishes 模块测试
pnpm test:e2e:admin-dishes
```

## 测试覆盖

admin-dishes.e2e-spec.ts 包含以下测试场景：

### GET /admin/dishes
- ✅ 超级管理员获取菜品列表
- ✅ 分页参数测试
- ✅ 状态筛选（online/offline）
- ✅ 食堂ID筛选
- ✅ 关键字搜索
- ✅ 未授权访问（401）
- ✅ 非管理员访问（403）
- ✅ 普通管理员访问（有view权限）
- ✅ 食堂管理员只能看到自己食堂的菜品
- ✅ 食堂管理员访问其他食堂菜品被拒绝

### GET /admin/dishes/:id
- ✅ 获取菜品详情
- ✅ 不存在的菜品（404）
- ✅ 非管理员访问（403）
- ✅ 食堂管理员查看自己食堂菜品
- ✅ 食堂管理员查看其他食堂菜品被拒绝

### POST /admin/dishes
- ✅ 超级管理员创建菜品
- ✅ 缺少必填字段（400）
- ✅ 无效价格（400）
- ✅ 不存在的食堂（400）
- ✅ 无创建权限的管理员（403）
- ✅ 食堂管理员创建自己食堂菜品
- ✅ 食堂管理员创建其他食堂菜品被拒绝

### PUT /admin/dishes/:id
- ✅ 超级管理员更新菜品
- ✅ 部分字段更新
- ✅ 不存在的菜品（404）
- ✅ 无编辑权限的管理员（403）
- ✅ 有编辑权限的管理员更新
- ✅ 食堂管理员更新自己食堂菜品
- ✅ 食堂管理员更新其他食堂菜品被拒绝

### DELETE /admin/dishes/:id
- ✅ 超级管理员删除菜品
- ✅ 不存在的菜品（404）
- ✅ 无删除权限的管理员（403）
- ✅ 仅有编辑权限的管理员（403）
- ✅ 食堂管理员删除自己食堂菜品
- ✅ 食堂管理员删除其他食堂菜品被拒绝
- ✅ 删除有子菜品的菜品失败（400）

## API 响应格式

所有响应都遵循统一的格式：

### 成功响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 响应数据
  }
}
```

### 列表响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [...],
    "meta": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 错误响应
```json
{
  "code": 400,
  "message": "错误信息",
  "errors": [
    {
      "field": "price",
      "message": "价格必须大于0"
    }
  ]
}
```

## 注意事项

1. 所有管理端API都需要管理员token认证
2. token需要包含 `type: 'admin'` 字段
3. 超级管理员（role: 'superadmin'）拥有所有权限
4. 普通管理员需要明确的权限配置
5. 食堂管理员受canteenId限制
6. 响应格式符合OpenAPI规范

## 项目结构

```
backend/src/admin-dishes/
├── admin-dishes.controller.ts  # 控制器
├── admin-dishes.service.ts     # 业务逻辑
├── admin-dishes.module.ts      # 模块配置
└── dto/
    ├── admin-dish.dto.ts           # 请求DTO
    └── admin-dish-response.dto.ts  # 响应DTO

backend/src/auth/
├── guards/
│   ├── admin-auth.guard.ts     # 管理员认证守卫
│   └── permissions.guard.ts    # 权限检查守卫
└── decorators/
    └── permissions.decorator.ts # 权限装饰器

backend/test/
└── admin-dishes.e2e-spec.ts    # E2E测试
```
