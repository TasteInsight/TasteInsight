# 测试说明

## 单元测试

`src/**/*.spec.ts` 使用 `package.json` 中的 Jest 配置：

```bash
pnpm run test:unit
```

## 端到端测试

`test/**/*.e2e-spec.ts` 使用 `test/jest-e2e.json`。先准备两个独立的 PostgreSQL 测试数据库，实例均需提供 pgvector 扩展，库名以 `_test` 结尾。`DATABASE_URL` 指向业务测试库，`RECOMMENDATION_DATABASE_URL` 指向推荐测试库；可使用同一实例中的不同数据库。`test:setup` 会迁移两个数据库并重新填充业务测试数据，业务测试库中的现有数据会被删除。

```bash
cp .env.test.example .env.test
# 填写 DATABASE_URL、RECOMMENDATION_DATABASE_URL 和测试 Redis 密码
pnpm run test:setup
pnpm run test:e2e
pnpm run test:teardown
```

`.env.test` 不纳入版本管理。`test:setup` 从该文件读取连接信息，在宿主机回环地址启动测试 Redis（默认 `6381`）和模拟嵌入服务（默认 `5002`）；两个 PostgreSQL 数据库需事先创建，连接账号需具备迁移和扩展创建权限。准备顺序为业务 Prisma 迁移、生成 Prisma Client、推荐库基础结构迁移、业务测试种子数据。运行单个 E2E 套件可使用 `pnpm run test:e2e:auth` 等脚本，这些脚本会先执行 `test:setup`。

所有 E2E 套件在导入应用模块前验证 `NODE_ENV=test` 和 `DATABASE_URL` 的 PostgreSQL 数据库名后缀 `_test`；提供 `RECOMMENDATION_DATABASE_URL` 时同时检查其测试库后缀及与业务库的隔离。完整测试准备要求两个 URL 均已配置；`test:setup` 在调用 Docker、迁移和种子脚本前执行相同校验。直接运行 `jest --config test/jest-e2e.json` 也经过该入口。测试模式不会读取开发 `.env`。

本地配置从 `.env.test` 加载，已有进程环境变量优先；继承了开发环境模式或非测试库地址时会拒绝运行，不会自动替换目标。CI 可直接注入完整测试环境，无需创建 `.env.test`。缺少文件且未显式提供有效测试目标时会失败。单元测试不使用 E2E 配置，不要求数据库。

E2E 套件在 `beforeAll` 中调用 `await app.listen(0, '127.0.0.1')`，与 Supertest 的 IPv4 请求地址保持一致，并在 `afterAll` 中调用 `await app.close()`。每套测试使用独立的随机端口，服务在该套测试期间保持监听。

有限长度的 SSE 测试使用 `.buffer(true)` 等待完整响应结束，再检查事件与持久化结果。`.buffer(false)` 会在收到响应头时返回，不能作为流处理完成的信号。

## 推荐平台集成与 CI

推荐生命周期测试使用真实的业务 PostgreSQL、独立 pgvector 推荐库和 Redis，HTTP 模型使用测试内置的合成服务。Redis 密码同时传给 API、队列生产者和重启后的 worker。完成 `test:setup` 后，可单独执行：

```bash
pnpm exec dotenv -e .env.test -- jest --config test/jest-e2e.json test/recommendation-platform.e2e-spec.ts --runInBand --watchman=false
```

CI 的后端 E2E 作业分别在 `5432`、`5433` 暴露业务和推荐测试库，使用带密码的 Redis，并在运行完整 E2E 套件前执行两个库的迁移。环境由工作流显式注入。本地端口以 `.env.test` 中的实际配置为准。

部署编排与发布门禁在仓库根目录执行，需要 Node.js 和 Docker Compose：

```bash
node --test .github/scripts/*.test.cjs
```

这组检查覆盖角色配置隔离、可选推荐库、模型服务参数及环境优先级、健康依赖和发布回滚流程。后端单元测试与 E2E 分别验证应用逻辑和数据库生命周期；提交前按改动范围执行对应检查。
