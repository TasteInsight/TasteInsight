<template>
  <div class="overflow-auto">
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="py-3 px-6 text-left text-sm font-medium text-gray-500"
            :class="column.class"
          >
            {{ column.title }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        <tr
          v-for="item in paginatedData"
          :key="item.id"
          class="table-row hover:bg-gray-50 transition-colors"
        >
          <td v-for="column in columns" :key="column.key" class="py-4 px-6" :class="column.class">
            <slot :name="`cell-${column.key}`" :item="item" :value="item[column.key]">
              <!-- 默认渲染逻辑 -->
              <template v-if="column.type === 'image'">
                <div class="flex items-center">
                  <img
                    :src="getImageUrl(item[column.key])"
                    :alt="item.name"
                    class="w-12 h-12 rounded object-cover border mr-3"
                  />
                  <div>
                    <div class="font-medium">{{ item.name }}</div>
                    <div v-if="item.id" class="text-sm text-gray-500">#{{ item.id }}</div>
                  </div>
                </div>
              </template>

              <template v-else-if="column.type === 'status'">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="getStatusClass(item[column.key])"
                >
                  {{ getStatusText(item[column.key]) }}
                </span>
              </template>

              <template v-else-if="column.type === 'rating'">
                <div class="flex items-center">
                  <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                  <span class="ml-1">{{ item[column.key] }}</span>
                </div>
              </template>

              <template v-else-if="column.type === 'price'">
                <span class="text-tsinghua-purple font-medium">{{ item[column.key] }}</span>
              </template>

              <template v-else-if="column.type === 'actions'">
                <div class="flex justify-center space-x-2">
                  <button
                    v-if="actions.includes('edit')"
                    class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple transition-colors"
                    @click="$emit('edit', item)"
                    title="编辑"
                  >
                    <span class="iconify" data-icon="carbon:edit"></span>
                  </button>
                  <button
                    v-if="actions.includes('delete')"
                    class="p-2 rounded-full hover:bg-gray-200 text-red-500 transition-colors"
                    @click="$emit('delete', item)"
                    title="删除"
                  >
                    <span class="iconify" data-icon="carbon:trash-can"></span>
                  </button>
                  <button
                    v-if="actions.includes('view')"
                    class="p-2 rounded-full hover:bg-gray-200 text-blue-500 transition-colors"
                    @click="$emit('view', item)"
                    title="查看"
                  >
                    <span class="iconify" data-icon="carbon:view"></span>
                  </button>
                </div>
              </template>

              <template v-else>
                {{ item[column.key] }}
              </template>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 空状态 -->
    <div v-if="paginatedData.length === 0" class="text-center py-12 text-gray-500">
      <span class="iconify text-4xl mx-auto mb-3" data-icon="carbon:no-image"></span>
      <p>暂无数据</p>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'DishTable',
  props: {
    columns: {
      type: Array,
      required: true,
    },
    data: {
      type: Array,
      default: () => [],
    },
    actions: {
      type: Array,
      default: () => ['edit', 'delete', 'view'],
    },
    currentPage: {
      type: Number,
      default: 1,
    },
    pageSize: {
      type: Number,
      default: 10,
    },
    imageFallback: {
      type: String,
      default: '',
    },
  },
  emits: ['edit', 'delete', 'view'],
  setup(props) {
    const paginatedData = computed(() => {
      const page = Number.isFinite(props.currentPage) ? props.currentPage : 1
      const size = Number.isFinite(props.pageSize) ? props.pageSize : 10
      const start = Math.max(0, (page - 1) * size)
      return (props.data || []).slice(start, start + size)
    })

    const getImageUrl = (value) => {
      if (typeof value === 'string' && value.trim()) return value
      return props.imageFallback
    }

    const getStatusText = (value) => {
      if (value === true) return '启用'
      if (value === false) return '禁用'
      if (value == null) return ''
      return String(value)
    }

    const getStatusClass = (value) => {
      const text = getStatusText(value)
      if (
        value === true ||
        /^(启用|有效|已发布|已通过|上架|可用)$/i.test(text) ||
        /approved|enabled|active/i.test(text)
      ) {
        return 'bg-green-100 text-green-700'
      }

      if (/待|审核|pending/i.test(text)) {
        return 'bg-yellow-100 text-yellow-700'
      }

      if (!text) return 'bg-gray-100 text-gray-600'
      return 'bg-red-100 text-red-700'
    }

    return {
      paginatedData,
      getImageUrl,
      getStatusText,
      getStatusClass,
    }
  },
}
</script>
