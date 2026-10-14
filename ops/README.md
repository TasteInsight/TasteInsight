# TasteInsight 运维

独立 Compose 运维栈提供公开服务状态、登录保护的 Grafana、Prometheus 指标与告警，以及 PostgreSQL / 本地上传文件的加密备份和隔离恢复。

## 访问与网络

| 入口 | 默认绑定 | 权限 |
| --- | --- | --- |
| 状态页 | `127.0.0.1:8088` | 只读公开摘要，通过 HTTPS 反向代理发布 |
| Grafana | `127.0.0.1:3300` | 登录后访问；可叠加 VPN 或身份代理 |
| Prometheus、Alertmanager、exporter | Docker 网络 | 内部访问 |
| 备份与恢复 | 运维命令 | 服务器运维账号 |

状态页和管理员入口使用部署环境配置的域名；管理员也可以通过 SSH 隧道访问 Grafana。生产反向代理示例见 `nginx.conf.example`。两个端口均保持回环绑定，公网仅发布经过选择的 HTTPS 入口。

公开页面只展示菜品与食堂、校园社区、管理服务的运行状态和维护公告。外部只读路由与对应 API 内部健康检查共同决定状态：已知故障显示异常；采集缺失、数据过期或 Prometheus 不可达显示状态暂不可用。状态结果包含固定字段，不返回探测地址、指标标签、数据库信息和错误详情。维护公告为 `STATUS_NOTICE` 中的纯文本。

当前状态页展示当前探测结果。监控历史保留在私有 Grafana；公开事件时间线、订阅通知可单独扩展。

## 环境配置

在服务器的独立发布目录中保存 `ops` 文件夹。以下命令从该目录执行：

```sh
cp .env.example .env
chmod 600 .env
```

编辑 `.env` 中的值。含 `$`、`#` 或空格的密钥使用 Compose 支持的单引号包裹；将 `.env`、生成的配置和备份密钥保存在运维账号可读的位置。环境示例中的空凭据需要填写。`generated/` 和 `.env` 已加入忽略规则。

| 配置 | 用途 |
| --- | --- |
| `APP_NETWORK` / `APP_DATABASE_NETWORK` / `APP_UPLOADS_VOLUME` | 已部署业务的实际网络和上传卷名称 |
| `PROBE_*_URL` | 三项公开只读探测，须核对线上路径和预期 2xx |
| `PUBLIC_HEALTH_URL` / `ADMIN_HEALTH_URL` / `WORKER_HEALTH_URL` | 拆分进程的内部健康检查 |
| `GRAFANA_ROOT_URL` / `GRAFANA_ADMIN_*` | 管理员访问地址和首次启动账号 |
| `GRAFANA_SECURE_COOKIE` | HTTPS 使用 `true`；本地 HTTP 隧道验证使用 `false` |
| `BACKUP_DB_*` | 数据库连接，账号需要读取全部业务表与序列 |
| `METRICS_DB_*` | 专用监控账号，建议授予 `pg_monitor` 与目标库 CONNECT |
| `METRICS_REDIS_*` | Redis 监控连接 |
| `RESTIC_REPOSITORY` / `RESTIC_PASSWORD` | 加密备份仓库与加密密码 |
| `BACKUP_S3_*` | S3 兼容对象存储访问凭据与 region |
| `BACKUP_INTERVAL_SECONDS` | 两次成功备份之间的等待时间，默认 86400 秒 |
| `BACKUP_RETRY_SECONDS` | 失败后的重试等待，默认 300 秒 |
| `BACKUP_KEEP_DAILY/WEEKLY/MONTHLY` | 默认保留 7 个日、4 个周、6 个月快照 |
| `BACKUP_MAX_AGE_SECONDS` | 有效备份过期告警阈值，默认 90000 秒 |
| `BACKUP_RELEASE` | 当前业务发布版本，写入快照清单；随业务发布更新 |
| `ALERT_CHANNEL` | `none`、`webhook` 或 `email` |
| `ALERT_WEBHOOK_URL` | 接收 Alertmanager 标准 JSON 的地址 |
| `SMTP_*` / `ALERT_EMAIL_TO` | SMTP 邮件发送配置，要求 TLS |
| `MONITOR_HOST` | Linux 主机指标采集开关，配合 `host` profile |

网络和卷名称可通过 `docker inspect` 核对。业务连接使用 external network / volume，名称错误时启动失败。监控数据库账号示例（在目标数据库以管理员执行）：

```sql
CREATE ROLE tasteinsight_monitor LOGIN;
GRANT pg_monitor TO tasteinsight_monitor;
```

通过 psql 的 `\password tasteinsight_monitor` 设置密码，并授予实际目标数据库的 CONNECT 权限。将结果填写到 `.env`。Grafana 环境密码用于首次初始化；已有 Grafana 数据卷的密码通过 Grafana 自身管理功能更改。

## 启动

应用发布需包含内部 `/metrics` 采集代码及公共、管理 Nginx 的指标屏蔽配置。新增指标使用路由模板，避免记录用户 ID、查询参数和凭据；SSE 会话时长不计入普通 API 延迟。worker 采集三个 BullMQ 队列的等待、执行、延迟和失败数量。

```sh
docker compose --env-file .env -f compose.yml config --quiet
docker compose --env-file .env -f compose.yml run --rm configure
docker compose --env-file .env -f compose.yml build backup status
# 仅首次创建全新备份仓库时执行。
docker compose --env-file .env -f compose.yml run --rm backup init
docker compose --env-file .env -f compose.yml up -d
```

配置生成失败时修正对应环境变量后重新生成。配置变更后重建相应容器，例如修改公告后运行 `up -d status`；修改探测或告警参数后重新运行 `configure`，再重启 `prometheus blackbox alertmanager`。

Linux 主机上将 `MONITOR_HOST=true`，重新生成配置，然后使用 `docker compose --env-file .env -f compose.yml --profile host up -d`。主机采集器只读挂载根文件系统、使用主机 PID 命名空间。Docker Desktop 中看到的是 Linux 虚拟机资源；线上主机指标需在实际 Linux 主机验收。

Prometheus 默认保留 30 天数据。Grafana 自动加载 TasteInsight 运维仪表盘，包含探测、API 延迟/错误率、数据库连接、Redis 内存、队列、备份、主机资源及当前告警。

## 备份与恢复

备份仓库使用独立对象存储桶或独立前缀。`RESTIC_REPOSITORY` 示例：

```dotenv
RESTIC_REPOSITORY=s3:https://s3.example.com/tasteinsight-backups
```

阿里云 OSS 等 S3 兼容服务应按该服务的 endpoint、region 和访问策略配置，并执行一次备份及隔离恢复验证。备份密码需独立保管；丢失密码会导致加密快照无法恢复。对象存储桶保持私有。生产仓库凭据仅交给备份进程和恢复操作，公共状态页与 Grafana不持有这些凭据。

每次备份生成 PostgreSQL 自定义格式归档、本地上传文件归档和包含 SHA-256 的清单，再上传为一个 restic 快照。成功快照时间与保留策略结果分别记录；清理失败会独立告警。进程锁防止同一工作卷上同时执行备份、初始化或检查。

数据库归档是 PostgreSQL 一致性快照；文件归档与数据库快照在不同时间采集。要求二者严格对应时，在维护窗口暂停业务写入、等待后台任务收敛后执行一次备份。当前上传备份覆盖配置的本地上传卷；使用 OSS 保存业务图片时，需要另外启用该媒体桶的版本保护或备份策略。

默认每天一次；实际恢复点间隔包含备份执行耗时。分钟级恢复点要求持续 WAL 归档与 PITR，应另行建设并演练。定时备份启动后立即执行一次，失败按配置重试。

```sh
# 定时进程运行时，先停止它，避免与人工操作争用同一工作卷。
docker compose --env-file .env -f compose.yml stop backup
docker compose --env-file .env -f compose.yml run --rm backup once
docker compose --env-file .env -f compose.yml run --rm backup list
docker compose --env-file .env -f compose.yml run --rm backup check
docker compose --env-file .env -f compose.yml up -d backup
```

`check` 读取仓库全部数据并验证，可能产生对象存储读取费用。`list` 返回完整快照 ID。恢复前在 `.env` 设置 `RESTORE_SNAPSHOT`、独立的 `RESTORE_PROJECT_NAME` 和 `RESTORE_DB_PASSWORD`：

```sh
docker compose --env-file .env -f restore.yml config --quiet
docker compose --env-file .env -f restore.yml up -d --wait restore-db
docker compose --env-file .env -f restore.yml run --rm restore
```

恢复工具只接受完整快照 ID，先核验目标数据库和文件目录为空，再校验归档摘要并恢复。数据库恢复使用单事务和遇错退出。恢复日志输出表行数、上传文件数量、快照 ID 和发布版本。对照业务关键记录进一步验收，并记录恢复耗时；演练通过后再制定生产切换步骤。

恢复使用新数据库与独立上传卷，保留结果以便检查。失败后的临时目录也会保留；选择新的恢复项目重新演练。生产切换需单独核对账号权限、应用版本、迁移兼容性、对象存储和 Redis 后台任务。恢复到过去的数据库时间点时，应先暂停 worker，并按业务需求重建或核对队列，避免重放旧任务。

## 告警验收

内置规则覆盖服务探测、采集失败、数据库/Redis 不可用、API 错误率与延迟、队列积压/失败、磁盘/内存、证书到期、备份过期/失败和保留策略失败。

`ALERT_CHANNEL=none` 时仪表盘显示 `AlertDeliveryDisabled`，发送通道保持关闭。`webhook` 使用 Alertmanager 标准消息格式；企业微信、飞书等机器人需要兼容接收器转换，不能直接当作标准 webhook 地址填写。`email` 直接使用 SMTP。

在隔离环境制造探测失败，确认状态变化、告警送达和恢复通知均成功后，记录渠道验收时间。发送失败自身会产生告警，但同一失效渠道无法通知自身故障，应通过外部探测补足。

同机部署适合初期运维。业务主机或整机网络故障时，本站点和告警组件也可能一起失联；面向公众的高可用状态服务需要部署在独立故障域，并从外部持续探测公网入口。内部健康数据跨机传输须通过受控私网连接。

## 本地验证

从仓库根目录运行：

```sh
python3 -m unittest discover -s ops/tests -v
pnpm --dir backend exec jest --watchman=false --runInBand src/runtime/metrics.spec.ts src/runtime/http-boundaries.spec.ts
pnpm --dir backend type-check
docker build -t tasteinsight-ops-backup:test ops/backup
python3 ops/tests/integration_backup.py
```

集成演练使用随机命名并带测试标签的 Docker 网络、数据库和数据卷，覆盖加密快照、全仓库校验、PostgreSQL 外键与向量数据、上传文件恢复、非空目标拒绝和失败备份保留成功时间。仅清理该次演练创建的资源。

生成监控配置后，可以使用镜像内的 `promtool check config`、`promtool check rules` 和 `promtool test rules` 校验配置及 `tests/alerts.test.yml` 中的过期规则。测试文件中的 `/config/alerts.yml` 对应生成目录的只读挂载。
