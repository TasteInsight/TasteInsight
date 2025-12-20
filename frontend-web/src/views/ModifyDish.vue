<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="菜品管理"
        description="编辑和更新现有菜品信息"
        header-icon="clarity:note-edit-line"
      />

      <!-- 搜索和筛选区域 -->
      <div class="mb-6 space-y-4">
        <SearchBar
          v-model="searchQuery"
          placeholder="搜索菜品名称、标签..."
          :show-filter="false"
          @input="handleSearchChange"
          class="w-full"
        />

        <div class="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">所属食堂</span>
            <div class="relative">
              <select
                v-model="selectedCanteenId"
                @change="handleCanteenChange"
                class="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple/20 focus:border-tsinghua-purple bg-white text-sm min-w-[200px] transition-all cursor-pointer hover:border-gray-400"
              >
                <option value="">全部食堂</option>
                <option v-for="canteen in canteens" :key="canteen.id" :value="canteen.id">
                  {{ canteen.name }}
                </option>
              </select>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 flex items-center">
                <span class="iconify" data-icon="carbon:chevron-down"></span>
              </span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">所属窗口</span>
            <div class="relative">
              <select
                v-model="selectedWindowId"
                @change="handleWindowChange"
                class="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple/20 focus:border-tsinghua-purple bg-white text-sm min-w-[200px] transition-all cursor-pointer hover:border-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200"
                :disabled="!selectedCanteenId"
              >
                <option value="">全部窗口</option>
                <option v-for="window in windows" :key="window.id" :value="window.id">
                  {{ window.name }}
                </option>
              </select>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 flex items-center" :class="{'opacity-50': !selectedCanteenId}">
                <span class="iconify" data-icon="carbon:chevron-down"></span>
              </span>
            </div>
          </div>

          <div class="ml-auto flex items-center">
            <button
              v-if="selectedCanteenId || searchQuery"
              @click="resetFilters"
              class="text-sm text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-200/50 transition-colors"
            >
              <span class="iconify" data-icon="carbon:reset"></span>
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <!-- 菜品表格 -->
      <div class="overflow-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜品名称</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂/楼层</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">窗口</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">Tags</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">价格区间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评分</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="isLoading">
              <td colspan="7" class="py-8 text-center text-gray-500">
                <span
                  class="iconify inline-block text-2xl animate-spin"
                  data-icon="mdi:loading"
                ></span>
                <span class="ml-2">加载中...</span>
              </td>
            </tr>
            <tr v-else-if="filteredDishes.length === 0">
              <td colspan="7" class="py-8 text-center text-gray-500">暂无菜品数据</td>
            </tr>
            <tr v-else v-for="dish in filteredDishes" :key="dish.id" class="table-row">
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <img
                    :src="dish.image || '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'"
                    :alt="dish.name"
                    class="w-12 h-12 rounded object-cover border mr-3"
                  />
                  <div>
                    <div class="font-medium">{{ dish.name }}</div>
                    <div class="text-sm text-gray-500">#{{ dish.id }}</div>
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="font-medium">{{ dish.canteen }}</div>
                <div class="text-sm text-gray-500">{{ dish.floor }}</div>
              </td>
              <td class="py-4 px-6">{{ dish.window }}</td>
              <td class="py-4 px-6">{{ dish.cuisine }}</td>
              <td class="py-4 px-6 text-tsinghua-purple font-medium">{{ dish.price }}</td>
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                  <span class="ml-1">{{ dish.rating }}</span>
                </div>
              </td>
              <td class="py-4 px-6 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button
                    class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                    @click="viewDish(dish)"
                    title="查看"
                  >
                    <span class="iconify" data-icon="carbon:view"></span>
                  </button>
                  <button
                    class="p-2 rounded-full hover:bg-gray-200"
                    :class="authStore.hasPermission('dish:edit') ? 'text-tsinghua-purple' : 'text-gray-400 cursor-not-allowed'"
                    @click="editDish(dish)"
                    :title="!authStore.hasPermission('dish:edit') ? '无权限编辑' : '编辑'"
                  >
                    <span class="iconify" data-icon="carbon:edit"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalDishes"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { dishApi } from '@/api/modules/dish'
import { canteenApi } from '@/api/modules/canteen'
import { useDishStore } from '@/store/modules/use-dish-store'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import SearchBar from '@/components/Common/SearchBar.vue'
import Pagination from '@/components/Common/Pagination.vue'

export default {
  name: 'ModifyDish',
  components: {
    Header,
    SearchBar,
    Pagination,
  },
  setup() {
    const router = useRouter()
    const dishStore = useDishStore()
    const authStore = useAuthStore()
    const searchQuery = ref('')
    const showFilter = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const isLoading = ref(false)
    const dishes = ref([])
    const totalDishes = ref(0)
    
    // 筛选相关
    const canteens = ref([])
    const windows = ref([])
    const selectedCanteenId = ref('')
    const selectedWindowId = ref('')

    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }

    // 处理食堂变化
    const handleCanteenChange = async () => {
      selectedWindowId.value = '' // 重置窗口选择
      windows.value = [] // 清空窗口列表
      
      // 重新加载菜品
      currentPage.value = 1
      loadDishes()

      if (selectedCanteenId.value) {
        try {
          const response = await canteenApi.getWindows(selectedCanteenId.value, { page: 1, pageSize: 100 })
          if (response.code === 200 && response.data) {
            windows.value = response.data.items || []
          }
        } catch (error) {
          console.error('加载窗口列表失败:', error)
        }
      }
    }

    // 处理窗口变化
    const handleWindowChange = () => {
      currentPage.value = 1
      loadDishes()
    }

    // 加载菜品列表
    const loadDishes = async () => {
      isLoading.value = true
      try {
        const params = {
          page: currentPage.value,
          pageSize: pageSize.value,
          keyword: searchQuery.value || undefined,
          status: undefined, // 获取所有状态的菜品
        }
        
        // 添加筛选参数
        if (selectedCanteenId.value) {
          params.canteenId = selectedCanteenId.value
        }
        if (selectedWindowId.value) {
          params.windowId = selectedWindowId.value
        }

        const response = await dishApi.getDishes(params)

        if (response.code === 200 && response.data) {
          // 转换API数据格式
          dishes.value = response.data.items.map((item) => ({
            id: item.id,
            name: item.name || '',
            canteen: item.canteenName || '',
            floor: item.floorName || item.floor || '',
            window: item.windowName || item.windowNumber || '',
            cuisine: item.tags && item.tags.length > 0 ? item.tags.join(', ') : '无',
            price: item.price ? `¥${item.price}` : '¥0',
            rating: item.averageRating || 0,
            image: item.images && item.images.length > 0 ? item.images[0] : '',
          }))
          totalDishes.value = response.data.meta?.total || 0
        } else {
          // API失败时使用空数组
          dishes.value = []
          totalDishes.value = 0
        }
      } catch (error) {
        console.error('加载菜品列表失败:', error)
        // API失败时使用空数组
        dishes.value = []
        totalDishes.value = 0
      } finally {
        isLoading.value = false
      }
    }

    const filteredDishes = computed(() => {
      let filtered = dishes.value

      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(
          (dish) =>
            dish.name.toLowerCase().includes(query) ||
            dish.canteen.toLowerCase().includes(query) ||
            dish.window.toLowerCase().includes(query) ||
            dish.cuisine.toLowerCase().includes(query),
        )
      }

      return filtered
    })

    const viewDish = (dish) => {
      // 跳转到查看页面
      router.push(`/view-dish/${dish.id}`)
    }

    const editDish = (dish) => {
      if (!authStore.hasPermission('dish:edit')) {
        alert('您没有权限编辑菜品')
        return
      }
      // 跳转到编辑页面
      router.push(`/edit-dish/${dish.id}`)
    }

    const handlePageChange = (page) => {
      currentPage.value = page
      loadDishes()
    }

    // 监听搜索查询变化，延迟加载
    let searchTimeout = null
    const handleSearchChange = () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
      searchTimeout = setTimeout(() => {
        currentPage.value = 1 // 重置到第一页
        loadDishes()
      }, 500) // 500ms防抖
    }

    onMounted(() => {
      loadCanteens()
      loadDishes()
    })

    onActivated(() => {
      // 如果有选中的食堂，确保重新加载窗口列表，防止状态丢失
      if (selectedCanteenId.value && windows.value.length === 0) {
        canteenApi.getWindows(selectedCanteenId.value, { page: 1, pageSize: 100 })
          .then(res => {
            if (res.code === 200 && res.data) {
              windows.value = res.data.items || []
            }
          })
          .catch(err => console.error('恢复窗口列表失败:', err))
      }
      loadDishes()
    })

    onBeforeUnmount(() => {
      if (window.__modifyDish_clickLogger) {
        window.removeEventListener('click', window.__modifyDish_clickLogger, true)
        delete window.__modifyDish_clickLogger
      }
    })

    const resetFilters = () => {
      searchQuery.value = ''
      selectedCanteenId.value = ''
      selectedWindowId.value = ''
      windows.value = []
      currentPage.value = 1
      loadDishes()
    }

    return {
      searchQuery,
      showFilter,
      currentPage,
      pageSize,
      isLoading,
      filteredDishes,
      totalDishes,
      viewDish,
      editDish,
      handlePageChange,
      handleSearchChange,
      loadDishes,
      authStore,
      canteens,
      windows,
      selectedCanteenId,
      selectedWindowId,
      handleCanteenChange,
      handleWindowChange,
      resetFilters,
    }
  },
}
</script>
