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
export const LOG_PERMISSIONS = ['log:view'] as const;

export const STUDENT_PERMISSIONS = ['student:review'] as const;
export const POST_PERMISSIONS = [
  'post:view',
  'post:approve',
  'post:delete',
] as const;

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
  ...STUDENT_PERMISSIONS,
  ...POST_PERMISSIONS,
  ...EXPERIMENT_PERMISSIONS,
  ...LOG_PERMISSIONS,
];

export const GLOBAL_ONLY_PERMISSIONS: readonly string[] = [
  ...STUDENT_PERMISSIONS,
  ...POST_PERMISSIONS,
  ...EXPERIMENT_PERMISSIONS,
];

export const PERMISSION_GROUPS = [
  {
    id: 'dishes',
    name: '菜品管理',
    permissions: [
      { id: 'dish:view', label: '浏览菜品列表' },
      { id: 'dish:create', label: '新建菜品' },
      { id: 'dish:edit', label: '编辑菜品与刷新推荐数据' },
      { id: 'dish:delete', label: '删除菜品' },
    ],
  },
  {
    id: 'canteen',
    name: '食堂与窗口管理',
    permissions: [
      { id: 'canteen:view', label: '浏览食堂/窗口' },
      { id: 'canteen:create', label: '创建食堂/窗口' },
      { id: 'canteen:edit', label: '编辑食堂/窗口' },
      { id: 'canteen:delete', label: '删除食堂/窗口' },
    ],
  },
  {
    id: 'review',
    name: '内容审核',
    permissions: [
      { id: 'review:approve', label: '审核评价' },
      { id: 'review:delete', label: '删除评价' },
      { id: 'comment:approve', label: '审核评论' },
      { id: 'comment:delete', label: '删除评论' },
      { id: 'report:handle', label: '处理举报' },
      { id: 'upload:approve', label: '审核菜品上传' },
    ],
  },
  {
    id: 'news',
    name: '新闻管理',
    permissions: [
      { id: 'news:view', label: '浏览新闻' },
      { id: 'news:create', label: '创建新闻与管理来源' },
      { id: 'news:edit', label: '编辑新闻' },
      { id: 'news:publish', label: '发布新闻' },
      { id: 'news:revoke', label: '撤回新闻' },
      { id: 'news:delete', label: '删除新闻' },
    ],
  },
  {
    id: 'admin',
    name: '子管理员管理',
    permissions: [
      { id: 'admin:view', label: '浏览子管理员' },
      { id: 'admin:create', label: '创建子管理员' },
      { id: 'admin:edit', label: '编辑子管理员' },
      { id: 'admin:delete', label: '停用子管理员' },
    ],
  },
  {
    id: 'log',
    name: '操作日志',
    permissions: [{ id: 'log:view', label: '查看自己与所有下属的操作日志' }],
  },
  {
    id: 'config',
    name: '配置管理',
    permissions: [
      { id: 'config:view', label: '查看配置' },
      { id: 'config:edit', label: '编辑配置' },
    ],
  },
  {
    id: 'student',
    name: '学生身份认证（全局）',
    permissions: [{ id: 'student:review', label: '审核与撤销学生认证' }],
  },
  {
    id: 'post',
    name: '社区管理（全局）',
    permissions: [
      { id: 'post:view', label: '查看帖子与回复' },
      { id: 'post:approve', label: '审核帖子与回复' },
      { id: 'post:delete', label: '删除帖子与回复' },
    ],
  },
  {
    id: 'experiment',
    name: '推荐实验（全局）',
    permissions: [
      { id: 'experiment:view', label: '浏览实验' },
      { id: 'experiment:create', label: '创建实验' },
      { id: 'experiment:edit', label: '编辑实验' },
      { id: 'experiment:delete', label: '删除实验' },
    ],
  },
];

/**
 * Permissions required for a granted permission to be usable.
 * The service layer validates the transitive closure before persisting grants.
 */
export const PERMISSION_DEPENDENCIES: Readonly<
  Record<string, readonly string[]>
> = {
  'dish:create': ['canteen:view'],
  'dish:edit': ['dish:view', 'canteen:view'],
  'dish:delete': ['dish:view'],
  'canteen:create': ['canteen:view'],
  'canteen:edit': ['canteen:view'],
  'canteen:delete': ['canteen:view'],
  'review:approve': ['dish:view', 'canteen:view'],
  'review:delete': ['review:approve'],
  'comment:approve': ['dish:view', 'canteen:view'],
  'comment:delete': ['comment:approve'],
  'upload:approve': ['dish:view', 'canteen:view'],
  'news:create': ['news:view'],
  'news:edit': ['news:view'],
  'news:publish': ['news:view'],
  'news:revoke': ['news:view'],
  'news:delete': ['news:view'],
  'admin:create': ['admin:view', 'canteen:view'],
  'admin:edit': ['admin:view'],
  'admin:delete': ['admin:view'],
  'config:edit': ['config:view'],
  'post:approve': ['post:view'],
  'post:delete': ['post:view'],
  'experiment:create': ['experiment:view'],
  'experiment:edit': ['experiment:view'],
  'experiment:delete': ['experiment:view'],
};

/**
 * 权限类型
 */
export type Permission = (typeof ALL_PERMISSIONS)[number];
