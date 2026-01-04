# TasteInsight 小程序前端

TasteInsight 小程序是基于 **UniApp** + **Vue 3** 构建的跨平台应用，主要面向微信小程序平台，为校园用户提供食堂菜品浏览、评价、智能推荐和 AI 聊天等功能。

## 技术栈

- **框架**: UniApp 3.0 + Vue 3.4
- **状态管理**: Pinia 2
- **样式**: TailwindCSS + Sass
- **国际化**: Vue I18n
- **Markdown 渲染**: markdown-it + mp-html
- **单元测试**: Jest 27 + @vue/test-utils
- **E2E 测试**: Playwright
- **负载测试**: Artillery
- **语言**: TypeScript 5
- **包管理器**: pnpm

## 项目结构

```
frontend-miniapp/
├── src/
│   ├── api/                 # API 接口封装
│   ├── components/          # 公共组件
│   │   └── skeleton/        # 骨架屏组件
│   ├── config/              # 配置文件
│   ├── mock/                # Mock 数据服务
│   │   ├── data/            # Mock 数据
│   │   └── services/        # Mock 服务
│   ├── pages/               # 页面目录
│   │   ├── add-dish/        # 添加菜品页
│   │   ├── ai-chat/         # AI 聊天页
│   │   ├── canteen/         # 食堂详情页
│   │   ├── dish/            # 菜品详情页
│   │   ├── easter-egg/      # 彩蛋页
│   │   ├── index/           # 首页
│   │   ├── login/           # 登录页
│   │   ├── news/            # 新闻公告页
│   │   ├── planning/        # 菜单规划页
│   │   ├── profile/         # 个人中心
│   │   ├── search/          # 搜索页
│   │   ├── settings/        # 设置页
│   │   └── window/          # 窗口详情页
│   ├── static/              # 静态资源
│   ├── store/               # Pinia 状态管理
│   │   └── modules/         # 状态模块
│   ├── styles/              # 全局样式
│   ├── test/                # 测试文件
│   │   ├── components/      # 组件测试
│   │   └── unit/            # 单元测试
│   ├── types/               # TypeScript 类型定义
│   ├── utils/               # 工具函数
│   ├── App.vue              # 根组件
│   ├── main.ts              # 应用入口
│   ├── manifest.json        # UniApp 配置
│   ├── pages.json           # 页面路由配置
│   └── uni.scss             # 全局 SCSS 变量
├── e2e/                     # E2E 测试
├── e2e-perf/                # 性能测试
├── load/                    # 负载测试
├── dist/                    # 构建输出
│   ├── build/mp-weixin/     # 微信小程序构建产物
│   └── dev/mp-weixin/       # 微信小程序开发产物
├── playwright.config.ts     # Playwright 配置
├── jest.config.js           # Jest 配置
└── vite.config.ts           # Vite 配置
```

## 功能模块

### 页面列表

| 页面 | 路径 | 功能描述 |
|------|------|----------|
| 登录 | `/pages/login/index` | 微信授权登录、隐私协议 |
| 首页 | `/pages/index/index` | 菜品推荐、多维筛选（口味/价格/评分/时段/荤素/标签/忌口） |
| 搜索 | `/pages/search/index` | 搜索食堂或菜品、上拉加载更多 |
| 食堂详情 | `/pages/canteen/index` | 食堂信息、窗口列表、菜品筛选 |
| 窗口详情 | `/pages/window/index` | 窗口信息、菜品列表 |
| 菜品详情 | `/pages/dish/index` | 菜品信息、评价列表、发布评价、评论回复、收藏 |
| 新闻公告 | `/pages/news/index` | 新闻列表、详情查看 |
| 菜单规划 | `/pages/planning/index` | 当前/历史规划、新建/编辑/删除/执行规划 |
| AI 聊天 | `/pages/ai-chat/index` | AI 对话、流式响应、规划卡片应用、历史会话 |
| 个人中心 | `/pages/profile/index` | 用户信息、收藏、我的评价、浏览历史 |
| 设置 | `/pages/settings/index` | 个人信息、偏好/过敏原、显示/通知设置 |
| 添加菜品 | `/pages/add-dish/index` | 用户上传菜品（待审核） |
| 彩蛋 | `/pages/easter-egg/index` | 隐藏彩蛋页面 |

### 核心功能

#### 首页筛选系统
- 口味筛选：辣度、咸度、甜度、油腻度（支持范围选择）
- 价格筛选：预设区间 + 自定义范围
- 评分筛选：预设评分 + 自定义范围
- 时段筛选：早餐、午餐、晚餐、夜宵（多选）
- 荤素筛选：纯素、纯荤、荤素搭配、海鲜（多选）
- 标签筛选：常用标签 + 自定义标签
- 忌口筛选：常见过敏原 + 自定义忌口

#### 评价系统
- 星级评分（1-5 星）
- 口味评分（辣度/甜度/咸度/油腻度）
- 图片上传（最多 3 张）
- 评价草稿本地缓存（24 小时内自动恢复）
- 评论回复
- 举报功能

#### AI 聊天
- 流式响应
- 建议词推荐
- 场景切换（随便聊聊/餐单规划/菜品点评）
- 规划卡片自动应用到菜单规划
- 历史会话管理
- Markdown 渲染
- 菜品/食堂卡片渲染

#### 菜单规划
- 日期范围选择
- 用餐时段选择
- 按窗口/搜索选择菜品
- 执行规划（移至历史）

### 状态管理模块

| Store | 描述 |
|-------|------|
| `use-user-store` | 用户登录态、Token 管理 |
| `use-canteen-store` | 食堂/窗口数据缓存 |
| `use-dishes-store` | 菜品数据、收藏管理 |
| `use-chat-store` | AI 聊天消息、会话管理 |
| `use-plan-store` | 菜单规划数据 |

## 环境准备

### 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [uni-helper](https://marketplace.visualstudio.com/items?itemName=uni-helper.uni-helper-vscode) 扩展
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展

### 安装依赖

```bash
pnpm install
```

### 环境变量

在 `src/config/` 目录下配置 API 地址。

## 运行项目

### H5 开发模式

```bash
# 标准开发模式
pnpm dev:h5

# Mock 数据模式（无需后端）
pnpm dev:mock
```

访问 http://localhost:5173

### 微信小程序开发模式

```bash
pnpm dev:mp-weixin
```

构建产物输出到 `dist/dev/mp-weixin/`，使用微信开发者工具打开该目录。

### 生产构建

```bash
# H5 构建
pnpm build:h5

# 微信小程序构建
pnpm build:mp-weixin
```

## 测试

### 单元测试

```bash
# 运行全部单元测试
pnpm test

# 运行组件测试
pnpm test:components

# 监视模式
pnpm test:components:watch
```

### E2E 测试

```bash
# 运行 E2E 测试
pnpm test:e2e

# 带 UI 的 E2E 测试
pnpm test:e2e:ui

# 查看测试报告
pnpm test:e2e:report
```

### 性能测试

```bash
pnpm test:perf
```

### 负载测试

```bash
# 启动 Mock API 服务
pnpm load:mock-api

# 运行负载测试
pnpm test:load

# 冒烟测试
pnpm test:load:smoke
```

## Mock 模式

项目内置完整的 Mock 数据服务，无需后端即可进行前端开发：


将`src/mock/mock-adapter.ts`文件当中的export const USE_MOCK = false;代码改为 true 即可绕过后端，启用 mock 服务。

Mock 数据位于 `src/mock/` 目录：
- `data/` - 静态数据（用户、食堂、菜品、评价等）
- `services/` - Mock 服务逻辑

## 类型检查

```bash
pnpm type-check
```

## 代码规范

使用 Prettier 进行代码格式化：

```bash
npx prettier --write "src/**/*.{ts,vue}"
```

## 微信小程序发布

1. 构建生产版本：
   ```bash
   pnpm build:mp-weixin
   ```

2. 使用微信开发者工具打开 `dist/build/mp-weixin/` 目录

3. 点击"上传"发布到微信公众平台

## 注意事项

- 小程序包含 AI 模块，无法以个人主体上线，需使用企业主体
- 测试需使用体验版，并在微信公众平台添加体验成员权限
- 首次登录需同意《用户协议》和《隐私政策》

## 许可证

本项目为私有项目，未经授权不得使用。
