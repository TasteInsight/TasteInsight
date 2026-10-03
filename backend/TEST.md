# 测试说明

## 单元测试

`src/**/*.spec.ts` 使用 `package.json` 中的 Jest 配置：

```bash
pnpm run test:unit
```

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

E2E 套件在 `beforeAll` 中调用 `await app.listen(0, '127.0.0.1')`，与 Supertest 的 IPv4 请求地址保持一致，并在 `afterAll` 中调用 `await app.close()`。每套测试使用独立的随机端口，服务在该套测试期间保持监听。

有限长度的 SSE 测试使用 `.buffer(true)` 等待完整响应结束，再检查事件与持久化结果。`.buffer(false)` 会在收到响应头时返回，不能作为流处理完成的信号。
