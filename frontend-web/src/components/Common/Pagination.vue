<template>
  <nav class="admin-pagination" :aria-label="label">
    <div class="text-gray-500 text-sm">
      显示 {{ startIndex }}-{{ endIndex }} 条，共 {{ total }} 条记录
    </div>
    <div class="admin-pagination-controls" role="group" aria-label="分页操作">
      <button type="button" class="admin-button admin-button-compact admin-button-secondary"
        :disabled="disabled || total === 0 || currentPage <= 1" @click="$emit('page-change', currentPage - 1)">
        上一页
      </button>
      <button v-for="page in pages" :key="page" type="button"
        :aria-current="page === currentPage ? 'page' : undefined" :aria-label="`第 ${page} 页`"
        :disabled="disabled" class="admin-button admin-button-compact admin-page-number"
        :class="page === currentPage ? 'admin-button-primary' : 'admin-button-secondary'"
        @click="$emit('page-change', page)">
        {{ page }}
      </button>
      <button type="button" class="admin-button admin-button-compact admin-button-secondary"
        :disabled="disabled || total === 0 || currentPage >= totalPages" @click="$emit('page-change', currentPage + 1)">
        下一页
      </button>
      <div v-if="showJump" class="admin-pagination-jump">
        <span>跳转到</span>
        <input type="number" :min="1" :max="totalPages" :disabled="disabled || total === 0"
          v-model.number="inputPage" @keyup.enter="handleJumpToPage"
          class="admin-input" placeholder="页码" aria-label="跳转页码" />
        <span>页</span>
        <button type="button" class="admin-button admin-button-compact admin-button-primary"
          :disabled="disabled || total === 0" @click="handleJumpToPage">确定</button>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed, ref, watch } from 'vue'

export default {
  name: 'Pagination',
  props: {
    label: { type: String, default: '分页' },
    showJump: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
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
      if (props.disabled || props.total === 0) return
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
