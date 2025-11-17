# API 模块说明

## 模块结构

为了更好的代码组织和维护，API 已按业务功能拆分为以下模块：

```
src/api/modules/
├── auth.ts         # 认证管理
├── dish.ts         # 菜品管理
├── review.ts       # 审核管理
├── permission.ts   # 权限管理
├── log.ts          # 日志管理
├── news.ts         # 新闻管理
└── canteen.ts      # 食堂窗口管理
```

## 各模块功能

### 1. 认证管理 (`auth.ts`)
- 管理员登录
- Token 刷新

### 2. 菜品管理 (`dish.ts`)
- 获取菜品列表（分页）
- 获取单个菜品详情
- 创建菜品
- 更新菜品
- 删除菜品
- 批量上传菜品（Excel）
- 修改菜品状态（上下架）
- 上传图片

### 3. 审核管理 (`review.ts`)
- 获取待审核评价列表
- 通过/拒绝评价审核
- 获取待审核评论列表
- 通过/拒绝评论审核
- 获取举报列表
- 处理举报
- 获取待审核用户上传菜品
- 通过/拒绝用户上传菜品

### 4. 权限管理 (`permission.ts`)
- 获取子管理员列表
- 创建子管理员
- 删除子管理员
- 更新子管理员权限

### 5. 日志管理 (`log.ts`)
- 获取操作日志（支持多条件筛选）

### 6. 新闻管理 (`news.ts`)
- 获取新闻列表
- 创建新闻
- 更新新闻
- 删除新闻

### 7. 食堂窗口管理 (`canteen.ts`)
- 获取食堂列表
- 创建食堂
- 更新食堂
- 删除食堂
- 获取窗口列表（按食堂）
- 创建窗口
- 更新窗口
- 删除窗口

## 使用方式

### 推荐方式：按需导入

```typescript
// 导入需要的模块
import { dishApi, reviewApi, canteenApi } from '@/api'

// 使用
const dishes = await dishApi.getDishes({ page: 1, pageSize: 10 })
const reviews = await reviewApi.getPendingReviews()
const canteens = await canteenApi.getCanteens()
```

### 兼容方式：统一接口

```typescript
// 统一导入
import { api } from '@/api'

// 使用（向后兼容）
const dishes = await api.getDishes({ page: 1, pageSize: 10 })
```

## 类型定义

所有 API 的请求参数和响应类型都在 `src/types/api.d.ts` 中定义，可以获得完整的 TypeScript 类型支持。

```typescript
import type { Dish, Canteen, Window } from '@/types/api'
```

## 示例

### 完整的菜品管理流程

```typescript
import { dishApi } from '@/api'

// 1. 上传图片
const imageFile = // ... 获取文件
const imageResult = await dishApi.uploadImage(imageFile)
const imageUrl = imageResult.data.url

// 2. 创建菜品
const dish = await dishApi.createDish({
  name: '宫保鸡丁',
  price: 15,
  description: '经典川菜',
  images: [imageUrl],
  canteenId: 'canteen_1',
  windowName: '川菜窗口',
  tags: ['川菜', '微辣'],
  ingredients: ['鸡肉', '花生', '辣椒'],
  allergens: ['花生'],
  availableMealTime: ['lunch', 'dinner']
})

// 3. 上架菜品
await dishApi.updateDishStatus(dish.data.id, 'online')

// 4. 获取菜品列表
const result = await dishApi.getDishes({
  page: 1,
  pageSize: 10,
  status: 'online'
})
```

### 完整的审核流程

```typescript
import { reviewApi } from '@/api'

// 1. 获取待审核评价
const pendingReviews = await reviewApi.getPendingReviews({
  page: 1,
  pageSize: 20
})

// 2. 审核评价
for (const review of pendingReviews.data.items) {
  if (/* 审核通过条件 */) {
    await reviewApi.approveReview(review.id)
  } else {
    await reviewApi.rejectReview(review.id, '内容不符合规范')
  }
}
```

### 完整的食堂管理流程

```typescript
import { canteenApi } from '@/api'

// 1. 创建食堂
const canteen = await canteenApi.createCanteen({
  name: '紫荆园',
  position: '学校东侧',
  description: '主要供应中餐和西餐',
  images: ['https://example.com/canteen.jpg'],
  openingHours: [
    { day: '周一至周五', open: '07:00', close: '20:00' },
    { day: '周六至周日', open: '08:00', close: '19:00' }
  ]
})

// 2. 在食堂下创建窗口
await canteenApi.createWindow({
  name: '川菜窗口',
  number: 'A-01',
  canteenId: canteen.data.id,
  position: '一楼东侧',
  description: '提供各种川菜',
  tags: ['川菜', '辣']
})

await canteenApi.createWindow({
  name: '粤菜窗口',
  number: 'A-02',
  canteenId: canteen.data.id,
  position: '一楼西侧',
  description: '提供各种粤菜',
  tags: ['粤菜', '清淡']
})

// 3. 获取该食堂的所有窗口
const windows = await canteenApi.getWindows(canteen.data.id)
```

## 注意事项

1. **类型安全**：所有方法都有完整的 TypeScript 类型定义，请充分利用 IDE 的类型提示
2. **错误处理**：所有 API 调用都应该包裹在 try-catch 中
3. **认证**：除了登录接口，其他接口都需要先登录获取 token
4. **权限**：确保当前用户有相应的权限才能调用对应的 API

## 迁移指南

如果你的代码使用了旧的 `adminApi`，需要进行以下迁移：

### 审核相关
```typescript
// 旧方式
import { adminApi } from '@/api'
await adminApi.getPendingReviews()

// 新方式
import { reviewApi } from '@/api'
await reviewApi.getPendingReviews()
```

### 权限相关
```typescript
// 旧方式
import { adminApi } from '@/api'
await adminApi.getAdmins()

// 新方式
import { permissionApi } from '@/api'
await permissionApi.getAdmins()
```

### 其他功能类似迁移即可

或者继续使用统一的 `api` 对象（无需修改代码）：
```typescript
import { api } from '@/api'
await api.getPendingReviews()  // 仍然可用
```
