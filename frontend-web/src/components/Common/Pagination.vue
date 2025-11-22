<template>
  <div class="p-6 border-t border-gray-200 flex items-center justify-between">
    <div class="text-gray-500 text-sm">
      显示 {{ startIndex }}-{{ endIndex }} 条，共 {{ total }} 条记录
    </div>
    <div class="flex space-x-2">
      <button 
        class="px-3 py-1 border rounded text-gray-500 hover:bg-gray-100"
        :disabled="currentPage === 1"
        @click="$emit('page-change', currentPage - 1)"
      >
        上一页
      </button>
      <button 
        v-for="page in pages" 
        :key="page"
        class="px-3 py-1 border rounded"
        :class="page === currentPage ? 'bg-tsinghua-purple text-white' : 'text-gray-500 hover:bg-gray-100'"
        @click="$emit('page-change', page)"
      >
        {{ page }}
      </button>
      <button 
        class="px-3 py-1 border rounded text-gray-500 hover:bg-gray-100"
        :disabled="currentPage === totalPages"
        @click="$emit('page-change', currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'Pagination',
  props: {
    currentPage: {
      type: Number,
      default: 1
    },
    pageSize: {
      type: Number,
      default: 10
    },
    total: {
      type: Number,
      default: 0
    }
  },
  emits: ['page-change'],
  setup(props) {
    const totalPages = computed(() => Math.ceil(props.total / props.pageSize))
    
    const startIndex = computed(() => (props.currentPage - 1) * props.pageSize + 1)
    
    const endIndex = computed(() => {
      const end = props.currentPage * props.pageSize
      return end > props.total ? props.total : end
    })
    
    const pages = computed(() => {
      const pages = []
      const start = Math.max(1, props.currentPage - 2)
      const end = Math.min(totalPages.value, start + 4)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      return pages
    })
    
    return {
      totalPages,
      startIndex,
      endIndex,
      pages
    }
  }
}
</script>