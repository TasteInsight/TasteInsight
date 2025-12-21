# API 压力测试（Artillery）

本目录用于“脚本化、可复现、可进 CI”的接口压测。

## 快速开始

- 默认目标：`http://localhost:3000`（通过 `API_BASE_URL` 覆盖）

```bash
pnpm test:load:smoke
```

如果你的后端需要鉴权：

- 推荐直接提供现成 token：设置环境变量 `TOKEN`
- 或使用 `/auth/wechat/login`：设置 `WECHAT_CODE`（真实微信登录通常需要有效 code）

示例（PowerShell）：

```powershell
$env:API_BASE_URL = "http://localhost:3000"
$env:TOKEN = "<your-jwt>"
pnpm test:load:smoke
```

## 说明

- 主配置：`load/artillery.api.all.yml`
- Processor：`load/processors.cjs`（负责可选登录，填充 `token`）

### 常用环境变量

- `API_BASE_URL`：后端地址
- `TOKEN`：直接指定用户端 Bearer token（优先级最高）
- `WECHAT_CODE`：用登录接口换 token（未提供则跳过登录，可能导致 401）
- `IGNORE_LOGIN=1`：完全跳过登录（适用于只压匿名接口）

### 压测强度相关

- `LOAD_WARMUP_SEC` / `LOAD_WARMUP_RPS`
- `LOAD_STEADY_SEC` / `LOAD_STEADY_RPS`
- `LOAD_SPIKE_SEC` / `LOAD_SPIKE_RPS`
- `LOAD_P95_MS`：p95 响应时间阈值
- `LOAD_ERR_RATE`：错误率阈值

## Apifox 需不需要？

- Apifox 很适合：接口管理、手工调试、临时压一下单个接口。
- 但“压测所有接口 + 能进 CI + 可复现”的场景，更推荐 Artillery/k6 这种脚本化工具。

你也可以组合用：用 Apifox 维护/导出 OpenAPI，再用脚本压测落地到 CI。
## 完整性总结

- ✅ 用户端 API：覆盖所有前端调用的接口（读写混合，动态 ID 获取）
- ✅ 管理端 API：可选场景（weight=0 默认关闭）
- ✅ 鉴权：支持用户端和管理端 token
- ✅ 报告：JSON 输出（可扩展 HTML）
- ✅ CI 友好：环境变量控制强度/目标
- ⚠️ 小程序端：未直接压测（但 API 相同，可通过 H5 代理）
- ⚠️ 扩展：可根据需要加更多场景（如上传文件压测）