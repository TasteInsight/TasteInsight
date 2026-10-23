# 测试说明

## 单元测试

`src/**/*.spec.ts` 使用 `package.json` 中的 Jest 配置：

```bash
pnpm run test:unit
```

HTML 清洗使用的 `htmlparser2` 及其 DOM 依赖采用 ESM。单元和端到端 Jest 配置通过 `ts-jest` 转换这组依赖，保持 Node.js 22 下的真实清洗测试。调整解析库版本时，应同步检查两处 `transformIgnorePatterns`。

## 端到端测试

`test/**/*.e2e-spec.ts` 使用 `test/jest-e2e.json`。先准备独立的 pgvector PostgreSQL 数据库，数据库名必须以 `_test` 结尾。`test:setup` 会迁移并重新填充该数据库，现有业务数据会被删除。

```bash
cp .env.test.example .env.test
# 填写独立测试数据库的 DATABASE_URL 和 Redis 密码
pnpm run test:setup
pnpm run test:e2e
pnpm run test:teardown
```

`.env.test` 不纳入版本管理。`test:setup` 从该文件读取连接信息，在宿主机回环地址启动测试 Redis（默认 `6381`）和模拟嵌入服务（默认 `5002`）；PostgreSQL 数据库需事先创建。运行单个 E2E 套件可使用 `pnpm run test:e2e:auth` 等脚本，这些脚本会先执行 `test:setup`。

所有 E2E 套件在导入应用模块前验证 `NODE_ENV=test` 和 `DATABASE_URL` 的 PostgreSQL 数据库名后缀 `_test`；`test:setup` 在调用 Docker、迁移和种子脚本前执行相同校验。直接运行 `jest --config test/jest-e2e.json` 也经过该入口。测试模式不会读取开发 `.env`。

本地配置从 `.env.test` 加载，已有进程环境变量优先；继承了开发环境模式或非测试库地址时会拒绝运行，不会自动替换目标。CI 可直接注入完整测试环境，无需创建 `.env.test`。缺少文件且未显式提供有效测试目标时会失败。单元测试不使用 E2E 配置，不要求数据库。

E2E 套件在 `beforeAll` 中调用 `await app.listen(0, '127.0.0.1')`，与 Supertest 的 IPv4 请求地址保持一致，并在 `afterAll` 中调用 `await app.close()`。每套测试使用独立的随机端口，服务在该套测试期间保持监听。

有限长度的 SSE 测试使用 `.buffer(true)` 等待完整响应结束，再检查事件与持久化结果。`.buffer(false)` 会在收到响应头时返回，不能作为流处理完成的信号。
