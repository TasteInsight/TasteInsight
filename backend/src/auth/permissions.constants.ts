/**
 * 权限常量定义
 * 集中管理所有系统权限，避免在多处硬编码
 */

// 菜品管理权限
export const DISH_PERMISSIONS = [
  'dish:view',
  'dish:create',
  'dish:edit',
  'dish:delete',
] as const;

// 食堂管理权限
export const CANTEEN_PERMISSIONS = [
  'canteen:view',
  'canteen:create',
  'canteen:edit',
  'canteen:delete',
] as const;

// 上传审批权限
export const UPLOAD_PERMISSIONS = ['upload:approve'] as const;

// 管理员管理权限
export const ADMIN_PERMISSIONS = [
  'admin:view',
  'admin:create',
  'admin:edit',
  'admin:delete',
] as const;

// 新闻管理权限
export const NEWS_PERMISSIONS = [
  'news:view',
  'news:create',
  'news:edit',
  'news:publish',
  'news:revoke',
  'news:delete',
] as const;

// 举报处理权限
export const REPORT_PERMISSIONS = ['report:handle'] as const;

// 评价管理权限
export const REVIEW_PERMISSIONS = ['review:approve', 'review:delete'] as const;

// 评论管理权限
export const COMMENT_PERMISSIONS = [
  'comment:approve',
  'comment:delete',
] as const;

// 配置管理权限
export const CONFIG_PERMISSIONS = ['config:view', 'config:edit'] as const;

// 实验管理权限
export const EXPERIMENT_PERMISSIONS = [
  'experiment:view',
  'experiment:create',
  'experiment:edit',
  'experiment:delete',
] as const;

/**
 * 所有权限的完整列表
 * 超级管理员拥有所有权限
 */
export const ALL_PERMISSIONS: string[] = [
  ...DISH_PERMISSIONS,
  ...CANTEEN_PERMISSIONS,
  ...UPLOAD_PERMISSIONS,
  ...ADMIN_PERMISSIONS,
  ...NEWS_PERMISSIONS,
  ...REPORT_PERMISSIONS,
  ...REVIEW_PERMISSIONS,
  ...COMMENT_PERMISSIONS,
  ...CONFIG_PERMISSIONS,
  ...EXPERIMENT_PERMISSIONS,
];

/**
 * 权限类型
 */
export type Permission = (typeof ALL_PERMISSIONS)[number];
