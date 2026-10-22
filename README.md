# 食鉴 - TasteInsight

<p align="center">
  <img src="https://img.shields.io/badge/UniApp-5.26-green" alt="UniApp 编译器">
  <img src="https://img.shields.io/badge/Vue-3-brightgreen" alt="Vue 3">
  <img src="https://img.shields.io/badge/NestJS-11-red" alt="NestJS">
  <img src="https://img.shields.io/badge/PostgreSQL-15-blue" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-red" alt="Redis">
  <img src="https://img.shields.io/badge/TypeScript-3178C6" alt="TypeScript">
</p>

**食鉴（TasteInsight）** 是一个校园食堂菜品点评与智能推荐平台，帮助学生发现美食、分享评价、获取个性化推荐。

## ✨ 功能特性

### 🍜 用户端（微信小程序）
- **菜品浏览** - 按食堂/窗口浏览菜品，支持多维筛选（口味、价格、评分、时段、荤素、标签、忌口）
- **智能搜索** - 搜索食堂或菜品，快速定位美食
- **评价系统** - 发布评价（星级 + 文字 + 图片 + 口味评分）、评论回复、举报
- **收藏管理** - 收藏喜欢的菜品，快速访问
- **菜单规划** - 创建每日/每周用餐计划，跟踪执行
- **AI 聊天** - 智能对话助手，提供菜品推荐、餐单规划建议（流式响应）
- **个性化推荐** - 基于用户偏好和行为的智能推荐
- **用户上传** - 上传新菜品，审核后展示

### 🖥️ 管理端（Web）
- **菜品管理** - 单个添加、批量导入、编辑、删除菜品
- **食堂管理** - 管理食堂、楼层、窗口信息
- **审核系统** - 审核用户上传菜品、评价、评论
- **举报处理** - 处理用户举报内容
- **新闻公告** - 发布食堂公告、活动通知
- **用户管理** - 管理员账号与权限管理
- **系统配置** - 推荐策略、AI 参数等配置
- **操作日志** - 管理员操作记录追踪

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **小程序前端** | UniApp 编译器 5.26 + Vue 3.4.21 + Pinia + TailwindCSS |
| **管理端前端** | Vue 3.5 + Vite 5 + Pinia + TailwindCSS + WangEditor |
| **后端服务** | NestJS 11 + Prisma ORM + JWT + Swagger |
| **数据库** | PostgreSQL 15 + Redis 7 |
| **任务队列** | BullMQ |
| **AI 服务** | OpenAI API + Python 嵌入服务 |
| **对象存储** | 本地文件与通用 S3 多实例存储（AWS、腾讯云 COS、阿里云 OSS） |
| **容器化** | Docker + Docker Compose |

小程序使用 TypeScript 7 检查核心模块，Vue 模板和 Jest 使用官方 TypeScript 6 兼容 API；完整版本与升级约定见[小程序依赖维护](frontend-miniapp/README.md#发布构建与依赖维护)。

## 📁 项目结构

```
TasteInsight/
├── backend/                 # 后端服务（NestJS）
│   ├── src/                 # 源代码
│   ├── prisma/              # 数据库模型与迁移
│   ├── python-embedding-service/  # Python 嵌入服务
│   ├── test/                # E2E 测试
│   └── docker-compose.yml   # Docker 编排
├── frontend-web/            # 管理端前端（Vue 3）
│   ├── src/                 # 源代码
│   ├── e2e/                 # E2E 测试
│   └── tests/               # 单元测试
├── frontend-miniapp/        # 小程序前端（UniApp）
│   ├── src/                 # 源代码
│   ├── e2e/                 # E2E 测试
│   └── load/                # 负载测试
├── docs/                    # 项目文档
│   ├── 后端开发规范文档.md
│   ├── 前端开发规范文档.md
│   ├── 数据库开发规范文档.md
│   └── ...
├── CONTRIBUTING.md          # 贡献指南
├── LICENSE                  # 许可证
└── README.md                # 项目说明
```

## 🚀 快速开始

### 环境要求

- Node.js 22.13+
- pnpm 11.21.0（与各子项目的 `packageManager` 一致）
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose（可选）

本地应用开发、Docker 或独立基础设施，以及完整单机容器部署的配置矩阵见 [环境配置与部署](docs/环境配置与部署.md)。前端开发默认无需环境文件，特殊目标使用 `.env.<mode>.local` 覆盖。

### 1. 克隆项目

```bash
git clone https://github.com/your-org/TasteInsight.git
cd TasteInsight
```

### 2. 启动后端服务

```bash
cd backend

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，默认连接 localhost:5434 的 pgvector PostgreSQL 和
# localhost:6380 的 Redis

# 如需由项目 Docker 提供本地基础设施
docker compose -f docker-compose.local.yml up -d

# 初始化数据库
pnpm exec prisma generate
pnpm exec prisma migrate deploy

# 启动开发服务
pnpm run start:dev
```

后端服务启动在 http://localhost:3001。

开发应用在显式迁移后统一初始化系统模板和首个管理员。完整环境配置及已有数据库的使用方式见 [环境配置与部署](./docs/环境配置与部署.md)。

### 3. 启动管理端前端

另开终端，从仓库根目录执行。

```bash
cd frontend-web

# 安装依赖
pnpm install

# 启动开发服务
pnpm dev
```

管理端访问 http://localhost:5173

### 4. 启动小程序前端

另开终端，从仓库根目录执行。

```bash
cd frontend-miniapp

# 安装依赖
pnpm install

# 微信小程序开发模式
pnpm dev:mp-weixin
```

微信小程序需使用微信开发者工具打开 `dist/dev/mp-weixin/` 目录。

### Docker 一键部署

```bash
cd backend
# 全新部署；已有部署先按环境配置文档迁移原有变量
cp .env.production.example .env.production
# 替换所有占位配置，设置公共 API / 管理站点 origin 和证书目录
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build public-api frontend
docker compose --env-file .env.production run --rm --no-deps nginx nginx -t
docker compose --env-file .env.production up -d --wait --wait-timeout 180 public-api admin-api worker frontend
docker compose --env-file .env.production up -d --no-deps --force-recreate --wait --wait-timeout 60 nginx
```

生产使用同镜像的用户 API、管理 API、worker 与一次性 migrate 作业。`APP_URL` / `ADMIN_APP_URL` 分别配置公共与管理 origin，管理端相对 API 路径保持 `/api/v1`。公共域名仅提供 `/api/v1` 和图片路径，`/`、`/login` 及其他路径返回 404，不跳转管理站点；HTTP 到同一公共 origin 的 HTTPS 跳转仍受支持。已有单进程部署须先按 [环境配置与部署](./docs/环境配置与部署.md) 完成备份及有序切换，保留原项目名、凭据和数据卷。正常启动不要启用 `RUN_SEED`，seed 脚本会删除现有业务数据。

## 🧪 测试

### 后端测试

单元测试、独立 E2E 环境准备和运行命令见 [后端测试说明](./backend/TEST.md)。E2E 准备会重建测试数据，不能使用开发、验收或生产数据库。

### 管理端前端测试

```bash
cd frontend-web

# 单元测试
pnpm test:unit

# E2E 测试
pnpm test:e2e
```

### 小程序前端测试

```bash
cd frontend-miniapp

# 单元测试
pnpm test

# E2E 测试
pnpm test:e2e

# 隔离环境 API 冒烟压测
pnpm test:load:smoke
```

API 压测的负载方案、测试数据和结果判定见 [统一压测说明](./perf/README.md)。

## 📖 文档

详细文档请查看各子项目的 README：

- [后端服务文档](./backend/README.md)
- [管理端前端文档](./frontend-web/README.md)
- [小程序前端文档](./frontend-miniapp/README.md)
- [Python 嵌入服务文档](./backend/python-embedding-service/README.md)

开发规范文档：

- [后端开发规范](./docs/后端开发规范文档.md)
- [前端开发规范](./docs/前端开发规范文档.md)
- [数据库开发规范](./docs/数据库开发规范文档.md)
- [环境配置与部署](./docs/环境配置与部署.md)
- [历史测试报告归档](./docs/archive/test-reports/README.md)


## 📄 许可证

本项目采用 [MIT License](./LICENSE) 许可证。

## 👥 团队

TasteInsight 开发团队

---

<p align="center">Made with ❤️ for campus food lovers</p>
