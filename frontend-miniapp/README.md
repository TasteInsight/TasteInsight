# TasteInsight 小程序前端

TasteInsight 小程序是基于 **UniApp** + **Vue 3** 构建的跨平台应用，主要面向微信小程序平台，为校园用户提供食堂菜品浏览、评价、智能推荐和 AI 聊天等功能。

## 技术栈

- **框架**: UniApp Vue 3 编译器 5.26 + Vue 3.4.21
- **构建**: Vite 6.4.5；DCloud 编译器依赖统一锁定为 `3.0.0-5020620260917001`
- **状态管理**: Pinia 2
- **样式**: TailwindCSS + CSS
- **国际化**: Vue I18n
- **Markdown**: markdown-it + markdown-it-cjk-friendly 3.0.0；AI 回复使用原生 rich-text 渲染
- **新闻富文本**: mp-html
- **SSE 解析**: eventsource-parser 4.1.2
- **单元测试**: Jest 29.7 + @vue/test-utils + @vue/vue3-jest 29.2.6
- **E2E 测试**: Playwright
- **负载测试**: k6（统一 API 压测）
- **语言**: TypeScript 7.0.2；Vue SFC 检查使用官方 TypeScript 6.0.2 兼容 API
- **包管理器**: pnpm 11.21.0（由 `packageManager` 固定）

## 发布构建与依赖维护

开发环境使用 Node.js 22.13 及以上版本，与 pnpm 11.21.0 的运行要求一致。`pnpm type-check` 先通过 TypeScript 7 检查独立 TS 模块，再通过 `vue-tsc` 3.3 检查 Vue 模板、脚本及测试。依赖按照 [TypeScript 官方并存方案](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0) 配置：`@typescript/native` 提供 7.0.2 的 `tsc`，`typescript` 别名指向官方 `@typescript/typescript6`，供 Vue 和 Jest 调用 JS 编译器 API。具体依赖版本以 `package.json` 和 `pnpm-lock.yaml` 为准。

`@vue/vue3-jest@29.2.6` 的模板转换误将编译参数包在 `tsconfig` 字段中，导致 TypeScript 6 忽略 CommonJS 配置。`patches/` 中的 pnpm 补丁将已解析的参数直接传给 `transpileModule`。升级转换器时复核上游修复并移除对应补丁。

SSE 事件由 `eventsource-parser` 处理分块边界。AI Markdown 在 `markdown-it` 上注册 `markdown-it-cjk-friendly`，支持中文标点紧邻加粗、斜体分隔符的内容，例如 `**推荐菜品：**根据口味选择`。`jest.config.js` 通过 Babel 转换这些 ESM 依赖；`vite.config.ts` 从 Markdown 依赖所属包解析路径，以支持 pnpm 的依赖布局。升级解析器时同步验证 SSE 分块、停止后重发、中文 Markdown 和三端构建。

Vue I18n 的入口及其依赖由 `vite.config.ts` 从所属包解析，`project-vue-i18n` 在 UniApp 插件之后绑定项目版本，保持各平台使用相同的运行时。`__INTLIFY_JIT_COMPILATION__` 使用 AST 解释文案，适配微信运行环境。升级相关依赖后执行 `pnpm check:mp-runtime` 与三端构建；出现 `handleFlatJson is not a function` 等导出不一致错误时，检查项目与平台插件的实际解析路径及锁文件版本。

`scripts/uni-h5-picker-compat.ts` 适配当前 UniApp 的 H5 picker：重开时恢复已确认值，并按实例取消上一轮关闭延迟；组件卸载时清除定时器。适配设有编译器版本检查。升级 DCloud 依赖时复核该适配和 `uni-h5-picker-compat.spec.ts`，再验证打开、关闭及快速重开的行为。

本地 Mock 路由和夹具仅在 `mock` 模式加载，首个请求等待路由注册完成。H5、小程序和 App 的正式构建使用真实 API，构建器会移除 Mock 路由及其数据依赖。

### 依赖安全维护

Markdown 使用 `markdown-it@14.3.3`，覆盖智能引号、自动链接和多行引用解析的性能修复。AI 回复保留中文标点相邻的强调语法及原生 `rich-text` 渲染。项目移除了源码和脚本中闲置的 `sanitize-html` 依赖。

DCloud 编译器保持 5.26，Vite 使用 6.4.5。`pnpm-workspace.yaml` 将编译器及插件统一解析到该 Vite 版本，并通过 `peerDependencyRules.allowedVersions` 显式记录项目采用的版本；DCloud 插件自身声明的 peer 版本为 5.2.8。调整此组合时，验证 H5 开发服务、微信/H5/App 发布构建、产物 i18n 运行检查，以及 H5 选择器和 AI 流式对话浏览器回归。Vue 运行时与编译器继续保持 3.4.21 配套。

编译器和微信官方扫描器固定的旧依赖通过 pnpm overrides 维护安全版本，涵盖 Babel 7、esbuild、PostCSS、图片解码、压缩包和本地工具依赖。升级父包时核对这些固定项，移除已由上游覆盖的 override。安装继续使用 pnpm 的发布冷静期策略。

在本目录使用官方 npm 审计接口：

```bash
pnpm audit --registry=https://registry.npmjs.org
pnpm audit --prod --registry=https://registry.npmjs.org
```

审计结果需结合依赖来源判断：

| 来源 | 保留的上游依赖与使用范围 |
| --- | --- |
| 微信官方 `miniprogram-ci@2.1.31` | 稳定版仍包含 Babel 6、protobufjs 6、download/decompress 等旧依赖。项目使用 `checkCodeQuality` 分析本地产物；扫描在独立进程中运行，使用占位 AppID 和密钥参数。启用 SDK 上传、远程下载或原生打包前，先升级相关旧依赖并验证接口。 |
| DCloud 编译链 | `phin@2.9.3` 用于构建工具的图片请求，`braces@3.0.3` 用于文件模式匹配；包被归入生产依赖，实际用途属于构建过程。braces 的修复版本以上游实际发布为准。 |
| Vue SSR | `@vue/server-renderer@3.4.21` 跟随框架版本，存在服务端渲染属性相关告警。当前 CI 发布目标为微信小程序、静态 H5 和 App；启用 SSR 服务前先完成配套框架升级及服务端渲染验证。 |



图标字体通过 CSS 相对路径引用，由各平台构建器解析资源地址。应用组件使用普通 CSS。`@dcloudio/uni-ui@1.5.12` 的 `uni-icons` 使用纯 CSS，但上游声明为 SCSS；`patches/` 中的 pnpm 补丁修正该声明，保留字体、条件编译和组件行为。补丁由锁文件固定，升级组件库时复核样式声明并重跑三端构建与图标加载检查。实际引入 SCSS 时仍需评估 UniApp 编译器的 Sass API 兼容性。

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
├── e2e-perf/                # Mock 渲染回归
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
| 登录 | `/pages/login/index` | 手机验证码、各端微信登录、隐私协议、游客浏览 |
| 首页 | `/pages/index/index` | 菜品推荐、多维筛选（口味/价格/评分/时段/荤素/标签/忌口） |
| 搜索 | `/pages/search/index` | 搜索食堂或菜品、上拉加载更多 |
| 食堂详情 | `/pages/canteen/index` | 食堂信息、窗口列表、菜品筛选 |
| 窗口详情 | `/pages/window/index` | 窗口信息、菜品列表 |
| 菜品详情 | `/pages/dish/index` | 评价列表、发布/编辑评价、口味信息、评论回复、收藏、加入规划 |
| 新闻公告 | `/pages/news/index` | 小程序新闻入口；App/H5 从校园页的资讯进入 |
| 菜单规划 | `/pages/planning/index` | 月/周/日/列表切换、逐日完成、新建/编辑/删除 |
| 账号与身份 | `/pages/profile/identity` | 登录方式绑定、校园 OAuth 与邮箱验证 |
| 校园 | `/pages/community/index` | 动态、约饭、资讯三个内容分区（App/H5） |
| 公开主页 | `/pages/profile/public` | 帖子、简介与主动公开的计划（App/H5） |
| 约饭详情 | `/pages/planning/dining` | 具体邀请的申请、接受与取消；列表入口在校园页（App/H5） |
| 消息 | `/pages/notifications/index` | 未读、已读与真实目标跳转 |
| 周推荐 | `/pages/notifications/weekly` | 已保存的本周热门菜品集合 |
| AI 聊天 | `/pages/ai-chat/index` | AI 对话、流式响应、规划卡片应用、历史会话 |
| 个人空间 | `/pages/profile/index` | 简介、自己的动态/评价/计划、收藏与浏览记录、消息与设置入口 |
| 设置 | `/pages/settings/index` | 个人信息、语言、偏好/过敏原、显示/通知设置 |
| 语言 | `/pages/settings/language` | 跟随系统、简体中文、英语 |
| 添加菜品 | `/pages/add-dish/index` | 用户上传菜品（待审核） |
| 彩蛋 | `/pages/easter-egg/index` | 隐藏彩蛋页面 |

### 核心功能

#### 语言切换与内容显示

微信小程序、App 和 H5 共用简体中文与英语。入口为「设置 → 语言」，页面路径为 `/pages/settings/language`，可选跟随系统、简体中文和 English。默认跟随系统：中文系统使用简体中文，其他系统语言使用英语。切换后更新界面、导航和后续请求语言。

选择保存在当前设备的 `tasteinsight.language`，各设备分别设置。请求通过 `Accept-Language` 传递当前语言；AI 的欢迎语、开场建议、追问和后续回答使用请求语言，已有对话保留原文。

菜品名称与描述分别读取 `nameEn`、`descriptionEn`；英语字段为空时，该字段显示中文原文。过敏原按共享词表显示中英文；词表外的自定义输入保留用户文本。语言切换改变显示文字，菜品 ID、过敏原标识和已保存业务数据保持原值。

界面文案位于 `src/i18n/messages/`，导航资源位于 `src/locale/`；新增界面文案同时维护两种语言。菜品显示复用 `src/utils/dish-localization.ts`，过敏原显示与输入复用 `src/utils/allergen-catalog.ts`。内容维护和匹配规则分别见[管理端内容维护](../frontend-web/README.md#中英文内容维护)与[过敏原匹配规则](../backend/README.md#过敏原匹配与存储)。

#### 首页筛选系统
- 口味筛选：辣度、咸度、甜度、油腻度（支持范围选择）
- 价格筛选：预设区间 + 自定义范围
- 评分筛选：预设评分 + 自定义范围
- 时段筛选：早餐、午餐、晚餐、夜宵（多选）
- 荤素筛选：纯素、纯荤、荤素搭配、海鲜（多选）
- 标签筛选：常用标签 + 自定义标签
- 忌口筛选：常见过敏原 + 自定义忌口

#### 营养显示与资料补全

菜品详情、列表及规划卡片按每份显示热量（kcal）和营养素（g）。「设置 → 显示设置」分别控制热量与营养素显示。后台已有数值时才显示对应项；`0` 是有效值，缺失值保持空白。

从菜品详情提交资料补全，可选择需要修改的字段并填写营养、译文等内容，保存后进入审核。新菜品与补全记录统一在「我的上传」查看。待审核或未通过记录可继续修改并重新提交，也可撤回；存在关联子记录时先处理子记录。

本地草稿与未确认提交按账号和目标隔离。网络失败后保留原提交内容与请求标识，重试沿用同一请求；记录版本已变化时先刷新再编辑。审核通过后显示正式菜品的新内容，接口规则见[营养信息与资料贡献](../backend/README.md#营养信息与资料贡献)。

#### 举报与反馈

「设置 → 反馈与举报」提供项目反馈和「我的举报」入口；举报列表与详情分别位于 `/pages/profile/records/my-reports/index`、`/pages/profile/records/my-reports/detail`。举报记录只对提交者开放，处理后可查看结果与时间，并从站内结果通知跳转到对应记录。

原内容被删除后仍保留举报处理记录；内容详情是否可访问取决于其当前状态。举报与公开贡献要求当前学生资格，已提交举报的读取继续按账号归属验证。

#### 评价系统
- 星级评分（1-5 星）
- 口味强度（辣度/甜度/咸度/油腻度）
- 图片上传（最多 3 张）
- 评价草稿本地缓存（24 小时内自动恢复）
- 评论回复
- 举报功能

#### AI 聊天
- 流式响应
- 开场问题建议及基于当前回答、最近对话生成的推荐追问
- 场景切换（随便聊聊/餐单规划/菜品点评）
- 规划卡片展开查看，确认后加入菜单规划
- 历史会话管理
- Markdown 渲染

正文通过 SSE `text_chunk` / `new_block` 流式返回；`message_received` 表示用户消息已入库，`reply_complete` 表示回答已保存且输入框可以继续发送。后续可选的 `suggestions` 事件返回最多三条上下文追问，生成失败不改变已完成回答。追问随对应消息保存在本机对话历史中，点击后沿用当前会话。

主动停止标记为 `stopped`；流正常结束时缺少 `reply_complete`，标记为 `interrupted`；网络异常或模型错误标记为 `failed`。已接收内容保留，重新发送会发起新的请求。HTTP 401 在尚未收到业务事件时可刷新凭据后重试一次；流内模型服务错误显示生成失败。

菜品搜索默认查询在售菜品；明确询问下架内容、查看本人收藏或浏览历史时可展示下架卡片并保留状态标记。AI 的普通推荐继续使用当前在售与个人饮食限制筛选结果。

### 开发测试登录

测试登录默认关闭。开发或 E2E 构建可显式设置 `VITE_ENABLE_TEST_LOGIN=true`，同时开发后端需设置 `NODE_ENV=development` 和 `ENABLE_MOCK_AUTH=true`。登录页显示“开发环境”和“开发测试登录”，使用当前设备的独立测试身份，仍通过真实后端签发 JWT；不跳过业务鉴权。

```bash
VITE_ENABLE_TEST_LOGIN=true pnpm dev:h5
VITE_ENABLE_TEST_LOGIN=true pnpm build:h5 --mode e2e
```

生产或其他发布模式误开该开关会使构建失败。生产后端独立拒绝测试身份，前端开关不授予服务器权限，也不自动授予学生资格。该入口与 `dev:mock` 的本地模拟数据模式分开。H5 使用手机号登录，不调用小程序授权 API；App 使用移动应用微信 code 交换，失败不会回退为测试身份。

### 平台构建与认证

| 能力 | 微信小程序 | Android / iOS / H5 |
| --- | --- | --- |
| 公开菜品、评价与新闻浏览 | 支持游客 | 支持游客 |
| 手机号、校园邮箱 | 按后端能力配置 | 按后端能力配置 |
| 微信登录 | 小程序 AppID | 移动 AppID；H5 不调用原生 SDK |
| 私人计划月/周/日视图、系统消息 | 支持 | 支持 |
| 新增社区、公开社交主页、约饭 | 不编入页面路由与入口 | 支持 |

平台边界由条件编译确定。微信社交功能的主体、类目及资质以[官方服务类目](https://developers.weixin.qq.com/miniprogram/product/material/)为准；系统通知与用户通讯是不同能力，[微信订阅消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)另需模板和用户授权。小程序消息请求使用 `scope=service`，不会跳入未打包的社区页面。

App 微信登录需在 HBuilderX 的 `manifest.json` 模块配置启用 OAuth/微信并填写公开 AppID，iOS Universal Links 与开放平台一致，使用自定义基座或正式包。客户端通过 `onlyAuthorize: true` 获取 code，AppSecret 仅保存在服务端；[DCloud 配置说明](https://uniapp.dcloud.net.cn/tutorial/app-oauth-weixin.html)。校园 OAuth 的 App/小程序流程保留原账号的短期请求，完成外部认证后用一次性确认码回到身份页确认；不从任意外部链接自动绑定账号。

App/H5 主导航为首页、校园、规划、问 AI、我的；校园页内部切换动态、约饭与资讯。小程序保留新闻主入口。消息和账号认证位于个人中心，具体帖子、邀请与公告保留独立详情路由。

发言前引导学生认证，最终权限仍由后端实时决定。帖子图片仅在提交时上传，文字草稿按账号保存。月/周/日与列表共享服务器计划；逐日完成在多端同步，公开主页展示需同时打开个人公开设置与单条计划公开设置。

#### 个人空间

“我的”展示个人简介和自己的内容，App/H5 提供动态、评价与计划选项卡，小程序保留评价与私人计划。收藏与浏览记录为私有入口；账号、饮食偏好、显示、通知和退出登录集中在设置页。

消息与设置并入身份栏，资料菜单集中头像昵称、简介、校园身份与访客预览。发动态入口与内容选项卡同行。个人动态采用两列图文卡片，无图片时使用整行文字记录，不重复展示作者身份；互动和编辑操作保留在动态详情中。

“访客预览”读取公开主页接口，仅展示已公开内容。计划的主页展示开关位于“我的 → 计划”，与单条计划的公开设置分别保存；查看页面不会自动开启任一开关。自己的内容列表与访客预览使用不同的读取范围。

#### 共用界面组件

`UiIcon` 提供同族线性图标，`IconButton` 保留 44px 点击区和无障碍名称。网页键盘操作使用 `useButtonActivation`，避免将 UniApp 的按钮宿主当成原生 HTML 按钮。

整块列表的成功空结果使用 `EmptyState`，保留必要的下一步操作；行内缺省信息和分页末尾提示不增加图标。首次读取、请求失败与成功空结果分别处理。确认框和普通操作菜单使用 UniApp 原生接口，统一默认配色；H5 反馈样式集中在 `styles/feedback.css`。H5 的资料菜单使用同族底部面板，支持键盘选择、焦点圈定、Escape 关闭及焦点归还；App／小程序的资料菜单保留原生接口。

设置子页复用 `pages/settings/components/SettingsPage.vue` 与 `settings-page.css`，统一标题、字体、行距、输入框和按钮。保存栏由 `SettingsPage` 的 `sticky` 布局负责，底部留白包含安全区，内容区与保存栏一起参与页面布局。

可操作列表复用 `styles/list-interaction.css` 的 `list-row-action`；选中态使用 `list-row-selected`，小程序按压态使用 `list-row-pressed`。文字和高亮共享整行容器与内边距。H5 使用原生 `:active`，小程序保留 `hover-class`；键盘操作复用 `useButtonActivation`。页面调整行距或分组时复用公共 CSS 变量。

通知和显示设置保留原生 `switch`，复用 `settings-switch-control`、`settings-switch` 的尺寸与缩放；H5 外观约 36×20px，整行维持可点击范围。选项的勾选图标使用 `UiIcon` 的 `check`，同时保留原生选择语义与 `aria-checked`。确认、取消等原生弹窗动作复用 `common.modal`，中英文按钮均使用微信支持的四字符以内文案。

`pages/settings` 与 `pages/profile/records` 按各自分包配置；上传、举报、收藏、浏览记录共用 `pages/profile/records` 分包。新增入口以 `pages.json` 路径为准，样式或文案复用通过组件、CSS 和语言资源完成。

#### 菜单规划
- 默认安排单日，可展开日期范围安排多日
- 从菜品详情加入这一餐，自动带入当前菜品
- 建议餐次可修改
- 按窗口/搜索选择菜品
- 按日期标记或撤销已吃，完成状态保存到服务器并跨端同步


点击 AI 卡片的确认按钮后，客户端先读取最新菜品，再提交保存。保存成功后更新卡片预览，展示价格、计价单位、上下架及供应变化。读取资料失败时保留原预览并显示提示，最终以保存响应为准。普通规划编辑展示当前菜品与供餐状态；提交成功后刷新详情失败时保留保存结果，重试读取详情即可。

已删除的菜品、无效日期和权限不足会使保存失败。创建规划或修改菜品、日期、餐次时，服务端会针对今天及未来日期校验最新过敏原与忌口，冲突时返回 `DIETARY_CONFLICT`。同食堂与预算约束用于生成建议；确认保存后的变化提示包含预算超限。完整保存规则见[规划生成与确认保存](../backend/README.md#规划生成与确认保存)。

计划日期使用校园时区 `Asia/Shanghai`。更改日期范围会清理范围外的完成记录；有尚未开始的约饭邀请时先取消，再修改日期或餐次。价格比较按分处理，展示时保留原计价单位及变更前后的价格。

### 状态管理模块

| Store | 描述 |
|-------|------|
| `use-user-store` | 用户登录态、Token 管理 |
| `use-canteen-store` | 食堂/窗口数据缓存 |
| `use-dishes-store` | 菜品数据、收藏管理 |
| `use-chat-store` | AI 聊天消息、会话管理 |
| `use-plan-store` | 菜单规划数据 |

记录摘要和完整菜品详情分别读取。收藏、浏览及投稿摘要保留价格、计价单位、供应状态和可用营养字段；需要更多资料时请求详情接口，完整详情缓存只接收完整详情响应。

### 登录会话与本地聊天历史

异步请求和聊天流属于发起时的登录会话。退出或切换账号后，旧操作不能更新当前账号的数据、令牌或请求状态，也不能继续提交后续业务请求。

聊天历史按用户 ID 分区保存在本地，切换账号会清空当前聊天视图并加载对应分区。生成中切换会话会保存已接收的内容并终止原流。旧版 `ai-chat-history` 缓存缺少账号归属，升级后保留原数据但不自动加载或迁入任一账号。

## 环境准备

### 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [uni-helper](https://marketplace.visualstudio.com/items?itemName=uni-helper.uni-helper-vscode) 扩展
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展

### 安装依赖

在 `frontend-miniapp` 目录使用固定版本的 pnpm 安装锁文件中的依赖：

```bash
pnpm install --frozen-lockfile
```

CLI 项目使用 `package.json` 和锁文件中的编译器。HBuilderX 的安装或更新不会替换项目依赖；Android 标准运行基座应与项目编译器保持 5.26 对齐。升级编译器时需同步整组 DCloud 编译器包及配套 Vite、`@dcloudio/types`，单独版本管理的 `@dcloudio/uni-ui` 不使用编译器版本号。

### 环境变量

开发模式默认连接 `http://localhost:3001`，无需配置文件。连接开发服务器或真机联调时，在 `.env.development.local` 设置 `VITE_API_BASE_URL`。发布构建从进程环境或 `.env.production.local` 获取显式 API 地址。

每个前端只维护一份 `.env.example`。Vite 的公共配置、模式配置及 `.local` 覆盖机制保持可用；`VITE_*` 会进入产物，只能填写公开参数。本地应用与基础设施的运行方式见 [环境配置与部署](../docs/环境配置与部署.md)。

## 运行项目

### H5 开发模式

```bash
# 标准开发模式
pnpm dev:h5
```

### 微信小程序开发模式

```bash
pnpm dev:mp-weixin
```

构建产物输出到 `dist/dev/mp-weixin/`，使用微信开发者工具打开该目录。

### 生产构建

```bash
# 首次构建：复制并填写已配置的 HTTPS API 基址，例如 https://domain.example/api/v1
cp .env.example .env.production.local
# 取消注释并填写 VITE_API_BASE_URL

# H5 构建
pnpm build:h5

# 微信小程序构建
pnpm build:mp-weixin

# 验证已有产物的 i18n 初始化与语言切换
pnpm check:mp-runtime

# 重新扫描已有的小程序构建产物
pnpm check:mp-weixin
```

微信小程序正式版要求合法 HTTPS 请求域名。部署时可启用网关 TLS 或由外部反向代理终止 TLS，并在微信平台配置合法请求域名。详见 [环境配置与部署](../docs/环境配置与部署.md)。

`build:mp-weixin` 在编译后执行产物的 i18n 初始化、文案格式化与语言切换检查，再调用微信官方 `miniprogram-ci` 进行代码质量扫描，检查未通过时返回非零退出码。运行时检查使用基础微信接口替身，并禁止从字符串动态生成代码。质量报告保存到 `dist/quality/mp-weixin.json`；此检查仅分析本地产物，无需上传密钥。JS、WXML、WXSS 压缩和组件按需注入由 `src/manifest.json` 统一配置。

`src/static` 存放需原样复制到运行包的资源。字体及其演示文件放在 `src/assets/iconfont`，通过 CSS 引入实际使用的字体；Tailwind 样式放在 `src/styles`。新增资源应按运行时引用方式选择目录，避免将演示页、原始素材或构建输入直接复制到小程序包中。

### Android 本地运行

从 `frontend-miniapp` 目录生成 App 资源：

```bash
# Android 模拟器通过 10.0.2.2 访问宿主机；端口按后端实际监听地址调整
VITE_API_BASE_URL=http://10.0.2.2:3001 pnpm build:app
```

使用 HBuilderX 5.26 导入生成的 `dist/build/app/` 目录，选择“运行到手机或模拟器”的 Android 标准基座。资源目录已由项目 CLI 编译；Android SDK、模拟器与基座是本地运行所需的独立工具。真机联调使用可访问宿主机的局域网地址，设备上的 `localhost` 不指向开发电脑。

Android AI 对话通过 [renderjs](https://uniapp.dcloud.net.cn/tutorial/renderjs.html) 在页面 WebView 中使用 Fetch / ReadableStream 读取增量文本。各端共用 [eventsource-parser](https://github.com/rexxars/eventsource-parser) 解析 SSE，并复用登录刷新和会话取消逻辑。连接及读取闲置超时为 60 秒，每次收到数据后重新计时。HTTP 401 允许刷新凭据后重试一次，其余错误交给页面显示；停止回复会取消请求。此实现随 App 资源构建，无额外原生插件。H5 直接复用同一 Fetch 传输层；iOS 使用原生 XHR，小程序使用 `uni.request` 分块能力。

`build:app` 生成运行资源，不生成独立签名 APK。正式 App 发行还需配置应用标识、签名与原生能力。原生微信登录使用 App OAuth，后端配置 `WECHAT_APP_APPID` / `WECHAT_APP_SECRET`，客户端配置对应开放平台应用和原生登录能力；跨端 UnionID 关联还需 `WECHAT_OPEN_PLATFORM_ID`。正式登录需使用匹配签名的安装包与真实微信账号验收。

## 测试

历史执行结果保存在 [测试报告归档](../docs/archive/test-reports/README.md)。

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

Playwright 默认启动 `e2e` 模式的 H5 开发服务，测试通过 HTTP 拦截提供接口夹具，API 地址固定为 `http://127.0.0.1:4523`。执行前保持 5173 端口空闲。`dev:mock` 使用应用内模拟服务，适合手动演示；HTTP 夹具测试使用 `e2e` 或发布构建。

```bash
# 运行 E2E 测试
pnpm test:e2e

# 带 UI 的 E2E 测试
pnpm test:e2e:ui

# 查看测试报告
pnpm test:e2e:report
```

发布构建回归可复用本地静态预览服务：

```bash
VITE_API_BASE_URL=http://127.0.0.1:4523 pnpm build:h5
# 终端一：启动发布预览
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist/build/h5
# 终端二：使用已有预览运行相同用例
E2E_BASE_URL=http://127.0.0.1:4174 pnpm test:e2e
```

这些用例验证浏览器交互和前端接口契约，真实后端与数据库联调见下方统一浏览器套件。

### 发布页面性能

[统一浏览器套件](../perf/FRONTEND.md) 使用 H5 和管理端发布构建、真实测试后端，以及 k6 业务负载。

```bash
# 自动准备隔离环境，执行基线与承压流程后回收
pnpm test:perf
# 连接已准备的测试部署
pnpm test:perf:remote --env-file /private/path/perf.env
# 开发模式 Mock 渲染回归
pnpm test:perf:mock
```

### API 压测

API 压测统一由仓库根目录的 [perf](../perf/README.md) 提供，使用真实后端和独立测试数据。

```bash
# 创建一次性数据库、缓存和后端，验证全部 API 场景后回收
pnpm test:load:smoke

# 使用已准备的隔离测试部署和私有配置
pnpm test:load --env-file /path/to/perf.env
```

`test:perf:mock` 使用开发服务器与 Mock API，适合前端开发回归。发布性能验收使用 `test:perf`。

## Mock 模式

Mock 模式使用 `src/mock/` 中的本地数据处理已注册接口，适合菜品、食堂、评价等界面的开发。

使用专用开发命令启用，无需修改源码：

```bash
pnpm dev:mock
```

本地 Mock 仅在 Vite `mock` 模式启用，`production`、`development`、`e2e` 等模式均关闭。未注册的接口仍请求 `VITE_API_BASE_URL` 指定的地址，缺省为本地后端；真实登录与后端业务联调应使用开发环境。

Mock 数据位于 `src/mock/` 目录：
- `data/` - 静态数据（用户、食堂、菜品、评价等）
- `services/` - Mock 服务逻辑

## 类型检查

```bash
# TypeScript 7 核心模块检查，以及 Vue 模板、脚本和测试的完整检查
pnpm type-check

# 仅检查独立 TypeScript 模块
pnpm type-check:ts
```

## 代码规范

使用 ESLint 检查 Vue、TypeScript、构建脚本和测试：

```bash
pnpm lint
```

`CI - Frontend` 在同一个 job 中执行管理端与小程序检查。小程序依次运行类型检查、ESLint、Jest 和微信小程序、H5、App 资源构建；构建使用公开的 API 示例地址。

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
- 登录需同意《用户协议》和《隐私政策》
