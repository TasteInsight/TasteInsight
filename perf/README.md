# API 性能测试

本目录提供统一的 k6 API 压测入口，以及 [H5 和管理端发布页面性能测试](FRONTEND.md)。测试覆盖真实 HTTP、身份鉴权、业务写入、后台队列和后端承压时的浏览器操作。

## 快速开始

依赖：仓库指定的 Node.js/pnpm、已安装的后端依赖、Docker 和 k6。验证使用 k6 1.4.2。

```bash
# 在仓库根目录运行全部 14 类业务的隔离冒烟测试
node perf/local.mjs --profile smoke

# 私有负载配置
cp perf/.env.example perf/.env
node perf/local.mjs --env-file perf/.env --profile load

# 配置与运行器回归测试
node --test perf/tests/*.test.mjs

# 完整集成矩阵需先按 FRONTEND.md 安装前端、perf 依赖及 Chromium
# 顺序执行，避免多个测试同时构建同一后端产物
node --test --test-concurrency=1 perf/tests/*.integration.mjs
```

本地运行器创建独占 PostgreSQL/Redis，编译当前后端，启动 public/admin/worker 三个生产入口，并生成独立签名密钥和测试账号。Mock 登录保持关闭。完成、失败或收到 SIGINT/SIGTERM 后，运行器停止自己创建的进程，清理测试数据，验证无关对照记录仍存在，再移除自己的容器。数据库和缓存仅绑定本机回环地址。

本地运行使用应用内置的推荐特征回退，不调用外部嵌入、微信、短信或 AI 服务。结果用于验证 API 契约、性能回归和负载模型。真实容量评估应在与部署规格、数据规模和外部依赖匹配的隔离环境中执行。

## 配置

`--env-file` 读取独立压测文件，系统环境变量覆盖文件值，`--profile` 覆盖 PROFILE。后端的 `.env` 不参与加载。目标环境名称与负载方案独立。

| 配置 | 含义 |
| --- | --- |
| `PROFILE` | `smoke`、`load`、`stress`、`soak`；默认 smoke |
| `RATE` | 每秒启动的业务流程数；一个流程包含多个 HTTP 请求 |
| `MAX_VUS` | 预分配和最大虚拟用户数，每个 VU 对应独立身份与资源 |
| `DURATION` | load/soak 的持续时间；stress 每个阶段的持续时间；支持 s/m/h |
| `P95_MS` | 实际负载请求的 p95 上限，默认 1500ms |
| `ERROR_RATE` | HTTP、业务断言和业务流程允许的失败比例；smoke 默认 0，其他默认 0.01 |
| `JOURNEY_WEIGHTS` | JSON 对象，配置业务流量占比；未知名字、负数和全零配置会报错 |
| `DISHES_PER_SLOT` | 准备阶段每组身份的读取菜品数，默认 20，另有独立写入菜品 |
| `PUBLIC_BASE_URL` / `ADMIN_BASE_URL` | 已有隔离部署的完整 API 基础地址，支持 `/api/v1` 前缀 |
| `FIXTURES_FILE` | 私有测试清单；相对路径以 env 文件所在目录为基准 |
| `K6_BIN` | k6 可执行文件路径，默认使用 PATH 中的 k6 |
| `RESULTS_DIR` | 运行报告目录，默认 `perf/results` |

本地运行器自动生成目标地址与清单。已有部署必须显式配置两个地址和清单；地址必须与清单完全匹配。

## 数据准备与隔离

每次准备分配一个 `runId`。每个 VU 拥有两个已认证学生账号、一个限定食堂范围的测试管理员、独立食堂/窗口、读取菜品集、写入菜品、一条公开评价和一条已发布新闻。审核配置仅写入所属测试食堂。测试账号的短期访问令牌由准备过程签发，API 仍使用正常的签名、账号存在性和学生认证检查。

准备过程只接受 `tasteinsight_perf_<16位十六进制>` 命名的专用空数据库。API 写入只引用所属资源或从本次创建请求返回并校验归属的资源。审核流程自行创建待审数据，数据耗尽会使业务契约失败。准备、运行和清理共用排他文件锁；重复运行使用独立 executionId 避免软删除用户名冲突；准备未完成、身份不足、令牌临近过期或目标不匹配时停止执行。

已有隔离部署的数据库先执行正常迁移，应用配置使用该数据库及独立 Redis。将下列私有变量加入压测文件：`FIXTURE_DATABASE_URL`、`FIXTURE_JWT_SECRET`、`FIXTURE_JWT_REFRESH_SECRET`。签名密钥应与测试后端一致。

```bash
node perf/fixtures-cli.mjs prepare --env-file /private/path/perf.env
node perf/run.mjs --env-file /private/path/perf.env --profile load
node perf/fixtures-cli.mjs cleanup --env-file /private/path/perf.env
```

清理应在压测结束且相关后台任务处理完成后运行。准备中途失败会保留 `preparing` 清单供 cleanup 恢复；过期清单仍可清理。普通 workload 子进程只接收清单、负载配置与运行路径。清单、私有配置和日志均应保留在版本管理之外。正常退出自动释放运行锁；强制终止宿主后，确认对应 k6 进程已结束再移除残留锁并清理。

## 业务覆盖

| 场景名 | 流程 |
| --- | --- |
| `browsing` | 推荐、按所属食堂搜索、详情、收藏与取消收藏 |
| `account` | 个人资料、设置读写及恢复、通知列表 |
| `aiSessions` | 静态建议、会话创建、空历史查询和删除（不调用模型生成） |
| `social` | 评价/评论列表、发表评论、审核、点赞与取消、举报、删除 |
| `posting` | 发布评价、查询本人评价和资料、删除 |
| `planning` | 创建、查询、修改和删除饮食计划 |
| `dishStatus` | 查询所属菜品、上下架、读取确认恢复 |
| `uploads` | 创建待审菜品、通过/拒绝、校验结果、清理已发布菜品 |
| `moderation` | 创建公开评价、另一账号举报、管理员处理、清理内容 |
| `dishLifecycle` | 创建、审核入库、读取、更新和删除菜品 |
| `canteenManage` | 查询和更新所属食堂/窗口、恢复字段 |
| `permissionLifecycle` | 创建子管理员、修改权限、真实登录、删除 |
| `reviewAudit` | 创建待审评价、带版本审核通过、修改后重新审核拒绝、清理 |
| `contentModeration` | 管理员删除本次创建的评论和评价 |

管理员登录、用户身份和令牌刷新在 setup 中逐组验证。业务负载复用会话，不把每一轮浏览都变成登录。真实外部身份提供商的登录容量需要单独评估。

## 负载与判定

- smoke：一个 VU，逐个执行全部业务；适合契约验收。
- load：固定业务到达率，默认 5 分钟。
- stress：按 RATE、2×RATE、4×RATE 分三个阶段递增。
- soak：固定业务到达率，未指定 DURATION 时默认 1 小时。

默认混合比例为浏览 60、社交 15、评价 5、计划 10，两个辅助客户端流程和八个管理流程各 1。这是可复现的起始配置，应根据实际流量调整。每个权重周期先覆盖全部启用流程，再分配剩余重复次数；短测试的比例会受首轮覆盖影响。

每个请求检查状态码、业务 code 和当前数据契约；业务流程全部完成才计成功。阈值同时约束 HTTP 失败、业务检查、流程成功率和 p95。每个启用流程至少成功执行一次；到达率负载要求 `dropped_iterations=0`，已启动流程数必须等于已结束流程数。预检请求单独标记，耗时不会混入 workload 阈值。阈值失败、缺失报告/指标、未执行场景、k6 非零退出或中断都判为失败。

API 删除产生的软删除记录和审核记录会在本轮运行内累积；运行间通过 fixture cleanup 或一次性数据库重置隔离。跨主机并行压测应使用独立清单和独立数据集，本地文件锁只协调同一清单文件的本机进程。长稳测试需同时观察数据库增长、连接数、队列和服务内存。

## 结果

`perf/results` 保存私有运行产物：

- `run.json`：目标、负载参数、身份数量和开始时间。
- `summary.json`：k6 指标、p95/p99、业务流程完成数和阈值结果。
- `verdict.json`：工作负载的机器可读结论。
- `k6.log`：操作名和契约失败信息。
- 本地运行另有各角色日志、`cleanup.json`、数据规模记录、各角色指标快照和最终 `result.json`。

各 API/worker 的指标可接入仓库 `ops/` 中的私有监控。对比测试时保持版本、机器规格、数据库规模、外部依赖和压测机位置一致，并确认压测机自身未饱和。

### 旧入口迁移

`backend/scripts/k6-perf-test` 的 4 类客户端与 8 类管理场景已迁入本套件。Artillery 中有效的资料、设置、通知、食堂/窗口、新闻、AI 会话/历史和管理列表请求已合并。旧 `/user/settings` 的读写改用当前 `/user/profile` 的 `settings` 契约；旧 `/admin/users` 在当前后端没有对应路由。旧固定 Mock 资源 ID 已由本次运行清单替代。

## 发布页面与后端承压联测

[浏览器性能套件](FRONTEND.md) 提供 H5 和管理端的 production 构建基线，以及真实后端承压时的登录、搜索、收藏和编辑流程。入口为 `node perf/frontend-local.mjs`（自动隔离环境）和 `node perf/frontend.mjs --env-file perf/.env`（已准备的测试部署）。
