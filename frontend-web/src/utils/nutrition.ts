export const nutritionFields = [
  { key: 'calories', label: '热量（kcal）' },
  { key: 'protein', label: '蛋白质（g）' },
  { key: 'carbohydrate', label: '碳水化合物（g）' },
  { key: 'fat', label: '脂肪（g）' },
] as const

export function nutritionPayload(form: Record<string, unknown>): Record<typeof nutritionFields[number]['key'], number | null> {
  return Object.fromEntries(
    nutritionFields.map(({ key }) => {
      const value = form[key]
      if (value === null || value === undefined || String(value).trim() === '') return [key, null]
      const number = Number(value)
      if (!Number.isFinite(number) || number < 0)
        throw new Error('营养信息请填写大于等于 0 的有效数值')
      return [key, number]
    }),
  ) as Record<typeof nutritionFields[number]['key'], number | null>
}
