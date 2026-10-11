<template>
  <div
    v-if="count > 0"
    class="admin-batch-actions mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
    :aria-busy="busy"
  >
    <p class="text-gray-700" role="status" aria-live="polite">
      已选 <span class="font-semibold tabular-nums">{{ count }}</span> 条{{ resource }}
      <span class="ml-2 text-xs leading-5 text-gray-600">{{ scope }}</span>
    </p>
    <p v-if="count > 100" class="text-red-700">每次最多删除 100 条，请减少选择。</p>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-tsinghua-purple disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy || count === 0"
        @click="$emit('clear')"
      >取消选择</button>
      <button
        type="button"
        class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy || disabled || count === 0 || count > 100"
        @click="$emit('delete')"
      >{{ busy ? '处理中…' : `批量删除${resource}` }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  count: number
  resource: string
  scope?: string
  busy?: boolean
  disabled?: boolean
}>(), { scope: '仅当前页', busy: false, disabled: false })

defineEmits<{ clear: []; delete: [] }>()
</script>
