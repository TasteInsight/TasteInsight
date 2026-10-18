# 管理端 API 模块

管理端请求统一经过 [request.ts](../utils/request.ts)，生产使用管理站点同源的 `/api/v1`。模块路径在该基址下解析；域名和网关配置见 [环境配置与部署](../../../docs/环境配置与部署.md)。

## 模块与职责

| 模块 | 导出对象 | 职责 |
| --- | --- | --- |
| [auth.ts](./modules/auth.ts) | `authApi` | 管理员登录与 Token 刷新 |
| [dish.ts](./modules/dish.ts) | `dishApi` | 菜品查询、投稿、编辑、删除、Excel 导入、图片上传与嵌入任务 |
| [review.ts](./modules/review.ts) | `reviewApi` | 菜品投稿、评价、回复的审核与举报处理 |
| [permission.ts](./modules/permission.ts) | `permissionApi` | 管理员账号与权限 |
| [log.ts](./modules/log.ts) | `logApi` | 操作日志 |
| [news.ts](./modules/news.ts) | `newsApi` | 新闻与公告 |
| [canteen.ts](./modules/canteen.ts) | `canteenApi` | 食堂与窗口 |
| [config.ts](./modules/config.ts) | `configApi` | 模板、全局配置、食堂配置与有效配置 |
| [experiment.ts](./modules/experiment.ts) | `experimentApi` | A/B 实验管理与推荐召回质量评估 |
| [student-verification.ts](./modules/student-verification.ts) | `studentVerificationApi` | 学生资格审核与撤销 |
| [community.ts](./modules/community.ts) | `communityApi` | 社区帖子与回复管理 |

## 导入与类型

[统一入口](./index.ts) 导出认证、菜品、审核、权限、日志、新闻、食堂、配置与实验模块。按业务对象调用：

```typescript
import { dishApi, reviewApi, canteenApi } from '@/api'

const dishes = await dishApi.getDishes({ page: 1, pageSize: 10 })
const reviews = await reviewApi.getPendingReviews({ page: 1, pageSize: 20 })
const canteens = await canteenApi.getCanteens()
```

学生资格与社区模块从对应文件导入：

```typescript
import { studentVerificationApi } from '@/api/modules/student-verification'
import { communityApi } from '@/api/modules/community'
```

统一入口保留 `api` 兼容对象；它只包含 [index.ts](./index.ts) 中显式列出的方法，新增调用优先使用业务模块。

通用请求和响应类型位于 [api.d.ts](../types/api.d.ts)。学生资格与社区类型分别位于 [student-verification.ts](../types/student-verification.ts) 和 [community.ts](../types/community.ts)。

## 菜品提交与审批

`dishApi.createDish` 返回待审核的 `DishUpload`。批准后通过 `approvedDishId` 关联正式菜品；正式菜品 ID 才用于编辑、上下架等操作。

```typescript
import { dishApi } from '@/api'
import type { DishCreateRequest, DishUpload } from '@/types/api'

async function submitDish(data: DishCreateRequest): Promise<DishUpload> {
  const response = await dishApi.createDish(data)
  return response.data
}
```

子项的 `parentDishId` 指向正式主菜，`parentUploadId` 指向待审核主菜，二者互斥。主项和子项分别审核，完整生命周期见 [后端服务文档](../../../backend/README.md#管理员与菜品生命周期)。

## 审核版本

评价与回复的审批请求携带列表返回的 `updatedAt`，防止旧页面覆盖新状态：

```typescript
import { reviewApi } from '@/api'

const pending = await reviewApi.getPendingReviews({ page: 1, pageSize: 20 })
const review = pending.data.items[0]
if (review) {
  await reviewApi.approveReview(review.id, {
    expectedUpdatedAt: review.updatedAt,
  })
}
```

拒绝请求还需提供原因。页面应按具体业务处理失败、刷新列表及确认交互；批量删除等方法直接使用相应业务模块。

## 验证与权限

管理 API 使用管理员 Token，服务端继续校验权限点与食堂范围。客户端按钮可见性不替代接口鉴权。部署通过独立管理 origin 提供这些接口，公共 API 域名不跳转管理站点。

管理员授权请求使用 `scope`（`GLOBAL` / `CANTEENS`）、`canteenIds` 和 `permissions`。登录结果和人员列表同时提供食堂名称列表 `canteens`。资源自身的 `canteenId` 表示单个目标食堂。完整授权和迁移规则见 [管理员范围与授权](../../../backend/README.md#管理员范围与授权)。

前端验证命令见 [管理端测试](../../README.md#测试)，接口集成验证见 [后端测试说明](../../../backend/TEST.md)。
