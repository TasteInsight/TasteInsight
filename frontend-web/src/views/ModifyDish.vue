<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 h-full overflow-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 h-full">
        <div class="bg-white rounded-lg container-shadow">
          <Header 
            title="菜品管理" 
            description="编辑和更新现有菜品信息"
            header-icon="clarity:note-edit-line"
          />
          
          <SearchBar 
            v-model="searchQuery"
            placeholder="搜索菜品名称、食堂、窗口..."
            :show-filter="true"
            @filter="showFilter = true"
          />
          
          <!-- 菜品表格 -->
          <div class="overflow-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜品名称</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂/楼层</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">窗口</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜系</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">价格区间</th>
                  <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评分</th>
                  <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr 
                  v-for="dish in filteredDishes" 
                  :key="dish.id"
                  class="table-row"
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
                    <button 
                      class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                      @click="editDish(dish)"
                    >
                      <span class="iconify" data-icon="carbon:edit"></span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <Pagination 
            :current-page="currentPage"
            :page-size="pageSize"
            :total="filteredDishes.length"
            @page-change="handlePageChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDishStore } from '@/store/modules/use-dish-store';
import Sidebar from '@/components/Layout/Sidebar.vue';
import Header from '@/components/Layout/Header.vue';
import SearchBar from '@/components/Common/SearchBar.vue';
import Pagination from '@/components/Common/Pagination.vue'

export default {
  name: 'ModifyDish',
  components: {
    Sidebar,
    Header,
    SearchBar,
    Pagination
  },
  setup() {
    const router = useRouter()
    const dishStore = useDishStore()
    const searchQuery = ref('')
    const showFilter = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    
    // 模拟数据
    const sampleDishes = [
      { 
        id: 'FD0123', 
        name: '海南椰子鸡', 
        canteen: '紫荆园', 
        floor: '二层',
        window: '海南鸡饭窗口',
        cuisine: '琼菜',
        price: '¥15',
        rating: 4.7,
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      { 
        id: 'FD0124', 
        name: '芹菜炒肉丝', 
        canteen: '桃李园', 
        floor: '二层',
        window: '自选菜',
        cuisine: '无',
        price: '¥6',
        rating: 4.5,
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      { 
        id: 'FD0125', 
        name: '辛拉面', 
        canteen: '桃李园', 
        floor: '一层',
        window: '韩式风味',
        cuisine: '韩国菜',
        price: '¥10',
        rating: 4.8,
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      },
      { 
        id: 'FD0126', 
        name: '红烧牛肉面', 
        canteen: '清青牛拉', 
        floor: '二层',
        window: '清青牛拉',
        cuisine: '陇菜',
        price: '¥22',
        rating: 4.6,
        image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'
      }
    ]
    
    const filteredDishes = computed(() => {
      let filtered = sampleDishes
      
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(dish => 
          dish.name.toLowerCase().includes(query) ||
          dish.canteen.toLowerCase().includes(query) ||
          dish.window.toLowerCase().includes(query)
        )
      }
      
      return filtered
    })
    
    const editDish = (dish) => {
      // 跳转到编辑页面
      router.push(`/edit-dish/${dish.id}`)
    }
    
    const handlePageChange = (page) => {
      currentPage.value = page
    }
    
    onMounted(() => {
      // 初始化时可以将示例数据添加到store
      sampleDishes.forEach(dish => {
        dishStore.addDish(dish)
      })
    })
    
    return {
      searchQuery,
      showFilter,
      currentPage,
      pageSize,
      filteredDishes,
      editDish,
      handlePageChange
    }
  }
}
</script>