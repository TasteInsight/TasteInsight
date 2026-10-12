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
│   ├── auth/                # 账号、手机号和各端微信身份
│   ├── campus-identity/     # 校园资格验证与审核
│   ├── canteens/            # 食堂接口（用户端）
│   ├── comments/            # 评论接口
│   ├── common/              # 公共模块（装饰器、守卫等）
│   ├── dish-review-stats-queue/ # 菜品评价统计队列
│   ├── dish-sync-queue/     # 菜品同步队列
│   ├── dishes/              # 菜品接口（用户端）
│   ├── embedding-queue/     # 嵌入向量生成队列
│   ├── meal-plans/          # 菜单规划接口
│   ├── news/                # 新闻公告接口
│   ├── notifications/       # 站内消息、通知生成与外推投递
│   ├── social/              # 社区帖子、回复、点赞与审核
│   ├── recommendation/      # 智能推荐接口
│   ├── reviews/             # 评价接口
│   ├── upload/              # 文件上传服务
│   ├── user-profile/        # 用户信息接口
│   ├── app.module.ts        # 开发与集成测试的组合模块
│   ├── main.ts              # 开发入口
│   ├── main.public.ts       # 生产用户 API
│   ├── main.admin.ts        # 生产管理 API
│   ├── main.worker.ts       # 后台队列与调度
│   ├── main.migrate.ts      # 迁移与首次初始化
│   └── prisma.service.ts    # Prisma 数据库服务
├── prisma/
│   ├── schema.prisma        # 数据库模型定义
│   ├── seed.ts              # 数据库种子脚本
│   └── migrations/          # 数据库迁移文件
├── python-embedding-service/ # Python 嵌入服务
├── test/                    # E2E 测试
├── scripts/                 # 辅助脚本
├── docker-compose.local.yml # 本地数据库与 Redis
├── docker-compose.yml       # 生产 Docker 编排
├── nginx.https.conf.template # HTTPS 网关入口模板
└── Dockerfile               # Docker 构建文件
```

## 核心功能模块

### 用户端 API

| 模块 | 描述 |
|------|------|
| `auth` | 手机验证码、微信小程序/移动应用登录、身份绑定、Token 刷新 |
| `campus-identity` | 校园 OAuth、校园邮箱验证、学生资格审核与有效期 |
| `canteens` | 食堂列表、食堂详情、窗口信息 |
| `dishes` | 菜品列表、详情、搜索、筛选、收藏 |
| `reviews` | 发布评价、编辑评价、删除评价、评分统计 |
| `comments` | 评论回复、删除评论 |
| `meal-plans` | 日期筛选、逐日完成、计划公开设置、约饭邀请与申请 |
| `social` | 独立帖子与回复、公开个人主页、幂等点赞、举报与审核 |
| `notifications` | 消息列表、未读数、已读、每周热门菜品、持久投递 |
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
| `admin-news` | 新闻公告管理（富文本编辑）、批量删除 |
| `admin/student-verifications` | 全局管理员审核、拒绝或撤销学生资格 |
| `admin/posts`、`admin/post-comments` | 帖子与回复列表、审核和删除 |
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

开发 `AppModule` 在启动时通过 `DatabaseInitializer` 同步系统模板、按需创建首个管理员并准备向量索引；schema 迁移须在启动前显式执行。已有管理员凭据与显式配置保持不变，模板默认值不会自动写成全局配置。

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
# 先运行一次迁移 / 初始化，再分别由服务管理器启动三个角色
NODE_ENV=production node dist/src/main.migrate
NODE_ENV=production node dist/src/main.public
# 其他进程同样注入 production：node dist/src/main.admin、node dist/src/main.worker
```

生产进程需要显式注入 `NODE_ENV=production`、`DATABASE_URL` 及自身角色的环境配置，不读取开发 `.env`。公共 API、管理 API 和 worker 分别运行，使用共享 schema；`main.migrate` 统一执行迁移和首次初始化。两个 API 需要 Redis、公共 `APP_URL`，以及至少 32 字节且互不相同的 access/refresh 密钥；完整 Compose / 网关部署还要求管理 `ADMIN_APP_URL`。用户身份渠道与 AI 配置仅供公共 API 使用。worker 需要 Redis，但不要求 JWT 或 origin；迁移只需要数据库和可选首次管理员凭据。每个应用根模块在 provider 初始化前完成角色配置校验。完整说明见 [环境配置与部署](../docs/环境配置与部署.md)。

### Docker 部署

```bash
# 全新部署创建生产配置；已有部署先按环境配置文档保留原有凭证
cp .env.production.example .env.production

# 设置 APP_URL、ADMIN_APP_URL 和 TLS 配置后构建、校验并启动
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build public-api frontend
docker compose --env-file .env.production run --rm --no-deps nginx nginx -t
docker compose --env-file .env.production up -d --wait --wait-timeout 180 public-api admin-api worker frontend
docker compose --env-file .env.production up -d --no-deps --force-recreate --wait --wait-timeout 60 nginx

# 查看日志
docker compose --env-file .env.production logs -f public-api admin-api worker nginx
```

Compose 从 `--env-file` 选取配置并按角色注入，未设置的可选字段保持缺省，不整份加载配置文件。模板区分必填项、首次管理员、可选集成与默认调优项；新建管理员时启用并填写 `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD`。Docker 入口生成数据库 URL，各应用根模块校验配置；一次性 `migrate` 作业只等待 PostgreSQL，执行迁移与初始化后才启动三个常驻角色。已有管理员和业务数据保持不变，API / worker 重启不执行初始化。所有生产角色禁止开启 `ENABLE_MOCK_AUTH`、`RUN_SEED` 和 `IMPORT_DATA`。外部 Python 嵌入默认关闭，需要时同时设置 `EXTERNAL_EMBEDDING_SERVICE_ENABLED=true` 和 `COMPOSE_PROFILES=embedding`。已有单进程部署、TLS、数据保留与回滚步骤见 [环境配置与部署](../docs/环境配置与部署.md)。

公共 `APP_URL` 仅提供 `/api/v1` 和 `/images/`，其他路径（包括 `/`、`/login`）返回 404，不跳转到管理站点。管理端通过独立的 `ADMIN_APP_URL` 访问；公共域名的 HTTP 到同一 origin 的 HTTPS 跳转保持可用。

## 测试

单元测试、独立 E2E 环境准备、单套件运行和数据隔离要求见 [测试说明](./TEST.md)。单元测试使用 Mock，不要求数据库；E2E 准备会重建指定的独立测试数据库。

既有执行结果与早期菜品 API 测试说明保存在 [历史测试报告归档](../docs/archive/test-reports/README.md)。

## 数据库模型

主要数据模型：

| 模型 | 描述 |
|------|------|
| `User` | 跨平台账号；内部 ID 为数据归属依据 |
| `UserIdentity` | 经验证的手机号、AppID 范围 OpenID 与开放平台范围 UnionID |
| `StudentVerification` | 当前校园资格、证据来源、有效期和审核信息 |
| `VerificationChallenge`、`CampusOAuthAttempt` | 短效验证挑战与一次性认证流程 |
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

已通过且未删除的内容可供游客浏览。待审核或未通过的内容仅作者和有相应权限的管理员可见，待审评价不计入公开评分。本人评价通过 `GET /dishes/:dishId/reviews/mine` 读取；回复列表按当前用户过滤，并返回每条回复的 `status` 和父评价的 `canReply`。未公开评价及未通过审核的回复不能作为新回复目标。公开发言、发帖、点赞与举报需要当前有效的学生资格；作者仍可撤回自己的历史内容。

### 账号与校园认证

`GET /auth/capabilities` 返回当前可用登录和认证方式。小程序使用 `WECHAT_APPID/WECHAT_SECRET`，Android/iOS 使用 `WECHAT_APP_APPID/WECHAT_APP_SECRET`，两类 OpenID 分别绑定到其 AppID。`WECHAT_OPEN_PLATFORM_ID` 定义共享 UnionID 的开放平台主体。凭据冲突返回 409，不自动合并账号。

手机号按 E.164 传入，例如 `+8613812345678`。`POST /auth/phone/challenges` 发码，`POST /auth/phone/login` 使用 `challengeId/code` 登录。验证码摘要、发送间隔、目标/IP 频率、尝试次数和一次性消费均在服务端执行。`SMS_GATEWAY_URL/TOKEN` 对接 HTTPS 短信网关：请求 `{to,code,expiresIn,purpose}`，带 Bearer 授权与 `Idempotency-Key`，成功响应须含 `messageId`。邮件通过 `RESEND_API_KEY/EMAIL_FROM` 发出；`CAMPUS_EMAIL_DOMAINS` 是准确域名列表，邮箱验证后进入资格审核，不凭域名直接授予学生权限。

校园 OAuth 使用显式配置的授权、令牌、用户信息端点及客户端凭据。`CAMPUS_OAUTH_STUDENT_CLAIM/STUDENT_VALUES` 仅映射校方可信的当前在读属性；缺少该属性时保留人工审核。清华统一身份平台的正式端点、客户端注册、scope 和属性映射应以学校提供的接入材料为准，不使用第三方系统的 AppID。应用不接收校园密码。

OAuth 回调只保存临时证明。原账号还需通过原客户端持有的认证请求和回调页生成的短效确认码完成绑定；确认码不通过状态查询返回。资格写入、一次性消费和过期审核版本检查处于同一事务。校园邮箱审核与撤销需 `student:review` 和全局管理范围；批准必须提供有效期，最长 366 天。权限由服务端实时检查，过期或撤销后已有 access token 也不能继续公开贡献。

反向代理后的验证码 IP 限流需配置 `TRUSTED_PROXY_CIDRS`，仅信任实际代理地址或网段。校园回调 location 不记录带授权码的查询日志。

### 社区、日历与消息

帖子与菜品评价使用独立模型。`post.autoApprove`、`postComment.autoApprove` 默认开启；关闭后作者可见自己的内容，管理员通过后公开。公开主页只投影昵称、头像、已认证身份标识、简介与公开帖子数量，不返回登录身份、认证证据或饮食偏好。

计划日期按校园时区 `Asia/Shanghai` 处理；列表日期过滤为闭区间重叠。完成状态按计划与日期保存，不允许将未来日期标记为已吃。公开计划同时要求有效学生身份、`settings.showMealPlans=true` 和该计划 `isPublic=true`；默认均不公开。约饭邀请单独发布，只公开选定用餐时间、食堂与名额，接受申请在邀请行锁内核对剩余名额。

通知与互动事务同步落库；取消点赞、隐藏或删除内容会撤回关联通知。消息列表、未读数、已读操作均限定当前账号，`scope=service` 只保留菜品、评价和推荐类消息。新品与价格变动生成持久 campaign，每次限量处理收件人并保存进度；周推荐保存真实菜品集合，详情读取时过滤已下架菜品。

配置 `NOTIFICATION_WEBHOOK_URL/SECRET` 可启用外推。网关收到 `eventId/recipientId/type/actor/target/createdAt`，须按 `Idempotency-Key` 去重，并校验原始请求体的 `X-TasteInsight-Signature`（`sha256=` + HMAC-SHA256）。生产使用 HTTPS。数据库 outbox 保存租约、重试及失败状态，投递前重新检查偏好和内容可见性；原生推送或微信订阅的目标映射、模板和用户授权由所接消息网关执行。

### 批量删除

`POST /admin/{dishes|news|reviews|comments}/batch-delete` 接收 `{ids}`，每次 1–100 个唯一 ID。校验任一目标不存在、超出食堂权限或不符合删除规则时整批回滚。菜品与新闻硬删除，评价与回复软删除；菜品上传审核历史保留，评价统计和通知撤回同步处理。权限沿用对应的 `*:delete`，审计记录包含整批 ID。

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
pnpm run lint:check

# TypeScript 检查（包含测试文件）
pnpm run type-check

# 格式检查
pnpm run format:check

# 自动修复可修复的 ESLint 问题
pnpm run lint
```
