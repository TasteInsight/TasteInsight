<template>
  <fieldset class="mb-6">
    <legend class="block text-gray-700 font-medium mb-2">每份营养信息</legend>
    <p class="text-sm text-gray-600 mb-3">按每份实际数据填写，留空可清除。</p>
    <div class="grid grid-cols-2 gap-4">
      <label v-for="field in nutritionFields" :key="field.key" class="block text-sm text-gray-600">
        {{ field.label }}
        <input
          :value="values[field.key]"
          @input="updateValue(field.key, $event)"
          :name="field.key"
          type="number"
          min="0"
          step="any"
          class="w-full admin-input mt-1"
        />
      </label>
    </div>
  </fieldset>
</template>
<script setup lang="ts">
import { nutritionFields } from '@/utils/nutrition'
const props = defineProps<{ values: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:values': [values: Record<string, unknown>] }>()

function updateValue(key: string, event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:values', {
    ...props.values,
    [key]: input.value === '' ? '' : input.valueAsNumber,
  })
}
</script>
