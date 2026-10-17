import type { Admin } from '@/types/api'

export function formatAdminScope(admin?: Pick<Admin, 'scope' | 'canteens'> | null): string {
  if (admin?.scope === 'GLOBAL') return '全局范围'
  return admin?.canteens.map(canteen => canteen.name).join('、') || '暂无授权食堂'
}
