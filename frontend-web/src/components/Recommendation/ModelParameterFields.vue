<template>
  <div class="space-y-3">
    <p v-if="!Object.keys(schema?.properties ?? {}).length" class="text-sm text-gray-500">
      此模型使用固定配置，暂无可调整参数。
    </p>
    <div v-else class="admin-form-grid">
      <div v-for="(field, name) in schema?.properties" :key="name">
        <label class="admin-label block" :for="`${idPrefix}-${name}`">{{ field.title }}</label>
        <input
          v-if="field.type === 'number' || field.type === 'integer'"
          :id="`${idPrefix}-${name}`"
          :value="numberValue(name, field.default)"
          type="number"
          :min="field.minimum"
          :max="field.maximum"
          :step="field.type === 'integer' ? 1 : 'any'"
          :disabled="disabled"
          :aria-invalid="!!errors[name]"
          :aria-describedby="`${idPrefix}-${name}-help`"
          :placeholder="`默认：${field.default}`"
          class="admin-input w-full"
          @input="updateNumber(name, $event.target as HTMLInputElement, field.default)"
          @blur="delete numberDrafts[name]"
        />
        <input
          v-else-if="field.type === 'boolean'"
          :id="`${idPrefix}-${name}`"
          :checked="Boolean(modelValue?.[name] ?? field.default)"
          type="checkbox"
          :disabled="disabled"
          :aria-describedby="`${idPrefix}-${name}-help`"
          @change="update(name, ($event.target as HTMLInputElement).checked)"
        />
        <select
          v-else-if="field.type === 'string'"
          :id="`${idPrefix}-${name}`"
          :value="modelValue?.[name] ?? field.default"
          :disabled="disabled"
          :aria-describedby="`${idPrefix}-${name}-help`"
          class="admin-input w-full"
          @change="update(name, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in field.enum" :key="option" :value="option">{{ option }}</option>
        </select>
        <p :id="`${idPrefix}-${name}-help`" class="mt-1 text-xs text-gray-500">
          {{ field.description }} 默认：{{ String(field.default)
          }}<span v-if="field.type === 'number' || field.type === 'integer'"
            >；范围：{{ field.minimum }}–{{ field.maximum }}；留空使用默认值</span
          >
        </p>
        <p v-if="errors[name]" role="alert" class="admin-field-error">{{ errors[name] }}</p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ModelParameters, ModelParameterSchema } from '@/api/modules/recommendation'
import { modelParameterDefaults, modelParameterErrors } from './modelParameters'
const props = defineProps<{
  schema?: ModelParameterSchema
  modelValue?: ModelParameters
  idPrefix: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ModelParameters] }>()
const numberDrafts = reactive<Record<string, { text: string; value: number }>>({})
function numberValue(name: string, defaultValue: number) {
  const value = props.modelValue?.[name] ?? defaultValue
  const draft = numberDrafts[name]
  return draft && Object.is(draft.value, value) ? draft.text : value
}
function updateNumber(name: string, input: HTMLInputElement, defaultValue: number) {
  const value = input.value === '' && !input.validity.badInput ? defaultValue : input.valueAsNumber
  numberDrafts[name] = { text: input.value, value }
  update(name, value)
}
const errors = computed(() => modelParameterErrors(props.schema, props.modelValue))
function update(name: string, value: number | string | boolean) {
  emit('update:modelValue', {
    ...modelParameterDefaults(props.schema),
    ...props.modelValue,
    [name]: value,
  })
}
</script>
