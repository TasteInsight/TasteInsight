# TasteInsight K6 性能测试套件

本目录包含针对 TasteInsight 后端管理端 API 的 K6 性能测试脚本。

## 📁 目录结构

```
k6-perf-test/
├── config.js              # 配置文件（Base URL、管理员账号、API 路径）
├── utils.js               # 工具函数（登录、HTTP 请求封装、随机选择等）
├── main.js                # 入口文件（组合所有场景）
├── README.md              # 本文档
└── scenarios/             # 测试场景目录
    ├── dish-status.js     # 场景1: 菜品状态快速管理
    ├── upload-audit.js    # 场景2: 用户上传菜品审核
    ├── moderation.js      # 场景3: 评价与举报处理
    └── dish-lifecycle.js  # 场景4: 菜品全生命周期管理
```

## 🚀 快速开始

### 1. 安装 K6

```bash
# macOS
brew install k6

# Windows (使用 Chocolatey)
choco install k6

# Linux (Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 使用 Docker
docker pull grafana/k6
```

### 2. 配置测试环境

通过环境变量配置目标和凭据：

| 变量 | 含义 |
| --- | --- |
| `ENV` | `local` 或 `production`，默认 `production`；仅显式 `local` 启用本地默认值 |
| `BASE_URL` | API 完整基础地址，包含部署所需的 `/api/v1` 等前缀；生产模式必填，本地默认 `http://localhost/api/v1` |
| `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` | 管理员凭据，也支持 `ADMIN_USERNAME` / `ADMIN_PASSWORD`；本地默认 `testadmin` / `password123` |
| `K6_MOCK_USER_CODE_BASELINE` / `K6_MOCK_USER_CODE_SECONDARY` | 客户端测试身份；生产模式下登录所用身份必须显式配置 |

环境类型完全由 `ENV` 决定。文档中的 `https://api.example.invalid` 是占位地址，运行时请配置自己的测试服务地址。

```bash
# 本地 Docker 测试
export ENV=local

# 自定义测试部署（凭据从本地环境或私有配置文件加载）
export ENV=production
export BASE_URL="https://api.example.invalid/api/v1"
```

`run-prod-test.sh` 从 `backend/.env` 加载配置；可用 `K6_ENV_FILE=/path/to/perf.env` 指定私有配置文件。该脚本固定使用 `ENV=production`，并要求 `BASE_URL`、`INITIAL_ADMIN_USERNAME` 和 `INITIAL_ADMIN_PASSWORD`。配置文件使用 shell 赋值语法，凭据保留在版本管理之外。

客户端场景依赖后端 Mock 微信登录，应在允许 Mock 认证的隔离测试部署中运行。`ENV` 控制压测工具的目标与凭据策略，后端运行模式由服务端配置。

### 3. 运行测试

```bash
# 进入测试目录
cd backend/scripts/k6-perf-test

# 运行所有场景
k6 run main.js

# 运行单个场景
k6 run scenarios/dish-status.js
k6 run scenarios/upload-audit.js
k6 run scenarios/moderation.js
k6 run scenarios/dish-lifecycle.js

# 使用环境变量运行
ENV=local k6 run main.js
```

## 📊 测试场景说明

### 场景1: 菜品状态快速管理 (`dish-status.js`)

**测试目标**: 测试高频读取和状态修改操作的性能

**业务流程**:
1. 管理员登录获取 Token
2. 获取菜品列表（带分页参数）
3. 随机选择一个菜品
4. 切换菜品状态（online ↔ offline）

**关键接口**:
- `GET /admin/dishes` - 获取菜品列表
- `PATCH /admin/dishes/:id/status` - 更新菜品状态

---

### 场景2: 用户上传菜品审核 (`upload-audit.js`)

**测试目标**: 测试审核队列处理能力

**业务流程**:
1. 管理员登录获取 Token
2. 获取待审核的用户上传菜品列表
3. 随机选择一个待审核项
4. 随机执行"通过"或"拒绝"操作

**关键接口**:
- `GET /admin/dishes/uploads?status=pending` - 获取待审核列表
- `POST /admin/dishes/uploads/:id/approve` - 审核通过
- `POST /admin/dishes/uploads/:id/reject` - 审核拒绝

---

### 场景3: 评价与举报处理 (`moderation.js`)

**测试目标**: 测试多表关联操作的性能

**业务流程**:
1. 管理员登录获取 Token
2. 获取待处理举报列表
3. 随机选择并处理一个举报
4. 额外请求待审核评价列表（只读）

**关键接口**:
- `GET /admin/reports?status=pending` - 获取待处理举报
- `POST /admin/reports/:id/handle` - 处理举报
- `GET /admin/reviews/pending` - 获取待审核评价

---

### 场景4: 菜品全生命周期管理 (`dish-lifecycle.js`)

**测试目标**: 测试菜品完整 CRUD 操作的性能

**业务流程**:
1. 管理员登录获取 Token
2. 获取可用的食堂和窗口信息
3. 创建新菜品（进入待审核状态）
4. 审核通过菜品
5. 编辑菜品信息
6. 删除菜品

**⚠️ 重要业务逻辑说明**:
- 管理员创建菜品后，数据进入 `DishUpload` 表，初始状态为 `pending`
- 需要通过审核接口后，才会在 `Dish` 表创建真正的菜品记录
- 后续的编辑/删除操作针对审核通过后的 `Dish` 记录

**关键接口**:
- `GET /admin/canteens` - 获取食堂列表
- `GET /admin/canteens/:id/windows` - 获取窗口列表
- `POST /admin/dishes` - 创建菜品
- `POST /admin/dishes/uploads/:id/approve` - 审核通过
- `PUT /admin/dishes/:id` - 编辑菜品
- `DELETE /admin/dishes/:id` - 删除菜品

## 📈 性能指标

### 默认阈值配置

| 指标 | 阈值 | 说明 |
|------|------|------|
| `http_req_failed` | < 5% | HTTP 请求失败率 |
| `http_req_duration` | p(95) < 1000ms | 95% 请求响应时间 |
| `admin_login` | p(95) < 500ms | 登录接口响应时间 |
| `get_dishes` | p(95) < 500ms | 获取菜品列表响应时间 |
| `update_dish_status` | p(95) < 300ms | 更新状态响应时间 |

### 自定义阈值

在 `main.js` 的 `options.thresholds` 中修改：

```javascript
thresholds: {
    http_req_failed: ['rate<0.01'],        // 更严格的失败率
    http_req_duration: ['p(95)<500'],      // 更快的响应时间
    'http_req_duration{name:admin_login}': ['p(99)<300'],
},
```

## 🔧 高级用法

### 调整并发用户数和测试时长

```bash
# 10 个虚拟用户，持续 5 分钟
k6 run --vus 10 --duration 5m scenarios/dish-status.js
```

### 输出测试结果到文件

```bash
# JSON 格式
k6 run --out json=results.json main.js

# InfluxDB（需要配置）
k6 run --out influxdb=http://localhost:8086/k6 main.js

# Prometheus（需要配置）
k6 run --out experimental-prometheus-rw main.js
```

### 使用 Docker 运行

```bash
docker run -i --rm \
  -v $(pwd):/scripts \
  -e BASE_URL=https://api.example.invalid/api/v1 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=password \
  grafana/k6 run /scripts/main.js
```

## 📝 代码核实记录

以下是从后端源代码中核实的关键信息：

### 1. API 前缀
- `main.ts` 中未使用 `setGlobalPrefix`，API 无统一前缀

### 2. 认证方式
- 使用 JWT Bearer Token
- 登录接口: `POST /auth/admin/login`
- 请求体: `{ username: string, password: string }`
- 响应: `{ access_token: string, ... }`

### 3. 权限要求
| 模块 | 所需权限 |
|------|----------|
| 菜品查看 | `dish:view` |
| 菜品创建 | `dish:create` |
| 菜品编辑 | `dish:edit` |
| 菜品删除 | `dish:delete` |
| 上传审核 | `upload:approve` |
| 评价审核 | `review:approve` |
| 评价删除 | `review:delete` |
| 举报处理 | `report:handle` |
| 食堂查看 | `canteen:view` |

### 4. 状态枚举值
- **DishStatus**: `'online'` | `'offline'`
- **DishUploadStatus**: `'pending'` | `'approved'` | `'rejected'`
- **ReportAction**: `'delete_content'` | `'warn_user'` | `'reject_report'`

## 🐛 常见问题

### Q: 登录失败怎么办？
A: 检查以下几点：
1. `config.js` 中的管理员账号密码是否正确
2. `BASE_URL` 是否能正常访问
3. 管理员账号是否有足够的权限

### Q: 测试数据不足怎么办？
A: 某些场景（如审核测试）需要有待处理的数据。可以：
1. 先通过前端或 API 创建测试数据
2. 调整测试脚本，在测试前先创建数据

### Q: 如何查看详细的请求日志？
A: 在运行时添加 `--http-debug` 参数：
```bash
k6 run --http-debug main.js
```

## 📄 许可证

MIT License

## 配置回归测试

```bash
node --experimental-vm-modules --test backend/scripts/k6-perf-test/tests/config.test.cjs
```

从仓库根目录运行。测试覆盖环境选择、凭据规则、目标参数传递和脚本失败退出；HTTP 与 k6 命令使用测试替身。
