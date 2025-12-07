<template>
  <div class="p-6 bg-gray-50 border-b">
    <div class="flex items-center">
      <div class="relative flex-1">
        <input
          type="text"
          :placeholder="placeholder"
          class="w-full px-4 pl-10 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
        />
        <span class="iconify text-gray-400 absolute left-3 top-2.5" data-icon="bx:search"></span>
      </div>
      <button
        v-if="showFilter"
        class="ml-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-200 flex items-center"
        @click="$emit('filter')"
      >
        <span class="iconify mr-1" data-icon="system-uicons:filtering"></span>筛选
      </button>
    </div>
  </div>
</template>

<script>
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
    showFilter: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'filter'],
}
</script>
