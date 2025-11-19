# Mock 数据与业务逻辑分离指南

## 📁 新的文件结构

```
src/
├── mock/
│   ├── index.ts                    # Mock 统一入口
│   ├── data/                       # Mock 数据定义
│   │   ├── user.ts                 # 用户 Mock 数据
│   │   ├── dish.ts                 # 菜品 Mock 数据
│   │   ├── news.ts                 # 新闻 Mock 数据
│   │   └── meal-plan.ts            # 饮食计划 Mock 数据
│   └── services/                   # Mock 服务逻辑
│       ├── user.ts                 # 用户 Mock 服务
│       ├── dish.ts                 # 菜品 Mock 服务
│       ├── news.ts                 # 新闻 Mock 服务
│       └── meal-plan.ts            # 饮食计划 Mock 服务
└── api/
    └── modules/                    # 真实 API 调用
        ├── user.ts
        ├── dish.ts
        ├── news.ts
        └── meal-plan.ts
```

## 🔧 使用方式

### 1. 在 API 文件中引入 Mock 服务

以 `user.ts` 为例：

```typescript
// @/api/modules/user.ts
import request from '@/utils/request';
import type { User, LoginData, UserProfileUpdateRequest } from '@/types/api';

// 导入 Mock 服务
import { 
  USE_MOCK,
  mockWechatLogin,
  mockGetUserProfile,
  mockUpdateUserProfile,
  mockGetMyReviews,
  mockGetMyFavorites,
  mockGetBrowseHistory,
  mockClearBrowseHistory,
} from '@/mock';

/**
 * 微信登录
 */
export const wechatLogin = async (code: string): Promise<LoginData> => {
  if (USE_MOCK) {
    return await mockWechatLogin(code);
  }
  
  return request<LoginData>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: { code },
  });
};

/**
 * 获取用户信息
 */
export const getUserProfile = async (): Promise<User> => {
  if (USE_MOCK) {
    return await mockGetUserProfile();
  }
  
  return request<User>({
    url: '/user/profile',
    method: 'GET',
  });
};

/**
 * 更新用户信息
 */
export const updateUserProfile = async (data: UserProfileUpdateRequest): Promise<User> => {
  if (USE_MOCK) {
    return await mockUpdateUserProfile(data);
  }
  
  return request<User>({
    url: '/user/profile',
    method: 'PUT',
    data,
  });
};
```

### 2. 菜品 API 示例

```typescript
// @/api/modules/dish.ts
import request from '@/utils/request';
import type { Dish } from '@/types/api';
import { USE_MOCK, mockGetDishById } from '@/mock';

/**
 * 获取菜品详情
 */
export const getDishById = async (id: string): Promise<Dish | null> => {
  if (USE_MOCK) {
    return await mockGetDishById(id);
  }
  
  return request<Dish>({
    url: `/dishes/${id}`,
    method: 'GET',
  });
};
```

### 3. 新闻 API 示例

```typescript
// @/api/modules/news.ts
import request from '@/utils/request';
import type { News, PaginationParams, PaginatedData } from '@/types/api';
import { USE_MOCK, mockGetNewsList, mockGetNewsById } from '@/mock';

/**
 * 获取新闻列表
 */
export const getNewsList = async (params?: PaginationParams): Promise<PaginatedData<News>> => {
  if (USE_MOCK) {
    return await mockGetNewsList(params);
  }
  
  return request<PaginatedData<News>>({
    url: '/news',
    method: 'GET',
    data: params,
  });
};

/**
 * 获取新闻详情
 */
export const getNewsById = async (id: string): Promise<News | null> => {
  if (USE_MOCK) {
    return await mockGetNewsById(id);
  }
  
  return request<News>({
    url: `/news/${id}`,
    method: 'GET',
  });
};
```

### 4. 饮食计划 API 示例

```typescript
// @/api/modules/meal-plan.ts
import request from '@/utils/request';
import type { MealPlan } from '@/types/api';
import { USE_MOCK, mockGetMealPlans } from '@/mock';

/**
 * 获取饮食计划列表
 */
export const getMealPlans = async (): Promise<MealPlan[]> => {
  if (USE_MOCK) {
    return await mockGetMealPlans();
  }
  
  return request<MealPlan[]>({
    url: '/meal-plans',
    method: 'GET',
  });
};
```

## 🔄 Mock 开关控制

### 全局开关

在 `src/mock/index.ts` 中：

```typescript
export const USE_MOCK = true; // 全局启用 Mock
```

### 单个接口控制

也可以在具体的 API 文件中覆盖全局配置：

```typescript
import { USE_MOCK as GLOBAL_USE_MOCK } from '@/mock';

const USE_MOCK_FOR_THIS_API = true; // 覆盖全局配置

export const someApi = async () => {
  if (USE_MOCK_FOR_THIS_API) {
    return await mockSomeApi();
  }
  // 真实 API 调用...
};
```

## 📊 Mock 数据管理

### 持久化存储

用户相关数据使用 `uni.storage` 持久化：

```typescript
// 存储键定义
export const STORAGE_KEYS = {
  USER: 'mock_user_profile',
  REVIEWS: 'mock_user_reviews',
  FAVORITES: 'mock_user_favorites',
  HISTORY: 'mock_user_history',
};
```

### 内存数据

新闻、菜品、计划等数据每次动态生成，不持久化。

## 🚀 开始使用

1. **启用 Mock 模式**
   ```typescript
   // src/mock/index.ts
   export const USE_MOCK = true;
   ```

2. **重启项目**
   ```bash
   pnpm run dev:mp-weixin
   ```

3. **查看控制台日志**
   - 所有 Mock 请求都会打印日志
   - 带有 emoji 前缀方便识别（🔐📱✅📝⭐🕒🍽️📰📅）

4. **切换到真实 API**
   ```typescript
   export const USE_MOCK = false;
   ```

## 📝 添加新的 Mock 数据

### 1. 创建 Mock 数据文件

```typescript
// src/mock/data/xxx.ts
import type { XXX } from '@/types/api';

export const createMockXXX = (): XXX[] => [
  // Mock 数据...
];
```

### 2. 创建 Mock 服务文件

```typescript
// src/mock/services/xxx.ts
import { createMockXXX } from '../data/xxx';

export const mockGetXXX = async (): Promise<XXX[]> => {
  console.log('📦 [Mock] 获取 XXX');
  await new Promise(resolve => setTimeout(resolve, 300));
  return createMockXXX();
};
```

### 3. 在入口文件导出

```typescript
// src/mock/index.ts
export * from './services/xxx';
```

### 4. 在 API 文件中使用

```typescript
// src/api/modules/xxx.ts
import { USE_MOCK, mockGetXXX } from '@/mock';

export const getXXX = async (): Promise<XXX[]> => {
  if (USE_MOCK) {
    return await mockGetXXX();
  }
  return request({ url: '/xxx', method: 'GET' });
};
```

## ✅ 总结

通过将 Mock 数据和服务从 API 文件中分离出来：

1. **代码更清晰** - API 文件专注于接口定义
2. **易于维护** - Mock 数据集中管理
3. **灵活切换** - 全局或单个接口控制
4. **类型安全** - 完整的 TypeScript 支持
5. **开发高效** - 无需等待后端即可开发

现在你的 Mock 数据已经完全独立于业务逻辑，可以轻松管理和维护！
