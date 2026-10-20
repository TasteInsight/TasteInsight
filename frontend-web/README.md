# TasteInsight 管理端 Web 前端

TasteInsight 管理端是基于 **Vue 3** + **Vite** 构建的后台管理系统，为食堂管理员和平台管理员提供菜品、评价、用户等数据的可视化管理界面。

## 技术栈

- **框架**: Vue 3.5 + Composition API
- **构建工具**: Vite 7
- **状态管理**: Pinia 2
- **路由**: Vue Router 4
- **样式**: TailwindCSS 3
- **富文本编辑器**: WangEditor 5
- **HTTP 客户端**: Axios
- **单元测试**: Vitest
- **E2E 测试**: Playwright
- **语言**: TypeScript 5
- **包管理器**: pnpm

## 发布资源与加载

页面按路由加载。新闻富文本编辑器的脚本与样式在打开创建或编辑窗口时加载；列表和预览共用轻量页面代码。编辑器就绪后才允许保存或发布，同一页面会话内再次打开可复用模块缓存。资源加载失败时保留表单并提示先保留填写内容、刷新页面重试。

编辑器依赖固定为 `@wangeditor/editor@5.1.23`。`NewsEditor` 在实例销毁时取消 SDK 排队的选区节流任务，覆盖取消编辑、草稿保存和路由离开。该清理使用 SDK 内部句柄；升级时需核对上游销毁实现，并运行 `e2e/admin-ui-contracts.spec.ts` 中对应的浏览器回归。

Vite 保持默认 500 kB 单块警告。wangEditor 5 的发行模块内置编辑核心、菜单和上传等能力，构建仍可能提示编辑器异步块较大。评估时同时查看进入页面的请求量、首次打开编辑器的等待时间和实际传输压缩；`pnpm build` 输出的 gzip 数值是估算，服务端响应决定线上传输大小。

Docker 静态服务为文本资源启用 gzip，并返回 `Vary: Accept-Encoding`。HTML 使用 `no-store`，带内容哈希的资源使用长期缓存。独立静态托管或 CDN 需配置对应压缩与缓存策略。发布页面的基线和后端承压测试见 [浏览器性能测试](../perf/FRONTEND.md)。

`patches/` 中的 pnpm 补丁为 `@wangeditor/editor-for-vue@5.1.12` 补齐其已有声明文件的 `types` 导出；运行时代码保持上游实现。补丁由锁文件固定，Docker 在安装依赖前复制补丁目录。升级依赖时需检查上游导出是否已修复，并复验类型检查和发布构建。

浏览器兼容性数据由 Autoprefixer / Browserslist 间接使用。可在本目录运行 `pnpm update --no-save caniuse-lite baseline-browser-mapping` 更新锁文件中的数据版本，再验证类型检查、构建和页面回归。

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
├── tailwind.config.ts       # TailwindCSS 配置
├── tsconfig.json            # TypeScript 配置
└── playwright.config.ts     # Playwright 配置
```

## 管理页面样式

子页面使用 `admin-page`、`admin-panel` 和公共 `Header`。基础控件复用 `admin-input`、`admin-textarea`、`admin-label`、`admin-button` 与 `admin-icon-button`；主要、次要和危险操作通过相应按钮样式表达，表格和分页使用紧凑按钮。字段校验、业务状态颜色、宽度和网格由页面保留。

列表复用 `admin-table-scroll` / `admin-table`，长文本审核行使用 `admin-table-top`。空、加载反馈采用 `admin-state`，错误采用 `admin-error` 或 `admin-state-error`。弹窗继续使用 `AdminDialog` 管理焦点和关闭行为，内容采用 `admin-dialog-panel`、`admin-dialog-header`、`admin-dialog-body`、`admin-dialog-footer`；表单内部操作行使用 `admin-actions`。原生控件定义集中在 `src/assets/tailwind.css` 的 `components` 层，页面工具类可覆盖业务状态与尺寸；页面、表格和弹窗布局集中在 `src/assets/admin-layout.css`，业务模块样式负责内容排版。

## 管理范围

人员管理中的范围可选“全局范围”或“指定食堂”。指定食堂支持复选，所有选中食堂共用该账号的操作权限；授权选项受当前账号范围与权限限制。编辑上级账号并缩小授权时，其下级账号的范围和权限会同步收窄。

管理员列表的“不限管理范围”显示全部可见账号；“全局范围”只显示全局账号；具体食堂筛选包含管理该食堂的指定范围账号和全局账号。侧栏与人员列表显示实际授权食堂名称。

系统配置通过“配置范围”切换全局默认值或某个授权食堂的配置。学生认证和社区管理保留全局限制。多食堂账号发布新闻时选择目标食堂，新闻列表默认查询全部授权食堂。

升级范围契约后重新登录管理端。旧格式会话会自动清除；服务端逐次读取当前授权，即使旧页面保留按钮，接口仍按最新范围和权限执行校验。

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
| 学生认证 | `/student-verification-manage` | 资格申请、通过/拒绝、有效期与撤销 |
| 社区管理 | `/community-manage` | 帖子及回复的状态筛选、审核与删除 |
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

### 批量删除与校园审核

菜品、新闻、评价和已加载回复支持当前页多选删除，每批最多 100 条。切换筛选、分页、菜品或账号会清空选择；提交前再次核对权限和页面归属。接口一次提交整批 ID，后端任一目标校验失败则整批回滚，失败时保留当前选择以便重试。

学生认证与社区管理仅对具有相应权限的全局管理员开放。学生申请批准需填写审核依据与有效期；批准、拒绝和撤销使用列表返回的 `updatedAt` 防止旧页面覆盖新申请。校园邮箱控制权与在校资格分开审核。

社区的帖子和回复默认直接发布。系统配置可开启对应人工审核；该设置针对全站生效。用户只能看到自己的未公开内容，管理员审核通过后才公开。

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
| `review:approve` | 审核评价 |
| `review:delete` | 删除评价 |
| `comment:approve` | 审核评论 |
| `comment:delete` | 删除回复 |
| `student:review` | 全局学生资格审核与撤销 |
| `post:view` | 查看社区管理列表 |
| `post:approve` | 审核帖子与帖子回复 |
| `post:delete` | 删除帖子与帖子回复 |
| `report:handle` | 处理举报 |
| `admin:view` | 查看管理员 |
| `log:view` | 查看自己和所有层级下属的操作日志 |
| `admin:create`、`admin:edit`、`admin:delete` | 管理管理员 |
| `news:view` | 查看新闻 |
| `news:create`、`news:edit`、`news:delete` | 管理新闻 |
| `news:publish`、`news:revoke` | 发布与撤销新闻 |
| `config:view` | 查看配置 |
| `config:edit` | 管理配置 |

## 环境准备

### 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展

### 安装依赖

```bash
pnpm install
```

### 环境变量

开发和测试默认请求 `http://localhost:3001`，发布构建默认使用同源 `/api/v1`。默认运行无需创建环境文件。

需要覆盖时，参考 `.env.example`：开发目标写入 `.env.development.local`，发布目标写入 `.env.production.local`；进程环境变量优先。自定义 Vite mode 继续可用。`VITE_*` 会进入浏览器产物，只能填写公开参数。本地开发与服务器部署命令见 [环境配置与部署](../docs/环境配置与部署.md)。

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

开发服务与构建统一使用 [vite.config.ts](./vite.config.ts)。发布目标保留 ES2020、Chrome 87、Edge 88、Firefox 78 和 Safari 14 的语法兼容范围。

### 预览生产构建

```bash
pnpm preview
```

## 测试

历史执行结果保存在 [测试报告归档](../docs/archive/test-reports/README.md)。

### 类型检查

```bash
pnpm type-check
```

使用 Vue 官方 `vue-tsc` 检查业务 TypeScript、Vue 单文件组件中的 TypeScript 与模板、Vite 等工具配置、单元测试和 E2E 测试。根 `tsconfig.json` 统一运行各项目，缓存写入 `node_modules/.tmp`。该命令独立于发布构建和运行测试；提交前依次执行类型检查、代码检查、单元测试及构建。

```bash
pnpm type-check
pnpm lint
pnpm test:unit
pnpm build
```

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

`frontend-web/nginx.conf` 只托管静态文件、处理 Vue Router 回退和缓存；单独运行这个容器不会提供 `/api/v1`。完整生产部署通过配置的 `ADMIN_APP_URL` 访问管理端，网关将同域 `/api/v1` 转发到 `admin-api`；公共 `APP_URL` 的 `/api/v1` 转发到独立的 `public-api`，图片从 `/images/` 提供。公共域名的 `/`、`/login` 和其他路径返回 404，不跳转管理站点。域名变更不需要重建管理端。完整拓扑与 TLS 配置见 [环境配置与部署](../docs/环境配置与部署.md)。

## 代码规范

```bash
# ESLint 检查
pnpm lint

# 自动修复可修复的规则
pnpm lint:fix
```

ESLint 配置使用原生 ESM，支持现有 JavaScript 与 TypeScript Vue 组件。应用检查 Vue/TypeScript 基础规则；测试检查聚焦用例、断言用法与 Playwright 异步调用。代码格式由 Prettier 配置统一。

## 许可证

MIT License

网页在登录、页面导航、令牌刷新和窗口重新获得焦点时同步当前授权。授权变化会更新菜单并清理旧范围的页面缓存。成功、错误与信息通知共用 Vue Sonner；长通知保留关闭操作，确认对话框按请求顺序展示，账号切换会清理待处理提示。

人员管理支持选择新负责人移交下属，可同时停用原负责人。移交保留下属账号、现有授权及原创建记录；接收方的权限与食堂范围须覆盖待移交账号。独立停用入口会引导有下属的账号先完成交接。
