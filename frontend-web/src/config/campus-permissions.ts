export const campusPermissionGroups = [
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
]

export const campusGlobalPermissions = campusPermissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
)
