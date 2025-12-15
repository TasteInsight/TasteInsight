feat(配置管理): 根据管理员食堂自动选择配置范围并显示食堂信息

## 功能改进

- 根据管理员的 `canteenId` 自动判断配置范围：
  - 有食堂ID的管理员：修改对应食堂的配置（仅影响该食堂）
  - 全局管理员（无食堂ID）：修改全局配置（影响所有食堂）

- 在配置页面显示当前管理员的管理范围：
  - 显示食堂名称（使用管理员的 `canteenName` 字段）
  - 明确提示配置的影响范围

- 优化配置加载逻辑：
  - 有食堂ID时使用 `getEffectiveConfig` 获取有效配置（食堂配置 > 全局配置 > 默认值）
  - 无食堂ID时使用 `getGlobalConfig` 获取全局配置
  - 更新配置时自动调用对应的 API（`updateCanteenConfig` 或 `updateGlobalConfig`）

## 技术改进

- 移除不必要的食堂列表加载，直接使用管理员信息中的 `canteenName` 字段
- 更新 `Admin` 类型定义，添加 `canteenName` 字段
- 修复 CSS 类名引号冲突问题，使用计算属性生成 toggle switch 类名
- 移除 TypeScript 类型注解，保持 JavaScript 文件一致性

## 文件变更

- `frontend-web/src/views/ConfigManage.vue`: 重构配置管理页面逻辑
- `frontend-web/src/types/api.d.ts`: 添加 `canteenName` 字段到 `Admin` 接口

