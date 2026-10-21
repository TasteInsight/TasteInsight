import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import NutritionFields from '@/components/Dishes/NutritionFields.vue'
import { nutritionPayload } from '@/utils/nutrition'
describe('manual per-serving nutrition input', () => {
  it('retains zero, normalizes cleared fields and validates finite nonnegative numbers', () => {
    expect(nutritionPayload({ calories: 0, protein: '', fat: '1.25' })).toEqual({
      calories: 0,
      protein: null,
      carbohydrate: null,
      fat: 1.25,
    })
    for (const calories of [-1, NaN, Infinity, 'bad'])
      expect(() => nutritionPayload({ calories })).toThrow()
  })
  it('edits and clears each labeled numeric input', async () => {
    const values = reactive({ calories: 123, protein: null, carbohydrate: null, fat: null })
    const wrapper = mount(NutritionFields, { props: { values } })
    expect(wrapper.text()).toContain('每份营养信息')
    expect(wrapper.findAll('input')).toHaveLength(4)
    await wrapper.get('input[name="calories"]').setValue('')
    await wrapper.get('input[name="protein"]').setValue('0')
    expect(nutritionPayload(values)).toMatchObject({ calories: null, protein: 0 })
  })
})
