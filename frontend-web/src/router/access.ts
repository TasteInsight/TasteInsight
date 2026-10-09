export interface PermissionChecker {
  hasPermission(permission: string): boolean
}

// 根据权限获取第一个可访问的页面
export function getFirstAccessibleRoute(authStore: PermissionChecker): string {
  const routePriority = [
    { path: '/single-add', permissions: ['dish:create'] },
    { path: '/modify-dish', permissions: ['dish:view'] },
    { path: '/review-dish', permissions: ['upload:approve'] },
    { path: '/add-canteen', permissions: ['canteen:view'] },
    { path: '/user-manage', permissions: ['admin:view'] },
    { path: '/news-manage', permissions: ['news:view'] },
    { path: '/report-manage', permissions: ['report:handle'] },
    {
      path: '/comment-manage',
      permissions: ['review:delete', 'comment:delete'],
      allPermissions: ['dish:view'],
    },
    { path: '/review-manage', permissions: ['review:approve', 'comment:approve'] },
    { path: '/config-manage', permissions: ['config:view'] },
    { path: '/experiment-manage', permissions: ['experiment:view'] },
  ]

  for (const route of routePriority) {
    const hasAnyPermission = route.permissions.some((permission) =>
      authStore.hasPermission(permission),
    )
    const hasAllPermissions =
      !route.allPermissions ||
      route.allPermissions.every((permission) => authStore.hasPermission(permission))

    if (hasAnyPermission && hasAllPermissions) {
      return route.path
    }
  }

  return '/forbidden'
}
