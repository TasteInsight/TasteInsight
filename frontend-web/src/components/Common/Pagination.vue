<template>
  <nav class="admin-pagination" aria-label="分页">
    <div class="text-gray-500 text-sm">
      显示 {{ startIndex }}-{{ endIndex }} 条，共 {{ total }} 条记录
    </div>
    <div class="admin-pagination-controls">
      <button
        class="border text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-compact"
        :disabled="total === 0 || currentPage <= 1"
        @click="$emit('page-change', currentPage - 1)"
      >
        上一页
      </button>
      <button
        v-for="page in pages"
        :key="page"
        :aria-current="page === currentPage ? 'page' : undefined"
        :aria-label="`第 ${page} 页`"
        class="border admin-button admin-button-compact"
        :class="
          page === currentPage ? 'bg-tsinghua-purple text-white' : 'text-gray-500 hover:bg-gray-100'
        "
        @click="$emit('page-change', page)"
      >
        {{ page }}
      </button>
      <button
        class="border text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-compact"
        :disabled="total === 0 || currentPage >= totalPages"
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
          :disabled="total === 0"
          v-model.number="inputPage"
          @keyup.enter="handleJumpToPage"
          class="w-16 text-center admin-input"
          placeholder="页码"
          aria-label="跳转页码"
        />
        <span class="text-sm text-gray-500">页</span>
        <button
          class="transition duration-200 admin-button admin-button-compact admin-button-primary"
          :disabled="total === 0"
          @click="handleJumpToPage"
        >
          确定
        </button>
      </div>
    </div>
  </nav>
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

    const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

    const startIndex = computed(() => props.total === 0 ? 0 : (props.currentPage - 1) * props.pageSize + 1)

    const endIndex = computed(() => {
      const end = props.currentPage * props.pageSize
      return end > props.total ? props.total : end
    })

    const pages = computed(() => {
      if (props.total === 0) return []
      const pages = []
      const start = Math.max(1, props.currentPage - 2)
      const end = Math.min(totalPages.value, start + 4)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      return pages
    })

    const handleJumpToPage = () => {
      if (props.total === 0) return
      const requestedPage = Math.trunc(Number(inputPage.value))
      const page = Number.isFinite(requestedPage)
        ? Math.min(totalPages.value, Math.max(1, requestedPage))
        : 1
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
