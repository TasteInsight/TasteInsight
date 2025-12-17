<template>
  <div class="p-6 border-t border-gray-200 flex items-center justify-between">
    <div class="text-gray-500 text-sm">
      显示 {{ startIndex }}-{{ endIndex }} 条，共 {{ total }} 条记录
    </div>
    <div class="flex items-center space-x-2">
      <button
        class="px-3 py-1 border rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="currentPage === 1"
        @click="$emit('page-change', currentPage - 1)"
      >
        上一页
      </button>
      <button
        v-for="page in pages"
        :key="page"
        class="px-3 py-1 border rounded"
        :class="
          page === currentPage ? 'bg-tsinghua-purple text-white' : 'text-gray-500 hover:bg-gray-100'
        "
        @click="$emit('page-change', page)"
      >
        {{ page }}
      </button>
      <button
        class="px-3 py-1 border rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="currentPage === totalPages"
        @click="$emit('page-change', currentPage + 1)"
      >
        下一页
      </button>
      <div class="flex items-center space-x-1 ml-2 pl-2 border-l border-gray-300">
        <span class="text-sm text-gray-500">跳转到</span>
        <input
          type="number"
          :min="1"
          :max="totalPages"
          v-model.number="inputPage"
          @keyup.enter="handleJumpToPage"
          class="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-tsinghua-purple focus:border-tsinghua-purple"
          placeholder="页码"
        />
        <span class="text-sm text-gray-500">页</span>
        <button
          class="px-3 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200"
          @click="handleJumpToPage"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'

export default {
  name: 'Pagination',
  props: {
    currentPage: {
      type: Number,
      default: 1,
    },
    pageSize: {
      type: Number,
      default: 10,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  emits: ['page-change'],
  setup(props, { emit }) {
    const inputPage = ref(props.currentPage)

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

    const handleJumpToPage = () => {
      let page = inputPage.value
      if (!page || isNaN(page) || page < 1) {
        page = 1
      } else if (page > totalPages.value) {
        page = totalPages.value
      }
      inputPage.value = page
      emit('page-change', page)
    }

    // 当 currentPage 变化时，同步更新输入框的值
    watch(() => props.currentPage, (newPage) => {
      inputPage.value = newPage
    })

    return {
      totalPages,
      startIndex,
      endIndex,
      pages,
      inputPage,
      handleJumpToPage,
    }
  },
}
</script>
