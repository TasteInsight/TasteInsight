# 贡献指南/提交指南 (CONTRIBUTING.md)

欢迎为本项目做出贡献！本文档将指导您如何向代码仓库提交代码。

# 开发环境准备

## 必需软件

- **Node.js**: >= 22.x
- **pnpm**: >= 8.x (推荐使用 pnpm)
- **Git**: >= 2.x
- **Docker**: >= 20.x (用于运行数据库)
- **PostgreSQL**: >= 15.x
- **Redis**: >= 7.x

## 安装步骤

```bash
# 1. 安装 Node.js (推荐使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# 2. 安装 pnpm
npm install -g pnpm

# 3. 验证安装
node -v
pnpm -v
git --version
```

# 获取代码

## Fork 仓库

1. 访问项目仓库页面
2. 点击右上角的 **Fork** 按钮
3. 将仓库 Fork 到您的账号下

## 克隆代码

```bash
# 克隆您 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/PROJECT_NAME.git

# 进入项目目录
cd PROJECT_NAME

# 添加上游仓库
git remote add upstream https://github.com/TasteInsight/TasteInsight.git

# 验证远程仓库
git remote -v
# 输出应该类似：
# origin    https://github.com/YOUR_USERNAME/PROJECT_NAME.git (fetch)
# origin    https://github.com/YOUR_USERNAME/PROJECT_NAME.git (push)
# upstream  https://github.com/TasteInsight/TasteInsight.git (fetch)
# upstream  https://github.com/TasteInsight/TasteInsight.git (push)
```

## 安装依赖

```bash
# 安装网页前端依赖
cd frontend-web
pnpm install

# 安装小程序依赖
cd ../frontend-miniapp
pnpm install

# 安装后端依赖
cd ../backend
pnpm install

```

## 配置环境变量

```bash
# 后端环境变量
cd backend
cp .env.example .env

# 编辑 .env 文件，填入您的配置
# DATABASE_URL="postgresql://postgres:password@localhost:5432/tasteinsight"
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password
# JWT_SECRET=your-super-secret-key
# JWT_REFRESH_SECRET=another-super-secret-for-refresh-token
# WECHAT_APPID=your_wechat_appid
# WECHAT_SECRET=your_wechat_appsecret
# INITIAL_ADMIN_USERNAME=admin
# INITIAL_ADMIN_PASSWORD=your_secure_password

# 前端环境变量
cd ../frontend-web
cp .env.example .env

cd ../frontend-miniapp
cp .env.example .env

# 编辑 .env 文件
# VITE_API_BASE_URL=http://localhost:3000
```

## 启动数据库

```bash
# 使用 Docker Compose 启动数据库
cd backend
docker-compose up -d

# 或手动启动 PostgreSQL 和 Redis
# PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tasteinsight \
  -p 5432:5432 \
  postgres:17-alpine

# Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

## 初始化数据库

```bash
cd backend

# 运行数据库迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate

# (可选) 填充测试数据
npx prisma db seed

# (可选) 初始化配置模板
npx ts-node prisma/init-config-templates.ts

# (可选) 导入食堂数据
npx ts-node prisma/import_canteens.ts
```

## 启动开发服务器

```bash
# 启动后端 (开发模式)
cd backend
pnpm run start:dev
# 后端运行在 http://localhost:3000

# 启动管理端前端 (新开终端)
cd frontend-web
pnpm dev
# 前端运行在 http://localhost:5173

# 启动小程序 (新开终端)
cd frontend-miniapp
pnpm dev:mp-weixin
# 使用微信开发者工具打开 dist/dev/mp-weixin 目录

# (可选) 启动 Python 嵌入服务
cd backend/python-embedding-service
python app.py
# 嵌入服务运行在 http://localhost:5001
```

# 分支管理

## 分支命名规范

我们采用以下分支命名规范：

- `main` - 主分支，始终保持可部署状态
- `dev` - 开发分支，用于集成新功能
- `feature/功能名称` - 新功能分支
- `bugfix/问题描述` - Bug 修复分支
- `hotfix/紧急修复` - 紧急修复分支
- `release/版本号` - 发布分支

在功能、问题、修复描述前，建议加上`backend/`、`web/`、`miniapp/`、`fullstack/`等前缀以区分不同模块。  
`dev`后可加`/backend`、`/web`、`/miniapp`等表示不同范围的开发分支。

## 创建功能分支

```bash
# 1. 更新本地代码
git checkout dev
git pull upstream dev

# 2. 创建功能分支
git checkout -b feature/backend/user-authentication

# 分支命名示例：
# feature/backend/user-login          - 用户登录功能
# feature/backend/order-management    - 订单管理功能
# bugfix/backend/fix-login-error      - 修复登录错误
# hotfix/backend/security-patch       - 安全补丁
```

# 开发流程

1. 在本地分支开发

```bash
# 确保在正确的分支上
git branch

# 进行开发
# ...编写代码...

# 查看修改的文件
git status

# 查看具体修改内容
git diff
```

1. 运行测试

```bash
# 后端测试
cd backend
pnpm test                 # 运行所有测试
pnpm test:watch          # 监听模式
pnpm test:cov            # 生成覆盖率报告
pnpm test:e2e            # 运行 E2E 测试

# 前端测试
cd frontend-web
pnpm test                # 运行单元测试
pnpm test:ui             # 运行 UI 测试
```

1. 代码检查

```bash
# ESLint 检查
pnpm lint

# 自动修复可修复的问题
pnpm lint:fix

# TypeScript 类型检查
pnpm type-check

# 格式化代码
pnpm format
```

1. 提交代码

```bash
# 添加修改的文件
git add .

# 或添加指定文件
git add src/user/user.service.ts

# 提交代码 (遵循提交规范)
git commit -m "feat: 添加用户登录功能"

# 查看提交历史
git log --oneline
```

# 代码规范

请严格遵守项目的代码规范文档：

- [前端开发规范文档](https://github.com/TasteInsight/TasteInsight/blob/main/docs/%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83%E6%96%87%E6%A1%A3.md)
- [后端开发规范文档](https://github.com/TasteInsight/TasteInsight/blob/main/docs/%E5%90%8E%E7%AB%AF%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83%E6%96%87%E6%A1%A3.md)
- [数据库开发规范文档](https://github.com/TasteInsight/TasteInsight/blob/main/docs/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83%E6%96%87%E6%A1%A3.md)

## 核心要点

### 命名规范

```typescript
// ✅ 正确 - TasteInsight 项目命名规范
const userName = 'John'
const MAX_RETRY_COUNT = 3
function getUserInfo() {}
class DishesService {}
interface DishItem {}           // 接口不使用 I 前缀
interface PaginationMeta {}     // 接口不使用 I 前缀
type DishStatus = 'online' | 'offline'

// Store 文件命名
// use-user-store.ts
// use-auth-store.ts

// DTO 命名
class AdminGetDishesDto {}
class CreateReviewDto {}
class DishResponseDto {}

// ❌ 错误
const user_name = 'John'        // 应使用 camelCase
const maxRetryCount = 3         // 常量应使用 UPPER_SNAKE_CASE
function get_user_info() {}     // 应使用 camelCase
class userService {}            // 类应使用 PascalCase
interface IUserData {}          // 本项目接口不使用 I 前缀
```

### 代码格式

```typescript
// ✅ 正确 - 使用 async/await（TasteInsight 菜品服务示例）
async function getDishById(id: string, userId: string): Promise<DishResponseDto> {
  const dish = await this.prisma.dish.findUnique({
    where: { id },
    include: {
      canteen: true,
      window: true,
    },
  });

  if (!dish) {
    throw new NotFoundException('菜品不存在');
  }

  return {
    code: 200,
    message: 'success',
    data: DishDto.fromEntity(dish),
  };
}

// ✅ 正确 - 使用早返回
function validateReview(review: Review) {
  if (!review) {
    throw new NotFoundException('评价不存在');
  }
  
  if (review.status !== 'approved') {
    throw new BadRequestException('评价未通过审核');
  }
  
  if (review.deletedAt) {
    throw new NotFoundException('评价已被删除');
  }
  
  return true;
}

// ❌ 错误 - 过深的嵌套
function validateReview(review: Review) {
  if (review) {
    if (review.status === 'approved') {
      if (!review.deletedAt) {
        return true
      }
    }
  }
  return false
}
```

### 注释规范

```typescript
/**
 * 菜品服务类
 * 负责处理菜品相关的业务逻辑，包括查询、收藏、推荐等功能
 * 
 * @class DishesService
 */
@Injectable()
export class DishesService {
  constructor(
    private prisma: PrismaService,
    private recommendationService: RecommendationService,
  ) {}

  /**
   * 根据ID获取菜品详情
   * @param id - 菜品ID
   * @param userId - 当前用户ID，用于记录浏览历史
   * @returns 菜品详情响应
   * @throws {NotFoundException} 当菜品不存在时抛出
   */
  async getDishById(id: string, userId: string): Promise<DishResponseDto> {
    // 实现逻辑
  }

  /**
   * 收藏菜品
   * @param dishId - 要收藏的菜品ID
   * @param userId - 用户ID
   * @returns 收藏状态响应
   * @throws {NotFoundException} 当菜品不存在时抛出
   * @throws {BadRequestException} 当已收藏过该菜品时抛出
   */
  async favoriteDish(dishId: string, userId: string): Promise<FavoriteStatusResponseDto> {
    // 实现逻辑
  }
}
```

# 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动
- `ci`: CI/CD 配置修改
- `revert`: 回滚之前的提交

## Scope 范围（可选）

- `web`: 前端管理网页相关
- `backend`: 后端相关
- `miniapp`: 小程序相关
- `database`: 数据库相关
- `api`: API 相关
- `ui`: UI 组件相关
- `auth`: 认证相关
- `dish`: 菜品相关
- `review`: 评价相关
- `recommendation`: 推荐相关
- `canteen`: 食堂相关

## 提交示例

```bash
# 新功能
git commit -m "feat(dish): 添加菜品收藏功能"

# Bug 修复
git commit -m "fix(review): 修复评价楼层号重复问题"

# 文档更新
git commit -m "docs: 更新开发规范文档"

# 代码重构
git commit -m "refactor(recommendation): 重构推荐服务代码结构"

# 性能优化
git commit -m "perf(database): 优化菜品查询性能，添加复合索引"

# 多行提交消息
git commit -m "feat(recommendation): 添加个性化菜品推荐功能

- 集成 Python 嵌入服务
- 添加用户偏好分析
- 实现推荐结果缓存
- 更新订单状态逻辑

Closes #123"
```

## 使用 Commitizen（推荐）

```bash
# 安装 commitizen
pnpm install -g commitizen

# 使用交互式提交
git cz

# 或在 package.json 中配置
# "scripts": {
#   "commit": "cz"
# }

pnpm commit
```

# Pull Request 流程

1. 推送到远程仓库

```bash
# 推送到您 Fork 的仓库
git push origin feature/backend/user-authentication

# 如果分支已存在且需要强制推送（谨慎使用）
git push -f origin feature/backend/user-authentication
```

1. 创建 Pull Request
2. 访问您 Fork 的仓库页面
3. 点击 **Compare & pull request** 按钮
4. 填写 PR 信息：

```markdown
## 变更说明

添加菜品推荐功能，基于用户口味偏好和浏览历史进行个性化推荐。

## 变更类型

- [x] 新功能 (feature)
- [ ] Bug 修复 (bugfix)
- [ ] 代码重构 (refactor)
- [ ] 文档更新 (docs)
- [ ] 其他

## 变更内容

- 实现菜品推荐算法服务
- 添加用户偏好分析接口
- 集成 Python 嵌入服务
- 完善推荐结果缓存逻辑
- 添加推荐 API 端点

## 测试

- [x] 单元测试已通过
- [x] E2E 测试已通过
- [x] 手动测试已完成

## 截图（如果适用）

[添加截图]

## 相关 Issue

Closes #123
Related to #124

## 检查清单

- [x] 代码遵循项目规范
- [x] 已添加必要的注释
- [x] 已更新相关文档
- [x] 已添加/更新测试用例
- [x] 所有测试通过
- [x] 代码已通过 lint 检查
```

1. PR 标题规范

PR 标题应该清晰描述变更内容：

```
feat(dish): 添加菜品收藏功能
fix(review): 修复评价状态更新问题
docs: 更新贡献指南
refactor(recommendation): 重构推荐服务
```

1. 处理反馈

```bash
# 根据代码审查意见修改代码
# ...修改代码...

# 添加并提交修改
git add .
git commit -m "refactor: 根据审查意见优化代码"

# 推送更新
git push origin feature/backend/user-authentication

# PR 会自动更新
```

1. 保持分支更新

```bash
# 拉取上游最新代码
git fetch upstream

# 合并到您的分支
git checkout feature/backend/user-authentication
git merge upstream/dev

# 或使用 rebase（保持提交历史清晰）
git rebase upstream/dev

# 解决冲突（如果有）
# ...解决冲突...
git add .
git rebase --continue

# 推送更新（可能需要强制推送）
git push -f origin feature/backend/user-authentication
```

# 代码审查

## 审查者指南

作为审查者，请关注以下方面：

### 代码质量

- 代码是否遵循项目规范
- 变量、函数命名是否清晰
- 是否有适当的注释
- 代码是否易于理解和维护

### 功能实现

- 功能是否按需求实现
- 是否有边界情况处理
- 错误处理是否完善
- 是否有性能问题

### 测试覆盖

- 是否添加了相应的测试
- 测试用例是否充分
- 测试是否通过

### 安全性

- 是否有安全漏洞
- 敏感数据是否加密
- 是否有 SQL 注入风险
- 是否有 XSS 攻击风险

### 审查意见示例

```markdown
# 总体评价
代码整体质量不错，功能实现完整，但有几处需要优化。

# 具体意见

## 必须修改 (Required Changes)

1. **安全问题**: 管理员密码应该使用 bcrypt 加密，不能明文存储
   ```ts
    // 当前代码
    admin.password = req.body.password
   
    // 建议修改为
    admin.passwordHash = await bcrypt.hash(req.body.password, 10)
    ```
   
2. **性能问题**: 存在 N+1 查询问题，应使用 Prisma include
    ```ts
    // 当前代码
    for (const dish of dishes) {
        dish.canteen = await getCanteen(dish.canteenId)
    }
   
    // 建议使用 include
    const dishes = await prisma.dish.findMany({
        include: { 
          canteen: true,
          window: true 
        }
    })
    ```
---

## 建议优化 (Suggestions)

**1. **命名规范****: 接口命名不应使用 I 前缀
    ```ts
    // 当前代码
    interface IDishData {}
    
    // 建议改为
    interface DishData {}
    ```

**2. **注释补充****: DishesService 类缺少 JSDoc 注释，建议添加

---

## 赞赏 (Kudos)

- 错误处理很完善，使用了 NotFoundException 等 NestJS 异常 👍
- 测试用例覆盖充分 ✅
- DTO 和响应格式统一，遵循了 { code, message, data } 模式 🎉
```

## 被审查者指南

收到审查意见后：

1. **认真阅读** 所有意见
2. **及时回复** 审查者的疑问
3. **积极修改** 代码
4. **标记已解决**  的问题
5. **解释理由** （如果不同意某些意见）

```bash
# 修改代码
# ...

# 提交修改
git add .
git commit -m "refactor: 根据审查意见优化代码"
git push origin feature/backend/user-authentication

# 在 PR 中回复
# "已根据您的建议修改，请再次审查。主要修改：
# 1. 添加了密码加密
# 2. 优化了查询性能
# 3. 补充了必要的注释"
```

---

# 常见问题

## Q1: 如何同步上游仓库的最新代码？

```bash
# 拉取上游最新代码
git fetch upstream

# 切换到本地 dev 分支
git checkout dev

# 合并上游 dev 分支
git merge upstream/dev

# 推送到您的远程仓库
git push origin dev

# 更新功能分支
git checkout feature/your-module/your-feature
git merge dev

# 或使用 rebase
git rebase dev
```

## Q2: 如何解决合并冲突？

```bash
# 当出现冲突时
git merge dev
# Auto-merging src/user/user.service.ts
# CONFLICT (content): Merge conflict in src/user/user.service.ts

# 1. 打开冲突文件
# 2. 查找冲突标记 <<<<<<<, =======, >>>>>>>
# 3. 手动解决冲突
# 4. 删除冲突标记

# 标记冲突已解决
git add src/user/user.service.ts

# 完成合并
git commit

# 推送更新
git push origin feature/your-module/your-feature
```

## Q3: 如何撤销最后一次提交？

```bash
# 撤销提交但保留修改
git reset --soft HEAD^

# 撤销提交并放弃修改
git reset --hard HEAD^

# 修改最后一次提交消息
git commit --amend -m "新的提交消息"

# 添加文件到最后一次提交
git add forgotten-file.ts
git commit --amend --no-edit
```

## Q4: 如何清理本地分支？

```bash
# 查看所有分支
git branch -a

# 删除本地分支
git branch -d feature/your-module/old-feature

# 强制删除未合并的分支
git branch -D feature/your-module/abandoned-feature

# 删除远程分支
git push origin --delete feature/your-module/old-feature

# 清理已删除的远程分支引用
git fetch --prune
```

## Q5: 提交了敏感信息怎么办？

```bash
# ⚠️ 警告：这会改写历史，需要团队协调

# 从所有历史中删除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 或使用 BFG Repo-Cleaner（更快）
# https://rtyley.github.io/bfg-repo-cleaner/

# 强制推送（谨慎！）
git push origin --force --all

# 立即更改所有暴露的密钥/密码
```

## Q6: 如何创建一个干净的提交历史？

```bash
# 使用交互式 rebase 整理提交
git rebase -i HEAD~5  # 整理最近 5 个提交

# 在编辑器中：
# pick abc123 feat: 添加功能 A
# squash def456 fix: 修复功能 A 的 bug
# squash ghi789 refactor: 优化功能 A
# pick jkl012 feat: 添加功能 B

# 保存后会提示编辑提交消息
# 完成后强制推送
git push -f origin feature/your-module/your-feature
```

## Q7: 如何查看某个文件的修改历史？

```bash
# 查看文件的提交历史
git log --follow -- src/user/user.service.ts

# 查看文件每一行的修改者和时间
git blame src/user/user.service.ts

# 查看文件在某次提交的内容
git show abc123:src/user/user.service.ts
```

## Q8: PR 被关闭后如何处理分支？

```bash
# PR 已合并
git checkout dev
git pull upstream dev
git branch -d feature/your-module/your-feature  # 删除本地分支
git push origin --delete feature/your-module/your-feature  # 删除远程分支

# PR 被拒绝
# 可以选择删除分支或继续改进
```

# 获取帮助

如有任何问题，请通过以下方式获取帮助：

- 📧 发送邮件到: [samkuler@qq.com](mailto:samkuler@qq.com)
- 📝 创建 Issue: [GitHub Issues](https://github.com/TasteInsight/TasteInsight/issues)


# 感谢

感谢您为本项目做出贡献！每一个 PR 都让项目变得更好。🎉

---

**最后更新**: 2026-01-04
**维护者**: TasteInsight开发团队
