# TasteInsight 管理端 Web 前端

TasteInsight 管理端是基于 **Vue 3** + **Vite** 构建的后台管理系统，为食堂管理员和平台管理员提供菜品、评价、用户等数据的可视化管理界面。

## 技术栈

- **框架**: Vue 3.5 + Composition API
- **构建工具**: Vite 5
- **状态管理**: Pinia 2
- **路由**: Vue Router 4
- **样式**: TailwindCSS 3
- **富文本编辑器**: WangEditor 5
- **HTTP 客户端**: Axios
- **单元测试**: Vitest
- **E2E 测试**: Playwright
- **语言**: TypeScript 5
- **包管理器**: pnpm

## 项目结构

```
frontend-web/
├── src/
│   ├── api/                 # API 接口封装
│   ├── assets/              # 静态资源
│   ├── components/          # 公共组件
│   │   └── Layout/          # 布局组件
│   ├── composables/         # 组合式函数
│   ├── config/              # 配置文件
│   ├── directives/          # 自定义指令
│   ├── router/              # 路由配置
│   │   ├── index.ts         # 路由定义
│   │   └── access.ts        # 权限控制
│   ├── store/               # Pinia 状态管理
│   │   └── modules/         # 状态模块
│   ├── types/               # TypeScript 类型定义
│   ├── utils/               # 工具函数
│   ├── views/               # 页面视图
│   ├── App.vue              # 根组件
│   └── main.ts              # 应用入口
├── public/                  # 公共静态资源
├── tests/                   # 测试文件
├── e2e/                     # E2E 测试
├── index.html               # HTML 入口
├── vite.config.ts           # Vite 配置
├── tailwind.config.js       # TailwindCSS 配置
├── tsconfig.json            # TypeScript 配置
└── playwright.config.ts     # Playwright 配置
```

## 功能模块

| 页面 | 路由 | 功能描述 |
|------|------|----------|
| 登录 | `/login` | 管理员账号密码登录 |
| 单个添加菜品 | `/single-add` | 手动添加单个菜品 |
| 批量导入菜品 | `/batch-add` | Excel 批量导入菜品 |
| 修改菜品 | `/modify-dish` | 菜品列表管理与编辑 |
| 编辑菜品 | `/edit-dish/:id` | 编辑指定菜品详情 |
| 添加子品类 | `/add-sub-dish` | 为正式或待审父菜品提交规格/子品类 |
| 查看菜品详情 | `/view-dish/:id` | 查看菜品完整信息 |
| 添加食堂 | `/add-canteen` | 新增食堂及窗口 |
| 审核菜品 | `/review-dish` | 审核用户和管理员提交的菜品 |
| 审核菜品详情 | `/review-dish/:id` | 查看待审核菜品详情 |
| 评价管理 | `/review-manage` | 管理用户评价 |
| 评论管理 | `/comment-manage` | 管理评论内容 |
| 举报管理 | `/report-manage` | 处理用户举报 |
| 用户管理 | `/user-manage` | 管理员账号管理 |
| 新闻管理 | `/news-manage` | 新闻公告发布与编辑 |
| 配置管理 | `/config-manage` | 系统配置（推荐策略等） |
| 实验管理 | `/experiment-manage` | A/B 测试与实验管理 |
| 操作日志 | `/log-view` | 查看管理员操作日志 |

### 菜品提交与审批

单个添加和子品类添加创建待审上传记录，提交成功不会直接生成正式菜品。新建父项时，首次进入子项详情会先提交父项，并通过 `parentUploadId` 关联待审子项；从正式菜品编辑页添加的子项使用 `parentDishId`。

审批顺序为父项在先、子项在后。父项批准后生成正式菜品，子项批准时将待审父项关联解析为正式父菜品 id。提交子项不会自动批准任何记录，也不会提前修改正式菜品的子项列表。

### 列表筛选

新闻支持标题、发布食堂、全校公告及开始/结束时间筛选；已发布新闻按发布时间筛选，草稿按创建时间筛选。菜品审核支持名称关键词、食堂和审核状态筛选。所有筛选在服务端分页前执行，总记录数对应当前筛选条件；更改条件会返回第一页。食堂管理员仅查看所属食堂范围。

## 权限控制

系统采用基于权限点的访问控制：

| 权限标识 | 描述 |
|----------|------|
| `dish:view` | 查看菜品 |
| `dish:create` | 创建菜品 |
| `dish:edit` | 编辑菜品 |
| `dish:delete` | 删除菜品 |
| `canteen:create` | 创建食堂/窗口 |
| `upload:approve` | 审核用户上传 |
| `review:view` | 查看评价 |
| `review:approve` | 审核评价 |
| `comment:view` | 查看评论 |
| `comment:approve` | 审核评论 |
| `report:view` | 查看举报 |
| `report:handle` | 处理举报 |
| `admin:view` | 查看管理员 |
| `admin:manage` | 管理管理员 |
| `news:view` | 查看新闻 |
| `news:manage` | 管理新闻 |
| `config:view` | 查看配置 |
| `config:manage` | 管理配置 |
| `log:view` | 查看日志 |

## 环境准备

### 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展

### 安装依赖

```bash
pnpm install
```

### 环境变量

项目提交了按 Vite 模式加载的公开配置：

- `.env.development`：`http://localhost:3001`
- `.env.production`：`/api/v1`，通过 Docker 公网网关同源访问
- `.env.test`：单元测试地址

仅在需要机器专属覆盖时创建被 Git 忽略的 `.env.development.local`。`VITE_*` 会进入浏览器产物，不能存放密码或密钥。

## 运行项目

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:5173

### 生产构建

```bash
pnpm build
```

构建产物输出到 `dist/` 目录。

### 预览生产构建

```bash
pnpm preview
```

## 测试

### 单元测试

```bash
# 运行单元测试
pnpm test:unit

# 带覆盖率的单元测试
pnpm test:unit:coverage

# 测试 UI 界面
pnpm test:ui
```

### E2E 测试

```bash
# 安装浏览器（首次运行）
npx playwright install

# 运行 E2E 测试
pnpm test:e2e

# 带 UI 的 E2E 测试
pnpm test:e2e:ui

# 有头模式运行
pnpm test:e2e:headed

# 调试模式
pnpm test:e2e:debug
```

## Docker 部署

```bash
# 构建镜像
docker build -t tasteinsight-frontend-web .

# 运行容器
docker run -d -p 80:80 tasteinsight-frontend-web
```

`frontend-web/nginx.conf` 只托管静态文件、处理 Vue Router 回退和缓存。生产 API 代理由 `backend/nginx.conf` 负责；单独运行这个容器不会提供 `/api/v1`。完整拓扑见 [环境配置与部署](../docs/环境配置与部署.md)。

## 代码规范

```bash
# ESLint 检查与修复
pnpm lint
```

## 许可证

MIT License
