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
          <td 
            v-for="column in columns" 
            :key="column.key"
            class="py-4 px-6"
            :class="column.class"
          >
            <slot :name="`cell-${column.key}`" :item="item" :value="item[column.key]">
              <!-- 默认渲染逻辑 -->
              <template v-if="column.type === 'image'">
                <div class="flex items-center">
                  <img 
                    :src="getImageUrl(item[column.key])" 
                    :alt="item.name"
                    class="w-12 h-12 rounded object-cover border mr-3"
                  >
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
    <div 
      v-if="paginatedData.length === 0" 
      class="text-center py-12 text-gray-500"
    >
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
    data: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      required: true
    },
    actions: {
      type: Array,
      default: () => ['edit', 'delete']
    },
    currentPage: {
      type: Number,
      default: 1
    },
    pageSize: {
      type: Number,
      default: 10
    }
  },
  emits: ['edit', 'delete', 'view'],
  setup(props) {
    const statusConfig = {
      pending: { class: 'bg-yellow-100 text-yellow-800', text: '待审核' },
      approved: { class: 'bg-green-100 text-green-800', text: '已通过' },
      rejected: { class: 'bg-red-100 text-red-800', text: '已拒绝' },
      active: { class: 'bg-blue-100 text-blue-800', text: '有效' },
      inactive: { class: 'bg-gray-100 text-gray-800', text: '无效' }
    }
    
    const paginatedData = computed(() => {
      const start = (props.currentPage - 1) * props.pageSize
      const end = start + props.pageSize
      return props.data.slice(start, end)
    })
    
    const getImageUrl = (url) => {
      return url || '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
    }
    
    const getStatusClass = (status) => {
      return statusConfig[status]?.class || 'bg-gray-100 text-gray-800'
    }
    
    const getStatusText = (status) => {
      return statusConfig[status]?.text || status
    }
    
    return {
      paginatedData,
      getImageUrl,
      getStatusClass,
      getStatusText
    }
  }
}
</script>