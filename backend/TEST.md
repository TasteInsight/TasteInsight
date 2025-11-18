# 测试说明

## 测试结构

本项目包含两种类型的测试：

### 1. 单元测试 (Unit Tests)
- 位置：`src/**/*.spec.ts`
- 配置：使用 `package.json` 中的 `jest` 配置
- 运行：（待实现）
- 说明：`testPathIgnorePatterns` 配置排除了 `test/` 目录，因为该目录专门用于 e2e 测试

### 2. 端到端测试 (E2E Tests)
- 位置：`test/**/*.e2e-spec.ts`
- 配置：使用 `test/jest-e2e.json` 配置
- 运行：
  - 设置测试环境：`pnpm run test:setup`
  - 运行所有 e2e 测试：`pnpm run test:e2e`
  - 运行认证测试：`pnpm run test:e2e:auth`
  - 运行菜品测试：`pnpm run test:e2e:dishes`

## 环境配置

### 测试数据库配置
1. 复制 `.env.test.example` 为 `.env.test`
2. 在 `.env.test` 中填写实际的数据库凭证
3. **重要**：不要将包含真实凭证的 `.env.test` 提交到版本控制系统

### 测试数据库设置
测试使用独立的数据库 `taste_insight_test_db`，确保不会影响开发或生产数据库。

在运行测试前，请确保：
1. PostgreSQL 服务正在运行
2. 测试数据库已创建
3. `.env.test` 文件中的数据库凭证正确

## 最佳实践

1. 在提交代码前运行完整的测试套件
2. 每个新功能都应该包含相应的 e2e 测试
3. 测试应该是幂等的，可以重复运行
4. 使用 seed 脚本确保测试数据的一致性
