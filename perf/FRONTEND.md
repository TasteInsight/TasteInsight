# 发布构建浏览器性能测试

本套件使用 Playwright 驱动 Chromium，使用 web-vitals 采集页面指标，使用 k6 对真实测试后端施加业务负载。H5 客户端和管理端均从 production 构建产物启动；每轮构建一次，基线与承压阶段复用相同文件。

## 本地运行

在仓库根目录安装锁定依赖，确保 Docker 已启动，k6 可执行文件位于 PATH：

```bash
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend-miniapp install --frozen-lockfile
pnpm --dir frontend-web install --frozen-lockfile
pnpm --dir perf install --frozen-lockfile
pnpm --dir perf exec playwright install chromium

# 完整模式：先测基线，再启动 k6 并测相同用户流程
node perf/frontend-local.mjs

# 只测真实后端上的发布页面基线
FRONTEND_MODE=baseline node perf/frontend-local.mjs

# 自定义固定负载和重复样本
FRONTEND_SAMPLES=3 RATE=4 MAX_VUS=6 DURATION=90s node perf/frontend-local.mjs
```

本地入口自动创建一次性 PostgreSQL、Redis 和 public/admin/worker 后端，执行数据库迁移，准备独立测试账号和数据，结束后校验数据清理并回收资源。后端与前端均使用 production 运行/构建模式，测试身份使用本轮签发的真实令牌；运行模式与 Git 分支名称独立。

客户端通过已认证会话开始操作，覆盖真实权限和业务接口。管理端登录场景使用表单和真实密码；其他管理场景通过真实登录接口准备会话。短信、微信等外部身份提供商另行验收。

## 自己部署的隔离测试后端

部署 public/admin/worker，连接专用空数据库和独立 Redis。测试部署保持 `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` 未配置，数据准备由 fixture 命令完成。迁移只创建表结构与系统模板；准备前保持用户、管理员和食堂表为空，seed 会填充这些表，因此使用未执行 seed 的专用库。已初始化业务账号的部署应另建专用空库。数据库名使用 `tasteinsight_perf_<16位十六进制>`；详细准备条件见 [API 压测](README.md)。真实测试部署可位于开发、预发布或专用性能环境，硬件和数据规模决定结果的适用范围。

复制 `perf/.env.example` 为私有配置，并填写：

```dotenv
PROFILE=load
FRONTEND_MODE=hybrid
FRONTEND_SAMPLES=3
RATE=2
MAX_VUS=10
DURATION=3m
PUBLIC_BASE_URL=https://api.example.invalid/api/v1
ADMIN_BASE_URL=https://admin.example.invalid/api/v1
FIXTURES_FILE=results/browser-fixtures.json
FIXTURE_DATABASE_URL=postgresql://perf:replace-me@localhost:5432/tasteinsight_perf_0123456789abcdef
FIXTURE_JWT_SECRET=replace-with-test-backend-secret
FIXTURE_JWT_REFRESH_SECRET=replace-with-test-backend-refresh-secret
```

准备阶段需额外创建一个浏览器专属账号组。例如 k6 使用 10 个 VU，准备 11 组：

```bash
MAX_VUS=11 node perf/fixtures-cli.mjs prepare --env-file perf/.env
node perf/frontend.mjs --env-file perf/.env
# 等待本轮后台任务处理完毕后清理
node perf/fixtures-cli.mjs cleanup --env-file perf/.env
```

浏览器使用清单中索引为 `MAX_VUS` 的账号组；k6 仅使用此前的账号组。收藏与编辑限定到浏览器所属菜品，完成后恢复。准备、浏览器测量、k6 运行及恢复共用同一清单锁。多台压测机应分配独立清单和数据集。

前端构建在运行测试的机器上完成，通过仅监听 `127.0.0.1` 的静态服务器提供页面；`/api/v1` 转发至配置的真实后端，并保留后端路径前缀。网关移除 Origin/Referer，提供固定的同源测试入口。部署域名的 TLS、CORS、CDN、缓存策略及静态资源承载能力需针对实际部署入口单独验证。

## 测量范围

每个场景使用全新的浏览器上下文。H5 视口为 390×844，管理端为 1440×900；均为 Chromium、DPR 1、中文、上海时区，不施加 CPU 或网络降速，浏览器并发为 1。

| 场景 | 页面就绪条件与用户操作 |
| --- | --- |
| client-home | 首页推荐和食堂数据就绪，进入搜索页 |
| client-search | 搜索框可用，搜索所属菜品并打开完整详情 |
| client-detail | 详情及评价加载完成，收藏、验证服务端状态、取消收藏并再次验证 |
| admin-login | 登录表单可用，真实登录并进入新增菜品页 |
| admin-dishes | 菜品列表出现真实数据行，搜索所属菜品并打开详情 |
| admin-edit | 编辑表单加载完毕且允许保存，修改价格、验证服务端状态、恢复价格 |

固定数据集以文本菜品为主，无菜品图片；默认每个账号组有 20 个只读菜品和 1 个可写菜品。结果用于这组场景和数据规模的回归。图片密集页面、大数据分页、弱网和低端设备应使用对应数据集与设备另建基线。

| 指标 | 默认预算 | 含义 |
| --- | --- | --- |
| FCP | 3000 ms | web-vitals 采集首次内容绘制 |
| LCP | 4500 ms | web-vitals 采集当前文档最大内容绘制 |
| CLS | 0.1 | web-vitals 的布局偏移会话窗口算法 |
| readyMs | 10000 ms | 开始导航到场景页面可用 |
| actionMs | 8000 ms | 操作开始到场景断言完成 |

FCP/LCP 属于首次文档加载；SPA 后续路由操作使用 actionMs。CLS 观察至流程结束、固定 500 ms 尾窗和在途请求收尾。INP 在浏览器产生样本时记录为辅助指标，不作为本套件必达指标。实验室短流程结果与线上真实用户的长期分位数分别评估。

每个指标的所有样本均需通过预算，报告提供中位数和最大值；预算应结合目标机器、数据规模和业务要求校准。首次样本包含服务端冷缓存影响，后续样本复用同一后端，浏览器缓存每次重置。

## 配置与判定

默认读取套件目录中的 `perf/.env`；缺失时使用默认参数。`--env-file` 选择另一份配置并替代默认文件；显式指定的文件缺失时失败。环境变量优先于文件；API 配置和 `--profile` 规则沿用 [API 压测](README.md)。

| 变量 | 默认值 / 说明 |
| --- | --- |
| FRONTEND_MODE | `hybrid`；可选 `baseline` |
| FRONTEND_SAMPLES | `3`；每场景、每阶段的独立样本数 |
| FRONTEND_FCP_MS / FRONTEND_LCP_MS | `3000` / `4500` |
| FRONTEND_CLS | `0.1` |
| FRONTEND_READY_MS / FRONTEND_ACTION_MS | `10000` / `8000` |
| PROFILE | 浏览器入口默认 `load`；hybrid 要求固定到达率 load |
| RATE / MAX_VUS / DURATION | 默认 `2` / `10` / `3m`；RATE 为每秒业务流程到达数 |
| K6_BIN | 默认 `k6`；可填绝对路径 |
| RESULTS_DIR | 默认 `perf/results` |

共享示例将 `PROFILE` 保持为注释，API 入口默认 `smoke`，浏览器入口默认 `load`。显式指定其他 PROFILE 时，hybrid 会拒绝运行；可用 `--profile load` 覆盖。负载持续时间必须覆盖整个承压浏览器阶段；增加样本数量时相应增加 DURATION。

k6 首次成功完成业务后才启动承压浏览器。每个浏览器样本的完整时间窗必须位于 k6 固定负载区间内，API 工作负载也必须通过全部阈值。k6 提前退出、负载时间过短、缺少页面指标/样本、同源请求失败、API 业务错误、运行时异常或在途请求未完成均判失败。失败不重试，不通过延长测量区间伪造负载重叠。外部资源来源会记录在样本中，外部网络可影响结果。

## 报告与验证

浏览器目录名为 `perf/results/browser-<runId>-<id>`：

- `build.json`：Git 修订、工作树状态、Node 版本、构建文件 SHA-256。
- `baseline/`、`loaded/`：逐样本指标、浏览器版本、视口、真实 API 请求数量、错误、Playwright JSON 报告和阶段判定。
- `api/`：承压阶段 k6 原始报告和阈值结论。
- `verdict.json`：整轮机器可读结果；非零退出码表示失败。
- 失败截图和 trace 位于阶段的 `artifacts/`；可用 `pnpm --dir perf exec playwright show-trace <trace.zip>` 查看。

输出目录属于私有产物。Trace 可能包含请求认证信息，整目录保持在版本管理之外。浏览器临时会话文件退出时删除，本地 fixture 清单在资源回收时删除。

```bash
node --test perf/tests/*.test.mjs
node --test --test-concurrency=1 perf/tests/*.integration.mjs
```

浏览器验证覆盖 Chromium H5 与管理端发布页面。微信容器、原生 App、Safari、真实移动设备和生产容量分别建立对应验收记录。
