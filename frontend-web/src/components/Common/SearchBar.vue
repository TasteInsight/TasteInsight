<template>
  <div class="relative">
    <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
    <input
      type="text"
      :placeholder="placeholder"
      class="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      @click="$emit('update:modelValue', '')"
      type="button"
      title="清除搜索"
    >
      <AppIcon class="iconify" icon="carbon:close"></AppIcon>
    </button>
  </div>
</template>

<script lang="ts">
export default {
  name: 'SearchBar',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '搜索...',
    },
  },
  emits: ['update:modelValue'],
}
</script>
