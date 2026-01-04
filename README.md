# 食鉴 - TasteInsight

<p align="center">
  <img src="https://img.shields.io/badge/UniApp-3.0-green" alt="UniApp">
  <img src="https://img.shields.io/badge/Vue-3.5-brightgreen" alt="Vue 3">
  <img src="https://img.shields.io/badge/NestJS-11-red" alt="NestJS">
  <img src="https://img.shields.io/badge/PostgreSQL-15-blue" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-red" alt="Redis">
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript">
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
| **小程序前端** | UniApp 3.0 + Vue 3.4 + Pinia + TailwindCSS |
| **管理端前端** | Vue 3.5 + Vite 5 + Pinia + TailwindCSS + WangEditor |
| **后端服务** | NestJS 11 + Prisma ORM + JWT + Swagger |
| **数据库** | PostgreSQL 15 + Redis 7 |
| **任务队列** | BullMQ |
| **AI 服务** | OpenAI API + Python 嵌入服务 |
| **对象存储** | 阿里云 OSS |
| **容器化** | Docker + Docker Compose |

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

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose（可选）

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
# 编辑 .env 填写数据库、Redis、微信、OpenAI 等配置

# 初始化数据库
pnpm prisma generate
pnpm prisma migrate deploy

# 启动开发服务
pnpm run start:dev
```

后端服务启动在 http://localhost:3000，Swagger 文档在 http://localhost:3000/api

### 3. 启动管理端前端

```bash
cd frontend-web

# 安装依赖
pnpm install

# 启动开发服务
pnpm dev
```

管理端访问 http://localhost:5173

### 4. 启动小程序前端

```bash
cd frontend-miniapp

# 安装依赖
pnpm install

# H5 开发模式（带 Mock 数据，无需后端）
pnpm dev:mock

# 微信小程序开发模式
pnpm dev:mp-weixin
```

微信小程序需使用微信开发者工具打开 `dist/dev/mp-weixin/` 目录。

### Docker 一键部署

```bash
cd backend
docker-compose up -d
```

## 🧪 测试

### 后端测试

```bash
cd backend

# 单元测试
pnpm run test:unit

# E2E 测试
pnpm run test:setup
pnpm run test:e2e
pnpm run test:teardown
```

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

# 负载测试
pnpm test:load
```

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

## 🤝 贡献

欢迎贡献代码！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献流程。

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 许可证。

## 👥 团队

TasteInsight 开发团队

---

<p align="center">Made with ❤️ for campus food lovers</p>