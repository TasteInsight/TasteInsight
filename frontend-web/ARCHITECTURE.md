# 项目架构说明

## 目录结构

```
src/
├── api/                    # API 接口模块
│   ├── modules/           # API 子模块
│   │   ├── auth.ts       # 认证相关接口
│   │   ├── admin.ts      # 管理员相关接口
│   │   └── dish.ts       # 菜品相关接口
│   └── index.ts          # 统一导出所有 API
│
├── config/                # 配置文件
│   ├── env.ts            # 环境变量配置
│   └── index.ts          # 应用配置（包含 baseURL）
│
├── store/                 # 状态管理
│   ├── modules/          # Store 子模块
│   │   ├── use-auth-store.ts    # 认证状态
│   │   └── use-dish-store.ts    # 菜品状态
│   └── index.ts          # Pinia 实例导出
│
├── types/                 # 类型定义
│   └── api.d.ts          # API 相关类型定义
│
├── utils/                 # 工具函数
│   └── request.ts        # 网络请求拦截和错误处理
│
├── components/            # 组件
├── router/               # 路由
├── views/                # 页面
└── assets/               # 静态资源
```

## 使用说明

### 1. API 调用

```typescript
// 方式一：统一 API 对象（向后兼容）
import { api } from '@/api'
await api.adminLogin(credentials)

// 方式二：分类导入（推荐）
import { authApi, adminApi, dishApi } from '@/api'
await authApi.adminLogin(credentials)
await adminApi.getAdmins({ page: 1, pageSize: 10 })
await dishApi.getDishes()
```

### 2. 状态管理

```typescript
// 导入 Store
import { useAuthStore } from '@/store/modules/use-auth-store'
import { useDishStore } from '@/store/modules/use-dish-store'

// 在组件中使用
const authStore = useAuthStore()
const dishStore = useDishStore()
```

### 3. 配置管理

```typescript
// 导入配置
import config from '@/config'
import { env } from '@/config/env'

// 使用配置
console.log(config.baseURL)
console.log(env.VITE_API_BASE_URL)
```

### 4. 类型定义

```typescript
// 导入类型
import type { 
  LoginCredentials, 
  LoginResponse,
  Admin,
  Dish,
  PaginationParams,
  PaginationResponse 
} from '@/types/api'
```

## 架构优势

1. **清晰的职责分离**
   - `utils/request.ts`: 专注于网络请求拦截和错误处理
   - `config/`: 统一管理配置和环境变量
   - `types/`: 集中管理类型定义
   - `api/modules/`: 按功能模块组织 API

2. **易于维护和扩展**
   - 模块化设计，新增功能只需添加对应模块
   - 类型定义集中管理，便于复用
   - 配置统一管理，修改方便

3. **类型安全**
   - 所有 API 都有完整的类型定义
   - TypeScript 提供完整的类型检查

4. **向后兼容**
   - `api/index.ts` 保留了原有的 API 调用方式
   - 现有代码无需大量修改即可使用新架构
