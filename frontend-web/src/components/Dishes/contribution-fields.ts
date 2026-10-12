import type { ContributionField, ContributionFields, ContributionLocation, MealTime } from '@/types/dish-contribution'

export const contributionTasteFields = [
  { key: 'spicyLevel', label: '辣度' },
  { key: 'saltiness', label: '咸度' },
  { key: 'sweetness', label: '甜度' },
  { key: 'oiliness', label: '油度' },
] as const

export const contributionFields: { key: ContributionField; label: string }[] = [
  { key: 'name', label: '菜品名称' },
  { key: 'price', label: '价格' },
  { key: 'priceUnit', label: '价格单位' },
  { key: 'windowId', label: '窗口与楼层' },
  { key: 'description', label: '菜品描述' },
  { key: 'images', label: '图片' },
  { key: 'tags', label: '标签' },
  { key: 'ingredients', label: '原辅料' },
  { key: 'allergens', label: '过敏原' },
  ...contributionTasteFields,
  { key: 'availableMealTime', label: '供应时段' },
  { key: 'availableDates', label: '供应日期段' },
]

export const mealTimeLabels: Record<MealTime, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', nightsnack: '夜宵' }

export function floorLabel(dish: ContributionLocation): string {
  return dish.floorName || dish.floor?.name || (dish.floorLevel || dish.floor?.level ? `${dish.floorLevel || dish.floor?.level}层` : '')
}

export function contributionLocation(dish: ContributionLocation): string {
  return [dish.canteenName, floorLabel(dish), dish.windowName].filter(Boolean).join('-')
}

export function formatContributionPrice(price: number, priceUnit?: string | null): string {
  const unit = (priceUnit || '').trim().replace(/^元\/?/, '')
  return `¥${price}${unit ? `/${unit}` : ''}`
}

export function formatContributionField(dish: Partial<ContributionFields & ContributionLocation>, key: ContributionField): string {
  const value = dish[key]
  if (contributionTasteFields.some(field => field.key === key)) return typeof value === 'number' && value > 0 ? String(value) : '未提供'
  if (key === 'windowId') {
    return [dish.floorName || (dish.floorLevel ? `${dish.floorLevel}层` : ''), dish.windowName, dish.windowNumber ? `编号 ${dish.windowNumber}` : ''].filter(Boolean).join(' · ') || '未填写'
  }
  if (value === null || value === undefined || value === '') return '未填写'
  if (key === 'price') return `¥${value}`
  if (key === 'availableMealTime') return dish.availableMealTime?.map(time => mealTimeLabels[time]).join('、') || '未填写'
  if (key === 'availableDates') return dish.availableDates?.map(range => `${range.startDate.slice(0, 10)} 至 ${range.endDate.slice(0, 10)}`).join('；') || '未设置'
  if (key === 'images') return `${dish.images?.length || 0} 张图片`
  return Array.isArray(value) ? value.join('、') || '未填写' : String(value)
}
