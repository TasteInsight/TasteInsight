# TasteInsight 运维

独立 Compose 运维栈使用 [Uptime Kuma](https://github.com/louislam/uptime-kuma) 提供公开状态页、故障公告和探测历史；Prometheus、Grafana、Alertmanager 提供内部监控与告警；restic 保存 PostgreSQL / 本地上传文件的加密备份。

## 访问与网络

| 入口 | 默认绑定 | 权限 |
| --- | --- | --- |
| 状态页网关 | `127.0.0.1:8088` | 指定状态页的只读入口，通过 HTTPS 反向代理发布 |
| Uptime Kuma 管理端 | `127.0.0.1:3301` | SSH 隧道或 VPN，加 Kuma 独立账号与双因素认证 |
| Grafana | `127.0.0.1:3300` | 登录后访问；可叠加 VPN 或身份代理 |
| Prometheus、Alertmanager、exporter | Docker 网络 | 内部访问 |
| 备份与恢复 | 运维命令 | 服务器运维账号 |

公网状态域名只转发到 `status:8080` 网关（宿主机访问为 `127.0.0.1:8088`）。Kuma 的宿主机 `3301` 端口供私有管理使用（容器内部为 `3001`）。宿主机 Nginx 示例见 `nginx.conf.example`；容器 Nginx 使用专用边缘网络，只将 `status` 加入该网络。Kuma 与网关使用独立内部网络，Kuma 另接业务网络执行健康探测。

网关默认关闭。启用后仅放行指定 slug 的页面、状态与心跳 API、故障历史、RSS、manifest、前端静态资源和 PNG 状态页 Logo；只接受 GET / HEAD。管理页面、初始化接口、Socket.IO（轮询与 WebSocket）、metrics、push、单监控 badge 及其他状态页全部返回 404。Kuma 管理员账号不复用业务管理员账号。

## Uptime Kuma 初始化与发布

固定使用 Uptime Kuma `2.5.6`，SQLite 数据位于 `kuma-data` 卷。通过下面的隧道初始化，SSH 用户和地址按部署环境填写：

```sh
ssh -N -L 3301:127.0.0.1:3301 ops@server.example.invalid
```

打开 `http://127.0.0.1:3301`，创建管理员、启用双因素认证并妥善保管认证密钥。保留 Kuma 登录验证；将管理入口放在 SSH 隧道、VPN 或受身份代理保护的私网入口中。默认 Compose 以 UID/GID 1000 运行 Kuma，使用本地命名卷；迁移已有数据时核对卷权限。

1. 在 Kuma 中创建三个 **Group** 监控，名称为“菜品与食堂”“校园社区”“管理服务”。
2. 每组创建两个子监控：公开业务路由和对应 API 的内部健康检查。公开路由使用下表的地址，类型为 HTTP(s)，接受 `200–299`；内部检查使用 HTTP(s) JSON Query，查询 `status`，期望 `ok`。间隔建议 60 秒、超时 10 秒、重试 1 次；Group 也保持启用。保持 TLS 验证。
3. 新建状态页，slug 与 `STATUS_PAGE_SLUG` 一致，默认 `public`。按下方“品牌与文案”填写名称、简介、页脚，并上传项目 Logo。只把三个 Group 加入公开页，保持“显示链接”“显示标签”“证书详情”关闭；内部子监控留在管理端。
4. 在 Kuma「设置 → 反向代理」启用“信任代理”，使 RSS 使用网关传递的 HTTPS 协议。公网 Nginx 应覆盖 `Host` 和 `X-Forwarded-Proto`，按示例设置。
5. 用隐私窗口核对页面内容，再设置 `STATUS_PUBLIC_ENABLED=true`，执行 `docker compose --env-file .env -f compose.yml up -d status`，发布 HTTPS 入口。

| 公开 Group | 业务路由 | 内部健康检查 |
| --- | --- | --- |
| 菜品与食堂 | `PROBE_CATALOG_URL` 的值 | `PUBLIC_HEALTH_URL` 的值 |
| 校园社区 | `PROBE_COMMUNITY_URL` 的值 | `PUBLIC_HEALTH_URL` 的值 |
| 管理服务 | `PROBE_ADMIN_URL` 的值 | `ADMIN_HEALTH_URL` 的值 |

表中变量仍由 Prometheus / blackbox 使用。Kuma 的监控地址在其管理端录入并保存在数据卷中；变更服务地址时同步更新这两处。Kuma 自行探测、计算可用率和保存历史，Prometheus 保留现有指标、规则与历史。公开页只添加 Group 可保留“业务路由与内部健康共同决定状态”的语义；Group 的已暂停子项会被忽略，维护时使用 Kuma 维护功能并关联状态页，避免通过暂停子项掩盖故障。

故障公告及处理进展在 Kuma 状态页编辑入口维护，解决后保留历史；计划维护在 Kuma 的维护页面配置并关联监控和状态页。RSS 可订阅 `https://status.example.invalid/status/public/rss`（自定义 slug 时替换路径）。公开数据包含显示名称、监控 ID / 类型、心跳时间、响应耗时、可用率、公告及维护内容。显示链接或标签会额外公开相应字段。所有上传的状态页 Logo 均为公开静态资源，公告、CSS、Logo 和公开名称中只填写适合公开的内容。

公开范围以网关的 `STATUS_PUBLIC_ENABLED` 和 `STATUS_PAGE_SLUG` 为准；Kuma 的域名映射与页面显示设置用于页面导航。关闭发布时设 `STATUS_PUBLIC_ENABLED=false` 并重建 `status`，整个公开入口返回 503。修改 slug 时同步修改 Kuma 与环境变量。网关屏蔽第三方脚本、外部图片和 iframe；页面统计功能保持关闭。心跳按页面配置的间隔自动获取，后端心跳缓存约一分钟。公告、维护信息、服务列表和主题在页面加载时获取，后端页面缓存约五分钟；已打开的页面需重新加载才能读取这些变更。页脚的“最后更新时间”表示最近一次成功获取心跳数据的时间，请求失败时保留先前显示的结果。历史从启用探测后累积。

Kuma 告警通道默认留空，已有 Alertmanager 按 `ALERT_CHANNEL` 发送告警。需要增加 Kuma 通知时单独配置并验收，明确接收人及去重策略。RSS 是公开订阅入口，邮件与即时通信通知需要另行配置发送渠道。

### 品牌与文案

在 Kuma 状态页编辑器中配置：

| 字段 | 内容 |
| --- | --- |
| 名称 | TasteInsight 服务状态 |
| Logo | [项目图标](../frontend-web/src/assets/images/TasteInsight_Icon.png)，与管理端和用户端共用 |
| 简介 | 查看服务运行状态、故障进展与维护安排。 |
| 页脚 | 可用率按最近 24 小时内的探测结果统计。 |

上传 Logo 后，Kuma 同时更新页面标识与站点图标，并将图片保存在数据卷中。故障记录和维护公告按实际事件发布；时间、影响范围和处理进展由运维人员维护。

### 公开页主题

`status/theme.css` 是适配 Uptime Kuma `2.5.6` 的公开页主题。主题使用系统字体、细分隔线和紧凑服务列表；手机上心跳条独占一行，长名称自动换行；同时支持浅色、深色和减少动态效果偏好。

1. 通过私有管理入口登录，打开对应状态页，选择“编辑状态页面”。
2. 将 `status/theme.css` 的完整内容粘贴到 **Custom CSS（自定义 CSS）**，保存。
3. 在公开入口刷新，检查服务折叠、心跳悬浮详情、公告与手机布局。主题跟随 Kuma 的明暗主题设置。

CSS 存储在 Kuma 数据卷中，重建网关或升级发布目录后继续保留。修改仓库文件后需重新粘贴保存；清空 Custom CSS 即可恢复默认样式。主题只作用于状态页的浏览视图，编辑器、监控配置和访问控制继续使用 Kuma 及网关原有逻辑。主题使用 Kuma 的类名和布局，升级 Kuma 后按上述步骤复核。

### 从旧状态页升级

保留运维项目名、已有卷、生成配置和业务备份仓库。`configure` 现在使用独立 Python 构建目录；`status` 为 Nginx 网关；新服务为 `uptime-kuma`。先检查服务器 Compose override：移除 `status` / `configure` 旧 Python 镜像的固定引用，更新为本次构建产物或使用仓库构建配置。`status` 可继续使用原边缘网络别名和 8080 容器端口，Kuma 管理端始终留在私网。

```sh
docker compose --env-file .env -f compose.yml build configure status
docker compose --env-file .env -f compose.yml up -d uptime-kuma status
```

按上文完成初始化后开启公开入口。旧 `STATUS_NOTICE` 改为在 Kuma 编辑公告，旧 `/api/status` 接口由 Kuma 状态页 API 取代。Prometheus、Grafana、业务备份卷继续使用原数据。状态页替换期间公众入口会短暂不可用，业务 API 与管理端独立运行。

## 环境配置

在服务器的独立发布目录中保存 `ops` 文件夹。以下命令从该目录执行：

```sh
cp .env.example .env
chmod 600 .env
```

默认使用当前运维目录的 `.env`；也可在全部命令中统一指定 `--env-file .env.server` 等私有配置文件。生成器和服务均使用 Compose 选中的配置，Shell 同名变量优先。生成器只接收探测、告警及规则参数。

编辑选中配置文件中的值。含 `$`、`#` 或空格的密钥使用 Compose 支持的单引号包裹；将 `.env`、生成的配置和备份密钥保存在运维账号可读的位置。环境示例中的空凭据需要填写。`generated/` 和 `.env` 已加入忽略规则。

| 配置 | 用途 |
| --- | --- |
| `APP_NETWORK` / `APP_DATABASE_NETWORK` / `APP_UPLOADS_VOLUME` | 已部署业务的实际网络和上传卷名称 |
| `PROBE_*_URL` | 三项公开只读探测，须核对线上路径和预期 2xx |
| `PUBLIC_HEALTH_URL` / `ADMIN_HEALTH_URL` / `WORKER_HEALTH_URL` | 拆分进程的内部健康检查 |
| `STATUS_PUBLIC_ENABLED` / `STATUS_PAGE_SLUG` | 公开开关和唯一公开页 slug；默认 `false` / `public`，slug 使用 1–64 个小写字母、数字或连字符 |
| `STATUS_PORT` / `KUMA_ADMIN_PORT` | 回环绑定的公开网关 / Kuma 管理端端口，默认 8088 / 3301 |
| `GRAFANA_ROOT_URL` / `GRAFANA_ADMIN_*` | 管理员访问地址和首次启动账号 |
| `GRAFANA_SECURE_COOKIE` | HTTPS 使用 `true`；本地 HTTP 隧道验证使用 `false` |
| `BACKUP_DB_*` | 数据库地址、端口、库名和备份凭据；账号需要读取全部业务表与序列 |
| `BACKUP_DB_SSLMODE` | 备份与 PostgreSQL 监控共用的 TLS 模式；同机示例为 `disable`，要求 TLS 时填写 `require` |
| `METRICS_DB_*` | 专用监控账号，建议授予 `pg_monitor` 与目标库 CONNECT |
| `METRICS_REDIS_HOST` / `METRICS_REDIS_PORT` / `METRICS_REDIS_PASSWORD` | Redis 监控地址、端口和口令；默认地址 `redis`、端口 `6379` |
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

PostgreSQL 备份与监控共用 `BACKUP_DB_HOST`、`BACKUP_DB_PORT`、`BACKUP_DB_NAME` 和显式设置的 `BACKUP_DB_SSLMODE`，分别使用备份账号与监控账号。连接外置服务时，将这些地址与 `METRICS_REDIS_HOST` / `METRICS_REDIS_PORT` 配置为运维容器可访问的实际端点；业务与运维各自读取自己的 env 文件。旧配置省略 TLS 模式时保留兼容行为：备份使用 `prefer`，监控使用 `disable`。`require` 要求连接加密；需要验证服务端身份时，使用 `verify-full`，并通过 Compose override 为两个客户端挂载 CA、配置各自的证书路径，参见 [PostgreSQL TLS 说明](https://www.postgresql.org/docs/15/libpq-ssl.html)。隔离恢复仍连接恢复编排自己的数据库。

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
docker compose --env-file .env -f compose.yml build configure backup status
docker compose --env-file .env -f compose.yml run --rm configure
# 仅首次创建全新备份仓库时执行。
docker compose --env-file .env -f compose.yml run --rm backup init
docker compose --env-file .env -f compose.yml up -d
```

配置生成任务使用独立的已打补丁 Python 镜像，以运维身份写入配置目录，运行期间禁用网络。配置生成失败时修正对应环境变量后重新生成。修改探测或告警参数后重新运行 `configure`，再重启 `prometheus blackbox alertmanager`。首次启动后按前文完成 Kuma 私有初始化和公开页配置。

Linux 主机上将 `MONITOR_HOST=true`，重新生成配置，然后使用 `docker compose --env-file .env -f compose.yml --profile host up -d`。主机采集器只读挂载根文件系统、使用主机 PID 命名空间。Docker Desktop 中看到的是 Linux 虚拟机资源；线上主机指标需在实际 Linux 主机验收。

Prometheus 默认保留 30 天数据。Grafana 自动加载 TasteInsight 运维仪表盘，包含探测、API 延迟/错误率、数据库连接、Redis 内存、队列、备份、主机资源及当前告警。

## 备份与恢复

备份仓库使用独立对象存储桶或独立前缀。`RESTIC_REPOSITORY` 示例：

```dotenv
RESTIC_REPOSITORY=s3:https://s3.example.com/tasteinsight-backups
```

阿里云 OSS 等 S3 兼容服务应按该服务的 endpoint、region 和访问策略配置，并执行一次备份及隔离恢复验证。备份密码需独立保管；丢失密码会导致加密快照无法恢复。对象存储桶保持私有。生产仓库凭据仅交给备份进程和恢复操作，公共状态页与 Grafana不持有这些凭据。

备份运行镜像只保留 PostgreSQL 15 客户端、Python 和 restic，客户端与运行时固定使用 Alpine 3.24。restic 使用官方 `v0.19.1` 源码、Go `1.27.2` 及固定的安全补丁模块构建；升级后应复测备份、恢复、退出清理并扫描最终镜像。

每次备份生成 PostgreSQL 自定义格式归档、本地上传文件归档和包含 SHA-256 的清单，再上传为一个 restic 快照。成功快照时间与保留策略结果分别记录；清理失败会独立告警。失败时先释放临时归档空间，再记录失败状态。进程锁防止同一工作卷上同时执行备份、初始化或检查。

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

备份进程响应 SIGTERM / SIGINT，会先通知正在运行的工具退出并等待其清理仓库锁。命令超时同样先进行有界清理；Compose 预留 45 秒退出时间。停机期间的指标写入错误会记录到日志，停止请求仍会退出调度器。

主机断电、SIGKILL 或存储网络故障可能留下 restic 锁。发现锁冲突后，先确认所有使用该仓库的备份和恢复任务已停止，再由运维人员执行：

```sh
docker compose --env-file .env -f compose.yml stop backup
docker compose --env-file .env -f compose.yml run --rm --entrypoint restic backup unlock
docker compose --env-file .env -f compose.yml run --rm backup check
docker compose --env-file .env -f compose.yml up -d backup
```

`unlock` 使用默认的失效锁检查，保留仍有效的锁。工具不会自动移除其他任务的锁。

`check` 读取仓库全部数据并验证，可能产生对象存储读取费用。`list` 返回完整快照 ID。恢复前在 `.env` 设置 `RESTORE_SNAPSHOT`、独立的 `RESTORE_PROJECT_NAME` 和 `RESTORE_DB_PASSWORD`：

```sh
docker compose --env-file .env -f restore.yml config --quiet
docker compose --env-file .env -f restore.yml up -d --wait restore-db
docker compose --env-file .env -f restore.yml run --rm restore
```

恢复工具只接受完整快照 ID，先核验目标数据库和文件目录为空，再校验归档摘要并恢复。数据库恢复使用单事务和遇错退出。恢复后的媒体目录使用 `0755`、文件使用 `0644`，供 Nginx 读取；归档工作目录保持私有。恢复日志输出表行数、上传文件数量、快照 ID 和发布版本。对照业务关键记录进一步验收，并记录恢复耗时；演练通过后再制定生产切换步骤。

恢复使用新数据库与独立上传卷，保留结果以便检查。失败后的临时目录也会保留；选择新的恢复项目重新演练。生产切换需单独核对账号权限、应用版本、迁移兼容性、对象存储和 Redis 后台任务。恢复到过去的数据库时间点时，应先暂停 worker，并按业务需求重建或核对队列，避免重放旧任务。

### Kuma 数据备份与恢复

业务定时备份覆盖 PostgreSQL 和上传文件。Kuma 的账号、监控配置、SQLite 历史和公告位于独立卷，需要另行备份。升级 Kuma 前以及更改监控或公告后，在维护窗口停止 Kuma 后导出完整 `/app/data`，确保 SQLite、WAL 与上传文件一致。归档含账号及通知凭据，按私密数据管理。

下面的命令从 `ops` 目录执行，使用已有 restic 仓库和独立的 `uptime-kuma` 标签。执行前停止定时备份，结束后恢复两个服务；发生错误时保留归档并检查日志后再继续。

```sh
umask 077
mkdir -p kuma-backups
docker compose --env-file .env -f compose.yml stop backup uptime-kuma
docker compose --env-file .env -f compose.yml run --rm -T --no-deps --entrypoint tar uptime-kuma -C /app/data -czf - . > kuma-backups/data.tar.gz
tar -tzf kuma-backups/data.tar.gz > /dev/null
docker compose --env-file .env -f compose.yml run --rm --no-deps -v "$PWD/kuma-backups:/kuma-backups:ro" --entrypoint sh backup -c 'exec restic backup --host "$BACKUP_HOST" --tag uptime-kuma /kuma-backups'
docker compose --env-file .env -f compose.yml up -d uptime-kuma backup
```

Kuma 快照使用独立保留策略；业务定时清理只处理 `tasteinsight` 标签。可使用 `run --rm --entrypoint restic backup snapshots --tag uptime-kuma` 查找快照，使用 `restic dump` 从所选完整快照 ID 提取 `/kuma-backups/data.tar.gz`。业务数据库恢复使用 `tasteinsight` 标签的快照。

恢复时先在隔离项目创建空的 Kuma 数据卷，保持公开网关关闭，再将归档解压到该卷；保持 UID/GID 1000。下面以已经解密下载的 `kuma-backups/data.tar.gz` 为例，`KUMA_RESTORE_VOLUME` 填写新建空卷名：

```sh
docker volume create "$KUMA_RESTORE_VOLUME"
docker run --rm -i --network none --user 1000:1000 -v "$KUMA_RESTORE_VOLUME:/app/data" --entrypoint sh louislam/uptime-kuma:2.5.6 -c 'test -z "$(ls -A /app/data)" && exec tar -C /app/data -xzf -' < kuma-backups/data.tar.gz
```

用相同 Kuma 版本和该卷启动仅回环绑定的隔离实例，先隔离探测网络，避免恢复出的通知重复发送；验证登录、监控列表、公告和历史后再安排切换。回滚版本时配套恢复升级前数据，数据库迁移后的卷保留用于排查。`kuma-backups/` 已忽略于版本管理。

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
docker build -t tasteinsight-status-gateway:test ops/status
python3 ops/tests/integration_status.py
```

集成演练使用随机命名并带测试标签的 Docker 网络、数据库和数据卷，覆盖加密快照、全仓库校验、PostgreSQL 外键与向量数据、上传文件恢复、非空目标拒绝、Nginx 对恢复媒体的实际 HTTP 读取、命令超时、SIGTERM/SIGINT 停止、磁盘耗尽后的失败告警状态及成功时间保留。仅清理该次演练创建的资源。

生成监控配置后，可以使用镜像内的 `promtool check config`、`promtool check rules` 和 `promtool test rules` 校验配置及 `tests/alerts.test.yml` 中的过期规则。测试文件中的 `/config/alerts.yml` 对应生成目录的只读挂载。

状态页集成验证使用隔离的真实 Kuma 和网关容器，检查首次初始化关闭、公开白名单、管理登录、Socket.IO 隔离、私有监控隐藏、故障与恢复、公告历史、容器重建及完整数据卷导出恢复。浏览器验收应覆盖桌面和手机宽度、公开页面请求、私有管理登录，以及 HTTPS 反向代理。镜像升级后重跑路由边界测试，核对上游新增的公开资源与 API。
