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

## AI 对话工具

聊天模型根据问题选择工具并组合多轮调用。查询结果与工具错误回传模型；每次回答最多执行 10 轮工具调用，达到上限后生成不再调用工具的总结。

| 工具 | 行为 |
| --- | --- |
| `recommend_dishes` | `scene` 支持 `guess_like`、`today`、`similar`；相似推荐需要真实 `triggerDishId`，`excludeDishIds` 排除替换前的候选。 |
| `get_my_preferences` | 只读取当前用户的饮食偏好和过敏原，不返回账户身份信息。 |
| `update_preferences` | 生成包含实际前后值的 `card_preferences` 确认草稿，不写入数据库。 |
| `create_meal_plan` | 生成计划草稿；默认同一食堂，并校验当前供应、饮食限制及显式整餐预算。 |
| `display_content` | 根据真实数据展示菜品、食堂或计划卡片；计划重校验同样经过工具注册边界。 |

工具注册时编译 JSON Schema，执行前校验必填字段、类型、枚举、数量和值域，不隐式转换参数或接受未知字段。工具定义声明场景权限，模型可见清单与执行权限一致；`dish_critic` 不提供偏好变更和计划草稿工具。

偏好草稿只在用户点击保存后调用既有 `PUT /user/profile` 接口。前端核对最新字段，处理重复点击、失败重试及账户归属；数据库将组合变更作为一个事务保存。拒绝、保存等卡片状态缓存于当前设备的所属账户。单次用餐条件只影响查询，不自动变成长期偏好。

推荐特征缓存用于复用行为聚合；已保存偏好和过敏原实时读取。相似、个性化列表在分页前按当前菜品和饮食限制重新过滤，避免旧缓存覆盖最新设置。

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

`start:prod` 固定 `NODE_ENV=production`，只接受进程环境注入，不读取开发 `.env`。生产必须提供有效的数据库、Redis、微信与公网 URL 配置，并使用至少 32 字节且互不相同的 access/refresh 密钥。完整校验与注入方式见 [环境配置与部署](../docs/环境配置与部署.md)。

### Docker 部署

```bash
# 全新部署创建生产配置；已有部署先按环境配置文档保留原有凭证
cp .env.production.example .env.production

# 构建并启动生产服务（当前为 HTTP 网关）
docker compose --env-file .env.production up -d --build

# 查看日志
docker compose --env-file .env.production logs -f backend nginx
```

Docker 冷启动先生成数据库 URL 并校验配置，通过后执行幂等的 `prisma migrate deploy`，管理员表为空时创建初始管理员。生产禁止开启 `ENABLE_MOCK_AUTH`、`RUN_SEED` 和 `IMPORT_DATA`。外部 Python 嵌入默认关闭且不启动，需要时在 `.env.production` 中同时设置 `EXTERNAL_EMBEDDING_SERVICE_ENABLED=true` 和 `COMPOSE_PROFILES=embedding`。Nginx、HTTPS 恢复、自动部署、升级及停止步骤见 [环境配置与部署](../docs/环境配置与部署.md)。

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

### 评价与回复审核

评价和回复默认直接通过。管理台的“人工审核”开关开启时，后端对应的 `review.autoApprove` 或 `comment.autoApprove` 为 `false`。配置优先级为食堂配置、全局配置、模板默认值；升级默认值不会覆盖显式配置，也不会批量通过已有待审内容。菜品投稿审核保持独立。

已通过且未删除的内容对所有登录用户可见。待审核或未通过的内容仅作者和有相应权限的管理员可见，待审评价不计入公开评分。本人评价通过 `GET /dishes/:dishId/reviews/mine` 读取；回复列表按当前用户过滤，并返回每条回复的 `status` 和父评价的 `canReply`。未公开评价及未通过审核的回复不能作为新回复目标。

用户端提交后展示本人内容，编辑框关闭或输入清空作为成功反馈。审核状态在管理端展示，服务端据此控制公开可见性。

评价审核请求必须携带列表返回的 `updatedAt`：通过请求为 `{ "expectedUpdatedAt": "ISO 时间" }`，拒绝请求还需 `reason`。审核原子校验内容快照、待审状态、删除状态和管理员食堂范围；内容更新后旧快照返回 `409`，需要重新读取后审核。

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
