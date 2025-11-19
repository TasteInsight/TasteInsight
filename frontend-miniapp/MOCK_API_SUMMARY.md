# Mock API 实现总结

## 📌 概述

为了支持前端开发和测试，在 `src/api/modules/user.ts` 中实现了完整的 Mock API 系统，覆盖所有用户相关功能，包括：

- ✅ 微信登录
- ✅ 用户信息获取和更新
- ✅ 我的评价
- ✅ 我的收藏
- ✅ 浏览历史及清空

## 🔧 实现的 Mock 功能

### 1. **微信登录** (`wechatLogin`)

**Mock 行为**:
- 模拟 800ms 网络延迟
- 返回 Mock Token (包含 accessToken 和 refreshToken)
- 返回完整的用户信息
- 自动保存用户信息到 `mock_user_profile` 存储键

**返回数据结构**:
```typescript
{
  code: 200,
  message: '登录成功',
  data: {
    token: {
      accessToken: 'mock_access_token_1234567890',
      refreshToken: 'mock_refresh_token_1234567890'
    },
    user: { /* 完整用户信息 */ }
  }
}
```

**控制台日志**: `🔐 [Mock] 微信登录成功:`

---

### 2. **获取用户信息** (`getUserProfile`)

**Mock 行为**:
- 模拟 300ms 网络延迟
- 从 `mock_user_profile` 存储键读取数据
- 如果没有存储数据，创建默认测试用户

**默认用户数据**:
- 昵称: "测试用户"
- 所有口味偏好: 0 (未设置)
- 价格区间: 20-100 元
- 食材列表、过敏原列表均为空

**控制台日志**: `📱 [Mock] 获取用户信息:`

---

### 3. **更新用户信息** (`updateUserProfile`)

**Mock 行为**:
- 模拟 500ms 网络延迟
- 深度合并更新数据（保留未修改的字段）
- 特殊处理 `preferences.tastePreferences` 的深度合并
- 保存到 `mock_user_profile` 存储键

**数据合并策略**:
```typescript
// 顶层字段合并
nickname: profileData.nickname ?? currentUser.nickname

// preferences 整体合并
preferences: { ...currentUser.preferences, ...profileData.preferences }

// tastePreferences 深度合并
tastePreferences: {
  ...currentUser.preferences.tastePreferences,
  ...profileData.preferences.tastePreferences
}
```

**控制台日志**: `✅ [Mock] 更新用户信息成功:`

---

### 4. **获取我的评价** (`getMyReviews`)

**Mock 行为**:
- 模拟 400ms 网络延迟
- 从 `mock_user_reviews` 存储键读取数据
- 支持分页参数 (page, pageSize)
- 返回分页元信息 (total, totalPages)

**Mock 数据**:
- 默认 3 条评价记录
- 包含菜品名称、图片、评分、内容、时间
- 评分: 4-5 星
- 状态: approved

**分页逻辑**:
```typescript
const page = params?.page ?? 1;
const pageSize = params?.pageSize ?? 10;
const items = allReviews.slice((page-1)*pageSize, page*pageSize);
```

**控制台日志**: `📝 [Mock] 获取我的评价 (第X页):`

---

### 5. **获取我的收藏** (`getMyFavorites`)

**Mock 行为**:
- 模拟 400ms 网络延迟
- 从 `mock_user_favorites` 存储键读取数据
- 支持分页参数
- 返回分页元信息

**Mock 数据**:
- 默认 3 条收藏记录
- 每条记录只包含: `{ dishId, addedAt }`
- dishId: dish_001, dish_004, dish_005

**注意**: 
根据 API 类型定义，`Favorite` 接口只包含 `dishId` 和 `addedAt` 两个字段。如果前端需要展示菜品详情（名称、图片、价格等），需要根据 `dishId` 调用菜品详情 API。

**控制台日志**: `⭐ [Mock] 获取我的收藏 (第X页):`

---

### 6. **获取浏览历史** (`getBrowseHistory`)

**Mock 行为**:
- 模拟 400ms 网络延迟
- 从 `mock_user_history` 存储键读取数据
- 支持分页参数
- 返回分页元信息

**Mock 数据**:
- 默认 5 条历史记录
- 每条记录只包含: `{ dishId, viewedAt }`
- 按时间倒序排列（最近浏览的在前）

**注意**:
与收藏类似，`BrowseHistoryItem` 接口只包含 `dishId` 和 `viewedAt` 字段。前端需要根据 `dishId` 查询菜品详情进行展示。

**控制台日志**: `🕒 [Mock] 获取浏览历史 (第X页):`

---

### 7. **清空浏览历史** (`clearBrowseHistory`)

**Mock 行为**:
- 模拟 300ms 网络延迟
- 删除 `mock_user_history` 存储键
- 返回成功响应

**控制台日志**: `🗑️ [Mock] 清空浏览历史成功`

---

## 🗂️ 数据存储结构

所有 Mock 数据使用 `uni.storage` 存储，确保数据持久化：

| 存储键 | 数据类型 | 说明 |
|--------|---------|------|
| `mock_user_profile` | `User` | 用户完整信息（含偏好设置） |
| `mock_user_reviews` | `MyReviewItem[]` | 用户发表的评价列表 |
| `mock_user_favorites` | `Favorite[]` | 用户收藏的菜品 ID 列表 |
| `mock_user_history` | `BrowseHistoryItem[]` | 用户浏览历史记录 |

### 存储数据示例

**用户信息** (mock_user_profile):
```json
{
  "id": "mock_user_001",
  "openId": "mock_openid_001",
  "nickname": "测试用户",
  "avatar": "https://via.placeholder.com/100",
  "preferences": {
    "id": "pref_001",
    "userId": "mock_user_001",
    "priceRange": { "min": 20, "max": 100 },
    "tastePreferences": {
      "spiciness": 0,
      "sweetness": 0,
      "saltiness": 0,
      "oiliness": 0
    },
    "favoriteIngredients": [],
    "avoidIngredients": []
  },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**评价列表** (mock_user_reviews):
```json
[
  {
    "id": "review_001",
    "userId": "mock_user_001",
    "dishId": "dish_001",
    "dishName": "宫保鸡丁",
    "dishImage": "https://via.placeholder.com/300",
    "userNickname": "测试用户",
    "userAvatar": "https://via.placeholder.com/100",
    "rating": 5,
    "content": "味道很好，辣度适中，鸡肉很嫩！",
    "images": ["https://via.placeholder.com/300"],
    "status": "approved",
    "createdAt": "2025-01-19T00:00:00.000Z"
  }
]
```

**收藏列表** (mock_user_favorites):
```json
[
  {
    "dishId": "dish_001",
    "addedAt": "2025-01-19T00:00:00.000Z"
  },
  {
    "dishId": "dish_004",
    "addedAt": "2025-01-18T00:00:00.000Z"
  }
]
```

**浏览历史** (mock_user_history):
```json
[
  {
    "dishId": "dish_001",
    "viewedAt": "2025-01-20T11:00:00.000Z"
  },
  {
    "dishId": "dish_002",
    "viewedAt": "2025-01-20T09:00:00.000Z"
  }
]
```

---

## 🎮 使用方法

### 开启 Mock 模式

在 `src/api/modules/user.ts` 文件顶部：

```typescript
const USE_MOCK = true;  // ✅ 设置为 true
```

### 关闭 Mock 模式（连接真实后端）

```typescript
const USE_MOCK = false;  // ❌ 设置为 false
```

### 查看 Mock 数据

在浏览器控制台或小程序开发工具控制台执行：

```javascript
// 查看所有存储键
console.log(uni.getStorageInfoSync());

// 查看用户信息
console.log(JSON.parse(uni.getStorageSync('mock_user_profile')));

// 查看评价
console.log(JSON.parse(uni.getStorageSync('mock_user_reviews')));

// 查看收藏
console.log(JSON.parse(uni.getStorageSync('mock_user_favorites')));

// 查看历史
console.log(JSON.parse(uni.getStorageSync('mock_user_history')));
```

### 重置 Mock 数据

```javascript
// 清空单个存储
uni.removeStorageSync('mock_user_profile');

// 清空所有 Mock 数据
uni.removeStorageSync('mock_user_profile');
uni.removeStorageSync('mock_user_reviews');
uni.removeStorageSync('mock_user_favorites');
uni.removeStorageSync('mock_user_history');
```

---

## 🧪 测试建议

1. **基础功能测试**
   - 登录 → 查看 Profile → 修改 Settings → 保存 → 刷新验证

2. **评价功能测试**
   - 进入"我的评价" → 查看列表 → 检查数据完整性

3. **收藏功能测试**
   - 进入"我的收藏" → 查看列表 → 验证 dishId 正确

4. **历史功能测试**
   - 进入"历史浏览" → 查看列表 → 测试清空功能

5. **数据持久化测试**
   - 执行操作 → 关闭小程序 → 重新打开 → 验证数据仍存在

6. **分页功能测试**（如果页面实现了分页）
   - 切换页码 → 验证数据切片正确 → 检查分页元信息

---

## 🐛 调试技巧

### 1. 观察控制台日志

每个 Mock API 都会打印详细日志：
- 🔐 登录成功
- 📱 获取用户信息
- ✅ 更新用户信息成功
- 📝 获取我的评价
- ⭐ 获取我的收藏
- 🕒 获取浏览历史
- 🗑️ 清空浏览历史成功

### 2. 检查网络延迟

如果觉得 Mock 响应太快/太慢，可以调整延迟时间：

```typescript
// 在 user.ts 中修改
await mockDelay(300);  // 改为你想要的毫秒数
```

### 3. 自定义 Mock 数据

修改 `createMockXxx()` 函数来自定义 Mock 数据：

```typescript
const createMockReviews = (): MyReviewItem[] => [
  {
    id: 'review_001',
    // ... 修改这里的数据
  }
];
```

### 4. 验证数据结构

使用 TypeScript 类型检查确保 Mock 数据结构正确：

```typescript
const mockUser: User = createMockUser();  // ✅ 类型安全
```

---

## ✨ Mock 系统特性

### 1. **非侵入式设计**
- 所有 Mock 逻辑封装在 API 层
- 页面组件无需修改
- 一键切换 Mock/真实后端

### 2. **完整的类型支持**
- 所有 Mock 数据严格遵循 TypeScript 类型定义
- 编译时类型检查，减少运行时错误

### 3. **真实的网络行为模拟**
- 模拟网络延迟（300-800ms）
- 异步 Promise 返回
- 符合 ApiResponse 标准结构

### 4. **数据持久化**
- 使用 uni.storage 跨平台存储
- 刷新/重启后数据不丢失
- 支持手动清空和重置

### 5. **分页支持**
- 完整实现分页逻辑
- 返回标准 PaginatedData 结构
- 包含 meta 元信息（total, totalPages）

### 6. **开发友好**
- 详细的控制台日志
- 易于定位问题
- 支持自定义 Mock 数据

---

## 📝 注意事项

### 1. **收藏和历史的数据结构**

根据后端 API 设计，`Favorite` 和 `BrowseHistoryItem` 只包含最基本的字段：

```typescript
interface Favorite {
  dishId: string;
  addedAt: string;
}

interface BrowseHistoryItem {
  dishId: string;
  viewedAt: string;
}
```

这意味着：
- ❌ Mock 数据中**不包含**菜品的名称、图片、价格等详细信息
- ✅ 前端需要根据 `dishId` **调用菜品详情 API** 获取完整信息
- ✅ 这种设计符合 RESTful API 规范，避免数据冗余

### 2. **评价数据的完整性**

`MyReviewItem` 继承自 `Review`，并扩展了 `dishName` 和 `dishImage` 字段：

```typescript
interface MyReviewItem extends Review {
  dishName: string;
  dishImage: string;
}
```

因此评价列表的 Mock 数据包含了菜品基本信息，可以直接展示。

### 3. **Token 类型**

登录返回的 Token 结构：

```typescript
interface Token {
  accessToken?: string;
  refreshToken?: string;
}
```

Mock 实现同时生成 accessToken 和 refreshToken，模拟完整的认证流程。

### 4. **分页默认值**

如果前端没有传递分页参数，Mock 使用以下默认值：
- `page`: 1
- `pageSize`: 10

---

## 🚀 后续优化建议

1. **添加更多 Mock 数据**
   - 可以增加评价、收藏、历史的数量
   - 模拟更多真实场景（不同评分、多图评价等）

2. **支持动态数据操作**
   - 添加收藏：将新收藏写入 storage
   - 删除收藏：从 storage 移除指定项
   - 添加评价：写入新评价到 storage

3. **错误场景模拟**
   - 模拟网络错误 (code: 500)
   - 模拟未授权 (code: 401)
   - 模拟数据验证失败 (code: 400)

4. **Mock 菜品详情 API**
   - 实现 `getDishById` 的 Mock
   - 支持收藏和历史页面查询菜品详情

5. **数据关联优化**
   - 在收藏和历史的 Mock 中动态关联菜品数据
   - 避免前端多次 API 调用

---

## 📚 相关文档

- [完整测试指南](./MOCK_TESTING_GUIDE.md) - 详细的测试场景和步骤
- [API 类型定义](./src/types/api.d.ts) - 所有接口的 TypeScript 类型
- [用户 API 模块](./src/api/modules/user.ts) - Mock 实现源码

---

**创建日期**: 2025年11月20日  
**Mock 覆盖率**: 6/6 用户相关 API (100%)  
**维护状态**: ✅ 活跃维护

如有问题或建议，请查看代码注释或联系开发团队。
