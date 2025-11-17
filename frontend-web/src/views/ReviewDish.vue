<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen">
        <div class="bg-white rounded-lg container-shadow">
          <Header 
            title="菜品审核" 
            description="审核待上线的菜品信息"
            header-icon="carbon:task-approved"
          />
          
          <!-- 筛选区域 -->
          <div class="p-6 bg-gray-50 border-b">
            <div class="flex items-center space-x-4">
              <div class="relative">
                <input 
                  type="text" 
                  placeholder="搜索菜品名称..." 
                  class="w-64 px-4 pl-10 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                  v-model="searchQuery"
                >
                <span class="iconify text-gray-400 absolute left-3 top-2.5" data-icon="bx:search"></span>
              </div>
              <select 
                class="px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                v-model="statusFilter"
              >
                <option value="">所有状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
              <select 
                class="px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                v-model="canteenFilter"
              >
                <option value="">所有食堂</option>
                <option>紫荆园</option>
                <option>桃李园</option>
                <option>丁香园</option>
                <option>清芬园</option>
                <option>听涛园</option>
              </select>
            </div>
          </div>
          
          <!-- 审核表格 -->
          <div class="overflow-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜品信息</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交时间</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交人</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
                  <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr 
                  v-for="dish in filteredReviewDishes" 
                  :key="dish.id"
                  class="table-row cursor-pointer hover:bg-gray-50"
                  @click="viewDishDetail(dish)"
                >
                  <td class="py-4 px-6">
                    <div class="flex items-center">
                      <img 
                        :src="dish.image || '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'" 
                        :alt="dish.name"
                        class="w-12 h-12 rounded object-cover border mr-3"
                      >
                      <div>
                        <div class="font-medium">{{ dish.name }}</div>
                        <div class="text-sm text-gray-500">{{ dish.location }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-6">
                    <div class="font-medium">{{ dish.submitDate }}</div>
                    <div class="text-sm text-gray-500">{{ dish.submitTime }}</div>
                  </td>
                  <td class="py-4 px-6">{{ dish.submitter }}</td>
                  <td class="py-4 px-6">
                    <span 
                      class="px-2 py-1 rounded-full text-xs font-medium"
                      :class="statusClasses[dish.status]"
                    >
                      {{ statusText[dish.status] }}
                    </span>
                  </td>
                  <td class="py-4 px-6 text-center" @click.stop>
                    <button 
                      class="px-3 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200"
                      :class="{ 'bg-gray-200 text-gray-700 hover:bg-gray-300': dish.status === 'approved' }"
                      @click="reviewDish(dish)"
                    >
                      {{ dish.status === 'rejected' ? '重新审核' : dish.status === 'approved' ? '已审核' : '审核' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <Pagination 
            :current-page="currentPage"
            :page-size="pageSize"
            :total="filteredReviewDishes.length"
            @page-change="handlePageChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from '@/components/Layout/Sidebar.vue';
import Header from '@/components/Layout/Header.vue';
import Pagination from '@/components/Common/Pagination.vue'

export default {
  name: 'ReviewDish',
  components: {
    Sidebar,
    Header,
    Pagination
  },
  setup() {
    const router = useRouter()
    const searchQuery = ref('')
    const statusFilter = ref('')
    const canteenFilter = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    
    // 模拟审核数据
    const reviewDishes = ref([
      {
        id: 1,
        name: '水煮肉片',
        location: '观畴园-二层-自选菜',
        submitDate: '2025-10-20',
        submitTime: '14:23:45',
        submitter: '张师傅',
        status: 'pending',
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      {
        id: 2,
        name: '辛拉面',
        location: '桃李园-一层-韩国风味',
        submitDate: '2025-10-20',
        submitTime: '11:15:32',
        submitter: 'NoraexX',
        status: 'approved',
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      {
        id: 3,
        name: '宜宾燃面',
        location: '清芬园一层',
        submitDate: '2025-10-20',
        submitTime: '16:45:21',
        submitter: '某不愿透露姓名的曾姓男子',
        status: 'rejected',
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      {
        id: 4,
        name: '菠萝咕咾肉',
        location: '观畴园-二层-自选菜',
        submitDate: '2025-10-20',
        submitTime: '09:32:17',
        submitter: 'ljx666',
        status: 'pending',
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      }
    ])
    
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    
    const statusText = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    }
    
    const filteredReviewDishes = computed(() => {
      let filtered = reviewDishes.value
      
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(dish => 
          dish.name.toLowerCase().includes(query) ||
          dish.location.toLowerCase().includes(query) ||
          dish.submitter.toLowerCase().includes(query)
        )
      }
      
      if (statusFilter.value) {
        filtered = filtered.filter(dish => dish.status === statusFilter.value)
      }
      
      if (canteenFilter.value) {
        filtered = filtered.filter(dish => dish.location.includes(canteenFilter.value))
      }
      
      return filtered
    })
    
    const viewDishDetail = (dish) => {
      // 跳转到审核详情页面
      router.push(`/review-dish/${dish.id}`)
    }
    
    const reviewDish = (dish) => {
      // 跳转到审核详情页面
      router.push(`/review-dish/${dish.id}`)
    }
    
    const handlePageChange = (page) => {
      currentPage.value = page
    }
    
    return {
      searchQuery,
      statusFilter,
      canteenFilter,
      currentPage,
      pageSize,
      filteredReviewDishes,
      statusClasses,
      statusText,
      reviewDish,
      handlePageChange
    }
  }
}
</script>