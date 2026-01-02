export interface PermissionChecker {
  hasPermission(permission: string): boolean
}

// 根据权限获取第一个可访问的页面
export function getFirstAccessibleRoute(authStore: PermissionChecker): string {
  const routePriority = [
    { path: '/single-add', permission: 'dish:view' },
    { path: '/modify-dish', permission: 'dish:view' },
    { path: '/review-dish', permission: 'upload:approve' },
    { path: '/add-canteen', permission: 'canteen:view' },
    { path: '/user-manage', permission: 'admin:view' },
    { path: '/news-manage', permission: 'news:view' },
    { path: '/report-manage', permission: 'report:handle' },
    { path: '/comment-manage', permission: 'review:delete' },
    { path: '/review-manage', permission: 'review:approve' },
    { path: '/config-manage', permission: 'config:view' },
  ]

  for (const route of routePriority) {
    if (authStore.hasPermission(route.permission)) {
      return route.path
    }
  }

  return '/single-add'
}
