# API 集成指南

## API 模块结构

API 已按功能模块拆分，便于维护和使用：

### 模块列表

- **`auth.ts`** - 认证管理
  - 管理员登录
  - Token 刷新

- **`dish.ts`** - 菜品管理
  - 菜品 CRUD 操作
  - 批量上传
  - 状态管理
  - 图片上传

- **`review.ts`** - 审核管理
  - 评价审核
  - 评论审核
  - 举报处理
  - 用户上传菜品审核

- **`permission.ts`** - 权限管理
  - 子管理员管理
  - 权限分配

- **`log.ts`** - 日志管理
  - 操作日志查询

- **`news.ts`** - 新闻管理
  - 新闻 CRUD 操作

- **`canteen.ts`** - 食堂窗口管理
  - 食堂 CRUD 操作
  - 窗口 CRUD 操作

### 使用方式

#### 方式 1：分类导入（推荐）
```typescript
import { dishApi, reviewApi, canteenApi } from '@/api'

// 使用菜品 API
await dishApi.getDishes()

// 使用审核 API
await reviewApi.getPendingReviews()

// 使用食堂 API
await canteenApi.getCanteens()
```

#### 方式 2：统一导入（向后兼容）
```typescript
import { api } from '@/api'

// 仍然可用，但不推荐
await api.getDishes()
await api.getPendingReviews()
await api.getCanteens()
```

## 当前实现状态

### ✅ 已完成的改进

1. **统一 Token 管理**
   - `request.ts` 现在集成了 `use-auth-store`
   - 优先从 Pinia store 获取 token，确保状态同步
   - 支持从 localStorage/sessionStorage 回退

2. **自动 Token 刷新机制**
   - 当收到 401 响应时，自动尝试刷新 token
   - 刷新期间的请求会进入队列，刷新成功后统一重试
   - 刷新失败自动登出并清除所有认证信息

3. **改进的错误处理**
   - 401: 自动刷新 token 或登出
   - 403: 无权限访问提示
   - 网络错误: 友好的错误提示

4. **API 响应格式统一**
   - 所有 API 返回 `ApiResponse<T>` 类型
   - 成功响应：`{ code: 200, message: "成功", data: T }`
   - 错误响应：`{ code: 4xx/5xx, message: "错误信息" }`

### 📋 API 响应格式对齐

根据后端 API 文档，响应格式已完全对齐：

#### 登录响应
```typescript
{
  code: 200,
  message: "登录成功",
  data: {
    token: {
      accessToken: "string",
      refreshToken: "string"
    },
    admin: {
      id: "string",
      username: "string",
      role: "admin" | "editor" | "viewer",
      // ...其他字段
    },
    permissions: ["string"]
  }
}
```

#### 分页列表响应
```typescript
{
  code: 200,
  message: "success",
  data: {
    items: [T],
    meta: {
      page: number,
      pageSize: number,
      total: number,
      totalPages: number
    }
  }
}
```

#### 单个资源响应
```typescript
{
  code: 200,
  message: "success",
  data: T
}
```

#### 操作成功响应（无返回数据）
```typescript
{
  code: 200,
  message: "操作成功",
  data: null
}
```

### 🔧 与后端对接前的检查清单

#### 1. 环境配置
在 `src/config/env.ts` 中配置正确的后端地址：

```typescript
// 开发环境
VITE_API_BASE_URL=http://localhost:3000/api

// 生产环境
VITE_API_BASE_URL=https://api.tasteinsight.com
```

#### 2. 关闭 Mock 模式
在浏览器控制台执行：
```javascript
localStorage.removeItem('mock_mode')
```

或在 `src/utils/request.ts` 中修改：
```typescript
const isMockMode = () => {
  return false; // 强制关闭 Mock 模式
}
```

#### 3. Token 格式确认
确认后端期望的 Authorization 头格式：
```
Authorization: Bearer <token>
```

如果后端使用不同的格式，需要修改 `request.ts` 中的请求拦截器。

#### 4. 跨域配置
确保后端配置了正确的 CORS 策略，允许前端域名访问：
```javascript
// 后端需要配置
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Authorization, Content-Type
```

或在 `vite.config.ts` 中配置代理：
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### 🔄 请求流程

#### 正常请求流程
```
1. 用户发起请求
   ↓
2. 请求拦截器添加 token
   ↓
3. 发送到后端
   ↓
4. 响应拦截器处理响应
   ↓
5. 返回数据给调用方
```

#### Token 过期处理流程
```
1. 用户发起请求
   ↓
2. 后端返回 401
   ↓
3. 响应拦截器捕获 401
   ↓
4. 尝试使用 refreshToken 刷新
   ↓
5a. 刷新成功
    ↓
    更新 token
    ↓
    重试原始请求
    ↓
    返回数据

5b. 刷新失败
    ↓
    清除认证信息
    ↓
    跳转到登录页
```

### 🧪 测试建议

#### 1. 登录测试
```typescript
// 在组件中测试
import { useAuthStore } from '@/store/modules/use-auth-store'

const authStore = useAuthStore()
try {
  await authStore.login({
    username: 'admin',
    password: 'password',
    remember: true
  })
  console.log('登录成功', authStore.user)
} catch (error) {
  console.error('登录失败', error)
}
```

#### 2. API 调用测试
```typescript
import { dishApi } from '@/api/modules/dish'

// 测试获取菜品列表
const response = await dishApi.getDishes({
  page: 1,
  pageSize: 10
})
console.log('菜品列表', response.data)
```

#### 3. Token 刷新测试
```typescript
// 模拟 token 过期
localStorage.setItem('admin_token', 'expired_token')

// 发起请求，应该自动刷新 token
const response = await dishApi.getDishes()
```

### 📝 API 使用示例

#### 菜品管理
```typescript
import { dishApi } from '@/api'

// 获取菜品列表
const dishes = await dishApi.getDishes({ page: 1, pageSize: 10 })

// 获取单个菜品
const dish = await dishApi.getDishById('dish_id')

// 创建菜品
const newDish = await dishApi.createDish({
  name: '宫保鸡丁',
  price: 15,
  canteenId: 'canteen_1',
  windowName: '川菜窗口',
  // ...
})

// 更新菜品
await dishApi.updateDish('dish_id', { price: 18 })

// 删除菜品
await dishApi.deleteDish('dish_id')

// 更新菜品状态
await dishApi.updateDishStatus('dish_id', 'online')

// 上传图片
const imageResponse = await dishApi.uploadImage(file)
const imageUrl = imageResponse.data.url

// 批量上传
await dishApi.batchUpload(excelFile)
```

#### 权限管理
```typescript
import { permissionApi } from '@/api'

// 获取管理员列表
const admins = await permissionApi.getAdmins({ page: 1, pageSize: 10 })

// 创建子管理员
await permissionApi.createAdmin({
  username: 'editor1',
  password: 'password',
  role: 'editor',
  permissions: ['dish:read', 'dish:write']
})

// 更新权限
await permissionApi.updateAdminPermissions('admin_id', ['dish:read', 'dish:write', 'review:manage'])

// 删除管理员
await permissionApi.deleteAdmin('admin_id')
```

#### 审核管理
```typescript
import { reviewApi } from '@/api'

// 获取待审核评价
const reviews = await reviewApi.getPendingReviews({ page: 1, pageSize: 20 })

// 通过评价审核
await reviewApi.approveReview('review_id')

// 拒绝评价审核
await reviewApi.rejectReview('review_id', '内容不当')

// 获取待审核评论
const comments = await reviewApi.getPendingComments({ page: 1, pageSize: 20 })

// 通过评论审核
await reviewApi.approveComment('comment_id')

// 拒绝评论审核
await reviewApi.rejectComment('comment_id', '包含不当内容')

// 获取举报列表
const reports = await reviewApi.getReports({ 
  page: 1, 
  pageSize: 20, 
  status: 'pending' 
})

// 处理举报
await reviewApi.handleReport('report_id', { 
  action: 'approve', 
  reason: '举报属实' 
})

// 获取待审核用户上传菜品
const uploads = await reviewApi.getPendingUploads({ page: 1, pageSize: 20 })

// 通过用户上传审核
await reviewApi.approveUpload('upload_id')

// 拒绝用户上传审核
await reviewApi.rejectUpload('upload_id', '信息不完整')
```

#### 日志管理
```typescript
import { logApi } from '@/api'

// 获取操作日志
const logs = await logApi.getLogs({
  page: 1,
  pageSize: 50,
  adminId: 'admin_id',
  action: 'create',
  startDate: '2025-01-01',
  endDate: '2025-12-31'
})
```

#### 新闻管理
```typescript
import { newsApi } from '@/api'

// 获取新闻列表
const news = await newsApi.getNews({ page: 1, pageSize: 10 })

// 创建新闻
await newsApi.createNews({
  title: '食堂新菜品上线',
  content: '本周推出多款新菜品...',
  summary: '新菜品上线通知',
  coverImage: 'https://example.com/image.jpg',
  tags: ['新品', '推荐']
})

// 更新新闻
await newsApi.updateNews('news_id', {
  title: '更新后的标题'
})

// 删除新闻
await newsApi.deleteNews('news_id')
```

#### 食堂窗口管理
```typescript
import { canteenApi } from '@/api'

// 获取食堂列表
const canteens = await canteenApi.getCanteens({ page: 1, pageSize: 10 })

// 创建食堂
await canteenApi.createCanteen({
  name: '紫荆园',
  position: '学校东侧',
  description: '主要供应中餐和西餐',
  images: ['https://example.com/canteen.jpg'],
  openingHours: [
    { day: '周一至周五', open: '07:00', close: '20:00' }
  ]
})

// 更新食堂
await canteenApi.updateCanteen('canteen_id', {
  description: '新的描述'
})

// 删除食堂
await canteenApi.deleteCanteen('canteen_id')

// 获取窗口列表
const windows = await canteenApi.getWindows('canteen_id', { page: 1, pageSize: 20 })

// 创建窗口
await canteenApi.createWindow({
  name: '川菜窗口',
  number: 'A-01',
  canteenId: 'canteen_id',
  position: '一楼东侧',
  description: '提供各种川菜',
  tags: ['川菜', '辣']
})

// 更新窗口
await canteenApi.updateWindow('window_id', {
  name: '新川菜窗口'
})

// 删除窗口
await canteenApi.deleteWindow('window_id')
```

### ⚠️ 注意事项

1. **类型安全**
   - 所有 API 方法都有完整的 TypeScript 类型定义
   - 使用 IDE 自动补全减少错误

2. **错误处理**
   - 所有 API 调用都应该包裹在 try-catch 中
   - 使用统一的错误提示组件

3. **加载状态**
   - API 调用期间显示 loading 状态
   - 防止重复提交

4. **Token 存储**
   - 敏感页面使用 sessionStorage（关闭浏览器后失效）
   - "记住我" 功能使用 localStorage

### 🐛 常见问题

#### Q: 为什么请求一直失败？
A: 检查：
- 后端是否启动
- 环境变量配置是否正确
- 是否关闭了 Mock 模式
- 网络和跨域配置

#### Q: Token 刷新不工作？
A: 确认：
- 后端是否实现了 `/auth/refresh` 接口
- refreshToken 是否正确存储
- 响应格式是否与前端期望一致

#### Q: 401 错误后没有跳转登录页？
A: 在路由守卫或组件中监听认证状态：
```typescript
import { useAuthStore } from '@/store/modules/use-auth-store'
import { watch } from 'vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

watch(() => authStore.isAuthenticated, (isAuth) => {
  if (!isAuth) {
    router.push('/login')
  }
})
```

### 📚 相关文件

#### API 模块
- 认证：`src/api/modules/auth.ts`
- 菜品：`src/api/modules/dish.ts`
- 审核：`src/api/modules/review.ts`
- 权限：`src/api/modules/permission.ts`
- 日志：`src/api/modules/log.ts`
- 新闻：`src/api/modules/news.ts`
- 食堂：`src/api/modules/canteen.ts`
- 统一入口：`src/api/index.ts`

#### 其他
- 类型定义：`src/types/api.d.ts`
- 请求封装：`src/utils/request.ts`
- 认证状态：`src/store/modules/use-auth-store.ts`
- 环境配置：`src/config/env.ts`
