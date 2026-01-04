# TasteInsight 后端服务

TasteInsight 后端服务是基于 **NestJS** 框架构建的 RESTful API 服务，为校园食堂菜品点评平台提供完整的业务逻辑支持。

## 技术栈

- **运行时**: Node.js
- **框架**: NestJS 11
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis + BullMQ 任务队列
- **认证**: JWT (JSON Web Token)
- **文档**: Swagger / OpenAPI
- **AI 服务**: OpenAI API + Python 嵌入服务
- **对象存储**: 阿里云 OSS
- **包管理器**: pnpm

## 项目结构

```
backend/
├── src/
│   ├── admin-admins/        # 管理员账号管理
│   ├── admin-canteens/      # 食堂管理（管理端）
│   ├── admin-comments/      # 评论审核（管理端）
│   ├── admin-config/        # 系统配置管理
│   ├── admin-dishes/        # 菜品管理（管理端）
│   ├── admin-news/          # 新闻公告管理
│   ├── admin-recommendation/# 推荐系统管理
│   ├── admin-reports/       # 举报管理
│   ├── admin-reviews/       # 评价审核（管理端）
│   ├── admin-uploads/       # 用户上传菜品审核
│   ├── admin-windows/       # 窗口管理（管理端）
│   ├── ai-chat/             # AI 聊天服务
│   ├── auth/                # 用户认证（微信登录）
│   ├── canteens/            # 食堂接口（用户端）
│   ├── comments/            # 评论接口
│   ├── common/              # 公共模块（装饰器、守卫等）
│   ├── dish-review-stats-queue/ # 菜品评价统计队列
│   ├── dish-sync-queue/     # 菜品同步队列
│   ├── dishes/              # 菜品接口（用户端）
│   ├── embedding-queue/     # 嵌入向量生成队列
│   ├── meal-plans/          # 菜单规划接口
│   ├── news/                # 新闻公告接口
│   ├── recommendation/      # 智能推荐接口
│   ├── reviews/             # 评价接口
│   ├── upload/              # 文件上传服务
│   ├── user-profile/        # 用户信息接口
│   ├── app.module.ts        # 应用主模块
│   ├── main.ts              # 应用入口
│   └── prisma.service.ts    # Prisma 数据库服务
├── prisma/
│   ├── schema.prisma        # 数据库模型定义
│   ├── seed.ts              # 数据库种子脚本
│   └── migrations/          # 数据库迁移文件
├── python-embedding-service/ # Python 嵌入服务
├── test/                    # E2E 测试
├── scripts/                 # 辅助脚本
├── docker-compose.yml       # Docker 编排文件
└── Dockerfile               # Docker 构建文件
```

## 核心功能模块

### 用户端 API

| 模块 | 描述 |
|------|------|
| `auth` | 微信小程序授权登录、Token 刷新 |
| `canteens` | 食堂列表、食堂详情、窗口信息 |
| `dishes` | 菜品列表、详情、搜索、筛选、收藏 |
| `reviews` | 发布评价、编辑评价、删除评价、评分统计 |
| `comments` | 评论回复、删除评论 |
| `meal-plans` | 菜单规划增删改查、执行规划 |
| `news` | 新闻公告列表、详情 |
| `user-profile` | 用户信息、偏好设置、浏览历史 |
| `recommendation` | 个性化菜品推荐 |
| `ai-chat` | AI 聊天（流式响应）、会话管理 |
| `upload` | 图片上传（本地存储 / 阿里云 OSS） |

### 管理端 API

| 模块 | 描述 |
|------|------|
| `admin-admins` | 管理员账号增删改查、权限管理 |
| `admin-canteens` | 食堂增删改查 |
| `admin-windows` | 窗口增删改查 |
| `admin-dishes` | 菜品增删改查、批量导入、状态管理 |
| `admin-reviews` | 评价审核、批量操作 |
| `admin-comments` | 评论审核、批量操作 |
| `admin-reports` | 举报处理 |
| `admin-uploads` | 用户上传菜品审核 |
| `admin-news` | 新闻公告管理（富文本编辑） |
| `admin-config` | 系统配置（推荐策略、AI 参数等） |
| `admin-recommendation` | 推荐系统配置与管理 |

### 后台任务队列

| 队列 | 描述 |
|------|------|
| `dish-review-stats-queue` | 异步更新菜品评分统计 |
| `dish-sync-queue` | 菜品数据同步处理 |
| `embedding-queue` | 菜品嵌入向量生成（调用 Python 服务） |

## 环境准备

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境变量配置

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

主要配置项：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/tasteinsight"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=tasteinsight
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d

# 微信小程序
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret

# AI 服务
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# 嵌入服务
EXTERNAL_EMBEDDING_SERVICE_URL=http://localhost:5001

# 阿里云 OSS（可选）
ALIYUN_OSS_ACCESS_KEY_ID=
ALIYUN_OSS_ACCESS_KEY_SECRET=
ALIYUN_OSS_BUCKET=
ALIYUN_OSS_REGION=
```

### 3. 数据库初始化

```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy

# 填充种子数据（可选）
pnpm ts-node prisma/seed.ts
```

## 运行项目

### 开发模式

```bash
pnpm run start:dev
```

服务启动后访问：
- API 服务：http://localhost:3000

### 生产模式

```bash
pnpm run build
pnpm run start:prod
```

### Docker 部署

```bash
# 构建并启动所有服务（后端、数据库、Redis、嵌入服务）
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

## 测试

### 单元测试

```bash
# 运行全部单元测试
pnpm run test:unit

# 运行指定模块测试
pnpm run test:unit:canteens
pnpm run test:unit:reviews
pnpm run test:unit:ai-chat
```

### E2E 测试

```bash
# 准备测试环境（启动测试数据库、Redis、嵌入服务）
pnpm run test:setup

# 运行全部 E2E 测试
pnpm run test:e2e

# 运行指定模块 E2E 测试
pnpm run test:e2e:auth
pnpm run test:e2e:dishes
pnpm run test:e2e:ai-chat

# 清理测试环境
pnpm run test:teardown
```

### 测试覆盖率

```bash
# 单元测试覆盖率
pnpm run test:cov

# E2E 测试覆盖率
pnpm run test:e2e:cov
```

## 数据库模型

主要数据模型：

| 模型 | 描述 |
|------|------|
| `User` | 小程序用户（微信 OpenID 绑定） |
| `UserPreference` | 用户偏好（口味、价格、忌口等） |
| `UserSetting` | 用户设置（通知、显示等） |
| `Admin` | 管理员账号 |
| `AdminPermission` | 管理员权限 |
| `OperationLog` | 操作日志 |
| `Canteen` | 食堂 |
| `Floor` | 楼层 |
| `Window` | 窗口 |
| `Dish` | 菜品 |
| `DishUpload` | 用户上传菜品（待审核） |
| `Review` | 评价 |
| `Comment` | 评论 |
| `Report` | 举报 |
| `MealPlan` | 菜单规划 |
| `News` | 新闻公告 |
| `FavoriteDish` | 收藏菜品 |
| `BrowseHistory` | 浏览历史 |
| `AISession` | AI 会话 |

## Python 嵌入服务

后端包含一个独立的 Python 嵌入服务 (`python-embedding-service/`)，用于生成菜品的语义嵌入向量，支持智能推荐。

详见 [python-embedding-service/README.md](./python-embedding-service/README.md)

## 代码规范

```bash
# 代码格式化
pnpm run format

# ESLint 检查
pnpm run lint
```
