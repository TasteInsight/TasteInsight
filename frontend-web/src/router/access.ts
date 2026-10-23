export interface PermissionChecker {
  hasPermission(permission: string): boolean
  user?: { scope?: 'GLOBAL' | 'CANTEENS'; mustChangePassword?: boolean } | null
}

export function canAccessRoute(
  meta: { requiredPermission?: unknown; requiredPermissions?: unknown; globalOnly?: unknown },
  store: PermissionChecker,
) {
  return (
    (!meta.requiredPermission || store.hasPermission(meta.requiredPermission as string)) &&
    (!Array.isArray(meta.requiredPermissions) ||
      !meta.requiredPermissions.length ||
      meta.requiredPermissions.some((permission) => store.hasPermission(permission))) &&
    (!meta.globalOnly || store.user?.scope === 'GLOBAL')
  )
}

export function hasGlobalPermission(authStore: PermissionChecker, permission: string): boolean {
  return authStore.user?.scope === 'GLOBAL' && authStore.hasPermission(permission)
}

// 根据权限获取第一个可访问的页面
export function getFirstAccessibleRoute(authStore: PermissionChecker): string {
  if (authStore.user && 'mustChangePassword' in authStore.user && authStore.user.mustChangePassword)
    return '/change-password'
  const routePriority = [
    { path: '/single-add', permissions: ['dish:create'] },
    { path: '/modify-dish', permissions: ['dish:view'] },
    { path: '/review-dish', permissions: ['upload:approve'] },
    { path: '/add-canteen', permissions: ['canteen:view'] },
    { path: '/user-manage', permissions: ['admin:view'] },
    { path: '/log-view', permissions: ['log:view'] },
    { path: '/news-manage', permissions: ['news:view'] },
    { path: '/report-manage', permissions: ['report:handle'] },
    {
      path: '/comment-manage',
      permissions: ['review:delete', 'comment:delete'],
      allPermissions: ['dish:view'],
    },
    { path: '/review-manage', permissions: ['review:approve', 'comment:approve'] },
    { path: '/student-verification-manage', permissions: ['student:review'], globalOnly: true },
    { path: '/community-manage', permissions: ['post:view'], globalOnly: true },
    { path: '/config-manage', permissions: ['config:view', 'dish:edit'] },
    { path: '/recommendation-manage', permissions: ['experiment:view'], globalOnly: true },
    { path: '/experiment-manage', permissions: ['experiment:view'], globalOnly: true },
  ]

  for (const route of routePriority) {
    if (route.globalOnly && authStore.user?.scope !== 'GLOBAL') continue
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
