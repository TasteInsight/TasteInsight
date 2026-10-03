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

### 2. 本地环境变量配置

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

本地后端默认监听 `3001`；`docker-compose.local.yml` 提供端口 `5434` 的 pgvector PostgreSQL 和端口 `6380` 的 Redis，并使用独立的 `tasteinsight-dev` 数据卷。替换 `.env` 中的 `change-me` 值，并使 `DATABASE_URL` 与数据库账号、密码、映射端口一致。已有数据库和 Redis 时，直接填写其连接信息即可。配置项说明见 [环境配置与部署](../docs/环境配置与部署.md)。

启动本地基础设施：

```bash
docker compose -f docker-compose.local.yml up -d
```

### 3. 数据库初始化

```bash
# 生成 Prisma Client
pnpm exec prisma generate

# 运行数据库迁移
pnpm exec prisma migrate deploy
```

`prisma/seed.ts` 和 `prisma/seed_docker.ts` 会先删除现有业务数据，不属于正常初始化步骤。

## 运行项目

### 开发模式

```bash
# 可选：仅在 EXTERNAL_EMBEDDING_SERVICE_ENABLED=true 时另开终端启动
pnpm run start:embedding

pnpm run start:dev
```

服务启动后访问：
- API 服务：http://localhost:3001

### 生产模式

```bash
pnpm run build
pnpm run start:prod
```

### Docker 部署

```bash
# 全新部署创建生产配置；已有部署先按环境配置文档保留原有凭证
cp .env.production.example .env.production

# 构建并启动生产服务（当前为 HTTP 网关）
docker compose --env-file .env.production up -d --build

# 查看日志
docker compose --env-file .env.production logs -f backend nginx
```

Docker 冷启动会自动执行幂等的 `prisma migrate deploy`，并在管理员表为空时创建初始管理员；`RUN_SEED` 和 `IMPORT_DATA` 默认关闭。外部 Python 嵌入默认关闭且不启动，需要时在 `.env.production` 中同时设置 `EXTERNAL_EMBEDDING_SERVICE_ENABLED=true` 和 `COMPOSE_PROFILES=embedding`。Nginx、HTTPS 恢复、自动部署、升级及停止步骤见 [环境配置与部署](../docs/环境配置与部署.md)。

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
# 准备独立测试数据库后，启动 Redis 和模拟嵌入服务并重建测试数据
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
| `DishUpload` | 用户或管理员提交的菜品（待审核） |
| `Review` | 评价 |
| `Comment` | 评论 |
| `Report` | 举报 |
| `MealPlan` | 菜单规划 |
| `News` | 新闻公告 |
| `FavoriteDish` | 收藏菜品 |
| `BrowseHistory` | 浏览历史 |
| `AISession` | AI 会话 |

### 管理员与菜品生命周期

管理员删除会设置 `Admin.deletedAt`，保留操作日志、新闻和创建关系。已删除账号不能登录、刷新令牌或访问管理接口，也不出现在可管理账号列表中；其用户名仍保留。

新建菜品返回待审核的 `DishUpload`，审核通过后通过 `approvedDishId` 关联正式 `Dish`。子菜提交时，`parentDishId` 引用正式主菜，`parentUploadId` 引用待审核主菜，两者不能同时设置。关联待审核主菜的子菜须在主菜通过审核后审批，各条记录分别审核。

主菜撤回或删除时，子审核记录保留对来源审核记录的关联，包括已拒绝的记录。删除正式菜品不删除审核历史。旧版或导入的主菜如果没有来源审核记录且仍被子审核记录引用，需要保留该主菜，可通过下架停止展示。

菜品更新接口中，省略字段表示保持原值，空字符串和空数组表示明确清空。列表的筛选与总数计算在服务端分页前执行。

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
