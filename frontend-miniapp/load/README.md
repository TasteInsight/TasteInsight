# API 压力测试（Artillery）

本目录用于“脚本化、可复现、可进 CI”的接口压测。

## 快速开始

- 默认目标：`http://localhost:3000`

### 1) 没有后端时：用本地 Mock API Server

先启动 mock server（需要单独一个终端窗口持续运行）：

```bash
pnpm load:mock-api
```

如果提示 `EADDRINUSE: address already in use :::3000`，说明 3000 端口已经有服务在跑（可能是你之前启动的 mock server 或真实后端）。
这种情况下要么直接复用已有服务（跳过上一步），要么先停止占用 3000 的进程后再启动。

再开一个新终端运行 smoke 压测：

```bash
pnpm test:load:smoke
```

压测结束会生成报告：`load-report-smoke.json`。

### 2) 有真实后端时：指定 target

脚本里默认 `--target http://localhost:3000`，如果要压真实后端（推荐），直接用：

```bash
pnpm exec artillery run --target http://<your-backend-host> load/artillery.api.all.yml --output load-report.json
```

## 配置说明

- 用户端配置：`load/artillery.api.all.yml`
- 管理端配置：`load/artillery.api.admin.yml`
- Processor：`load/processors.cjs`（负责可选登录，填充 `token` / `adminToken`）

## Windows 终端显示乱码？

如果 PowerShell/CMD 显示中文乱码，优先使用 Windows Terminal；或在当前终端执行：

```powershell
chcp 65001
```

## 常用环境变量

### 用户端鉴权

- `TOKEN`：直接指定用户端 Bearer token（优先级最高）
- `WECHAT_CODE`：用 `/auth/wechat/login` 换 token（未提供则跳过登录，部分接口可能返回 401）
- `IGNORE_LOGIN=1`：完全跳过登录（适用于只压匿名接口）

示例（PowerShell）：

```powershell
$env:TOKEN = "<your-jwt>"
pnpm test:load:smoke
```

### 管理端鉴权

- `ADMIN_TOKEN`：直接指定管理端 Bearer token（优先级最高）
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：用于 `/auth/admin/login` 换 token
- `IGNORE_ADMIN_LOGIN=1`：完全跳过管理端登录

运行管理端压测：

```bash
pnpm test:load:admin
```

## Apifox 需不需要？

- Apifox 更适合：接口管理、手工调试、临时压单个接口
- “压测所有接口 + 能进 CI + 可复现”更推荐 Artillery/k6 这种脚本化工具

你也可以组合用：用 Apifox 维护/导出 OpenAPI，再用脚本压测落地到 CI。
