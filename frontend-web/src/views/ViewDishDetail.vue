<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8 relative">
          <!-- 关闭按钮 -->
          <button
            @click="goBack"
            class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition p-2"
            title="关闭"
          >
            <span class="iconify text-2xl" data-icon="carbon:close"></span>
          </button>
          
          <Header 
            title="菜品详情" 
            description="查看菜品信息和评论"
            header-icon="carbon:view"
          />
          
          <div v-if="isLoading" class="flex justify-center items-center py-20">
            <div class="text-gray-500">加载中...</div>
          </div>
          
          <div v-else class="space-y-6 mt-6">
            <!-- 菜品信息部分 -->
            <div class="grid grid-cols-2 gap-6">
              <!-- 左侧列 -->
              <div>
                <!-- 食堂信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">食堂信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">食堂名称</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.canteenName || dishData.canteen || '未填写' }}
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">食堂楼层</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.floor || '未填写' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 窗口信息 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">窗口信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">窗口名称</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.windowName || dishData.window || '未填写' }}
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">窗口编号</label>
                      <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                        {{ dishData.windowNumber || '未填写' }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 菜品名称 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品名称</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 font-medium">
                    {{ dishData.name || '未填写' }}
                  </div>
                </div>
                
                <!-- 菜品价格 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品价格（元）</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 font-medium text-tsinghua-purple">
                    ¥{{ dishData.price !== null && dishData.price !== undefined ? dishData.price.toFixed(2) : '0.00' }}
                  </div>
                </div>
                
                <!-- 菜品描述 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品描述</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 min-h-[100px] max-h-[200px] overflow-y-auto">
                    {{ dishData.description || '未填写' }}
                  </div>
                </div>
                
                <!-- 菜品图片 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">菜品图片</label>
                  <div class="border-2 border-dashed rounded-lg h-48 flex items-center justify-center bg-gray-50 overflow-hidden">
                    <img 
                      v-if="dishImage" 
                      :src="dishImage" 
                      alt="菜品图片"
                      class="w-full h-full object-cover"
                    >
                    <div v-else class="text-center p-6">
                      <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
                      <div class="mt-2 text-gray-500">暂无图片</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 右侧列 -->
              <div>
                <!-- 菜品子项 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品子项</label>
                  <div class="space-y-2">
                    <div 
                      v-for="(item, index) in dishData.subItems" 
                      :key="index"
                      class="flex items-center justify-between px-4 py-2 border rounded-lg bg-gray-50"
                    >
                      <span class="text-gray-700">{{ item.name || '未命名' }}</span>
                      <span class="text-tsinghua-purple font-medium">{{ item.price ? `¥${item.price}` : '未定价' }}</span>
                    </div>
                    <div v-if="!dishData.subItems || dishData.subItems.length === 0" class="px-4 py-2 border rounded-lg bg-gray-50 text-gray-500">
                      暂无子项
                    </div>
                  </div>
                </div>
                
                <!-- 供应信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应信息</label>
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">菜系TAG</label>
                      <div v-if="dishData.tags && dishData.tags.length > 0" class="flex flex-wrap gap-2">
                        <span 
                          v-for="(tag, index) in dishData.tags" 
                          :key="index"
                          class="inline-flex items-center px-3 py-1 bg-tsinghua-purple/10 text-tsinghua-purple rounded-full text-sm"
                        >
                          #{{ tag }}
                        </span>
                      </div>
                      <div v-else class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500">
                        未设置TAG
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">口味指标</label>
                      <div class="grid grid-cols-4 gap-3">
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">辣度</label>
                          <div class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {{ dishData.spicyLevel !== null && dishData.spicyLevel !== undefined ? dishData.spicyLevel : 0 }}
                          </div>
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">咸度</label>
                          <div class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {{ dishData.saltiness !== null && dishData.saltiness !== undefined ? dishData.saltiness : 0 }}
                          </div>
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">甜度</label>
                          <div class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {{ dishData.sweetness !== null && dishData.sweetness !== undefined ? dishData.sweetness : 0 }}
                          </div>
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">油度</label>
                          <div class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700 text-sm">
                            {{ dishData.oiliness !== null && dishData.oiliness !== undefined ? dishData.oiliness : 0 }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 供应时间 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应时间</label>
                  <div class="space-y-2">
                    <div class="flex items-center">
                      <span 
                        class="iconify mr-2"
                        :class="dishData.availableMealTime && dishData.availableMealTime.includes('breakfast') ? 'text-tsinghua-purple' : 'text-gray-300'"
                        data-icon="carbon:checkmark"
                      ></span>
                      <span :class="dishData.availableMealTime && dishData.availableMealTime.includes('breakfast') ? 'text-gray-700' : 'text-gray-400'">早餐</span>
                    </div>
                    <div class="flex items-center">
                      <span 
                        class="iconify mr-2"
                        :class="dishData.availableMealTime && dishData.availableMealTime.includes('lunch') ? 'text-tsinghua-purple' : 'text-gray-300'"
                        data-icon="carbon:checkmark"
                      ></span>
                      <span :class="dishData.availableMealTime && dishData.availableMealTime.includes('lunch') ? 'text-gray-700' : 'text-gray-400'">午餐</span>
                    </div>
                    <div class="flex items-center">
                      <span 
                        class="iconify mr-2"
                        :class="dishData.availableMealTime && dishData.availableMealTime.includes('dinner') ? 'text-tsinghua-purple' : 'text-gray-300'"
                        data-icon="carbon:checkmark"
                      ></span>
                      <span :class="dishData.availableMealTime && dishData.availableMealTime.includes('dinner') ? 'text-gray-700' : 'text-gray-400'">晚餐</span>
                    </div>
                    <div class="flex items-center">
                      <span 
                        class="iconify mr-2"
                        :class="dishData.availableMealTime && dishData.availableMealTime.includes('nightsnack') ? 'text-tsinghua-purple' : 'text-gray-300'"
                        data-icon="carbon:checkmark"
                      ></span>
                      <span :class="dishData.availableMealTime && dishData.availableMealTime.includes('nightsnack') ? 'text-gray-700' : 'text-gray-400'">夜宵</span>
                    </div>
                  </div>
                </div>
                
                <!-- 供应日期段 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应日期段</label>
                  <div v-if="dishData.availableDates && dishData.availableDates.length > 0" class="space-y-2">
                    <div 
                      v-for="(dateRange, index) in dishData.availableDates" 
                      :key="index"
                      class="px-4 py-2 border rounded-lg bg-gray-50 text-gray-700"
                    >
                      {{ dateRange.startDate }} 至 {{ dateRange.endDate }}
                    </div>
                  </div>
                  <div v-else class="px-4 py-2 border rounded-lg bg-gray-50 text-gray-500">
                    未设置供应日期段
                  </div>
                </div>
                
                <!-- 过敏原 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">过敏原</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ allergensText || '未填写' }}
                  </div>
                </div>
                
                <!-- 原辅料 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">原辅料</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ ingredientsText || '未填写' }}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 评论部分 -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-800">菜品评论</h3>
                <div v-if="reviewsData.rating" class="flex items-center gap-2">
                  <span class="text-sm text-gray-600">平均评分：</span>
                  <div class="flex items-center">
                    <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                    <span class="ml-1 font-medium text-gray-800">{{ reviewsData.rating.average.toFixed(1) }}</span>
                    <span class="ml-2 text-sm text-gray-500">({{ reviewsData.rating.total }}条评论)</span>
                  </div>
                </div>
              </div>
              
              <!-- 评论筛选 -->
              <div class="mb-4 flex items-center gap-3">
                <label class="text-sm text-gray-600">筛选状态：</label>
                <select 
                  v-model="reviewStatusFilter"
                  @change="loadReviews"
                  class="px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                >
                  <option value="">全部</option>
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </div>
              
              <!-- 评论列表 -->
              <div v-if="isLoadingReviews" class="flex justify-center items-center py-10">
                <div class="text-gray-500">加载评论中...</div>
              </div>
              
              <div v-else-if="reviewsData.items && reviewsData.items.length > 0" class="space-y-4">
                <div 
                  v-for="review in reviewsData.items" 
                  :key="review.id"
                  class="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div class="flex items-start gap-4">
                    <!-- 用户头像 -->
                    <div class="flex-shrink-0">
                      <img 
                        v-if="review.userAvatar" 
                        :src="review.userAvatar" 
                        :alt="review.userNickname"
                        class="w-12 h-12 rounded-full object-cover"
                      >
                      <div v-else class="w-12 h-12 rounded-full bg-tsinghua-purple/20 flex items-center justify-center">
                        <span class="iconify text-tsinghua-purple text-xl" data-icon="carbon:user"></span>
                      </div>
                    </div>
                    
                    <!-- 评论内容 -->
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-gray-800">{{ review.userNickname || '匿名用户' }}</span>
                          <div class="flex items-center">
                            <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                            <span class="ml-1 text-sm text-gray-600">{{ review.rating }}</span>
                          </div>
                        </div>
                        <span 
                          class="px-2 py-1 rounded-full text-xs font-medium"
                          :class="{
                            'bg-yellow-100 text-yellow-800': review.status === 'pending',
                            'bg-green-100 text-green-800': review.status === 'approved',
                            'bg-red-100 text-red-800': review.status === 'rejected'
                          }"
                        >
                          {{ review.status === 'pending' ? '待审核' : review.status === 'approved' ? '已通过' : '已拒绝' }}
                        </span>
                      </div>
                      
                      <p class="text-gray-700 mb-3">{{ review.content }}</p>
                      
                      <!-- 评论图片 -->
                      <div v-if="review.images && review.images.length > 0" class="flex gap-2 mb-3">
                        <img 
                          v-for="(img, index) in review.images" 
                          :key="index"
                          :src="img" 
                          alt="评论图片"
                          class="w-20 h-20 rounded object-cover cursor-pointer hover:opacity-80"
                          @click="previewImage(img)"
                        >
                      </div>
                      
                      <div class="text-sm text-gray-500">
                        {{ formatDate(review.createdAt) }}
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 分页 -->
                <div v-if="reviewsData.meta && reviewsData.meta.totalPages > 1" class="flex justify-center mt-6">
                  <div class="flex items-center gap-2">
                    <button 
                      @click="changeReviewPage(currentReviewPage - 1)"
                      :disabled="currentReviewPage <= 1"
                      class="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <span class="px-4 py-2 text-sm text-gray-600">
                      第 {{ currentReviewPage }} / {{ reviewsData.meta.totalPages }} 页
                    </span>
                    <button 
                      @click="changeReviewPage(currentReviewPage + 1)"
                      :disabled="currentReviewPage >= reviewsData.meta.totalPages"
                      class="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-10 text-gray-500">
                暂无评论
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { dishApi } from '@/api/modules/dish'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'ViewDishDetail',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const dishId = route.params.id
    const isLoading = ref(false)
    const isLoadingReviews = ref(false)
    const reviewStatusFilter = ref('')
    const currentReviewPage = ref(1)
    const reviewPageSize = ref(10)
    
    const dishData = reactive({
      id: '',
      name: '',
      canteenName: '',
      canteen: '',
      floor: '',
      windowName: '',
      window: '',
      windowNumber: '',
      price: 0,
      description: '',
      allergens: [],
      ingredients: [],
      images: [],
      tags: [],
      spicyLevel: 0,
      saltiness: 0,
      sweetness: 0,
      oiliness: 0,
      availableMealTime: [],
      availableDates: [],
      subItems: []
    })
    
    const reviewsData = reactive({
      items: [],
      meta: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
      },
      rating: {
        average: 0,
        total: 0,
        detail: {}
      }
    })
    
    // 计算属性：菜品图片
    const dishImage = computed(() => {
      if (dishData.images && dishData.images.length > 0) {
        return dishData.images[0]
      }
      return null
    })
    
    // 计算属性：过敏原文本
    const allergensText = computed(() => {
      if (Array.isArray(dishData.allergens)) {
        return dishData.allergens.join('、')
      }
      return dishData.allergens || ''
    })
    
    // 计算属性：原辅料文本
    const ingredientsText = computed(() => {
      if (Array.isArray(dishData.ingredients)) {
        return dishData.ingredients.join('、')
      }
      return dishData.ingredients || ''
    })
    
    // 加载菜品信息
    const loadDishData = async () => {
      isLoading.value = true
      try {
        const response = await dishApi.getDishById(dishId)
        
        if (response.code === 200 && response.data) {
          const dish = response.data
          Object.assign(dishData, {
            id: dish.id || dishId,
            name: dish.name || '',
            canteenName: dish.canteenName || dish.canteen || '',
            canteen: dish.canteen || '',
            floor: dish.floor || '',
            windowName: dish.windowName || dish.window || '',
            window: dish.window || '',
            windowNumber: dish.windowNumber || '',
            price: dish.price !== null && dish.price !== undefined ? dish.price : 0,
            description: dish.description || '',
            allergens: Array.isArray(dish.allergens) ? dish.allergens : (dish.allergens ? [dish.allergens] : []),
            ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : (dish.ingredients ? [dish.ingredients] : []),
            images: dish.images || [],
            tags: dish.tags || [],
            spicyLevel: dish.spicyLevel !== null && dish.spicyLevel !== undefined ? dish.spicyLevel : 0,
            saltiness: dish.saltiness !== null && dish.saltiness !== undefined ? dish.saltiness : 0,
            sweetness: dish.sweetness !== null && dish.sweetness !== undefined ? dish.sweetness : 0,
            oiliness: dish.oiliness !== null && dish.oiliness !== undefined ? dish.oiliness : 0,
            availableMealTime: dish.availableMealTime || [],
            availableDates: dish.availableDates || [],
            subItems: dish.subItems || []
          })
        } else {
          throw new Error(response.message || '获取菜品信息失败')
        }
      } catch (error) {
        console.error('获取菜品信息失败:', error)
        alert('获取菜品信息失败，请重试')
        router.push('/modify-dish')
      } finally {
        isLoading.value = false
      }
    }
    
    // 加载评论列表
    const loadReviews = async () => {
      isLoadingReviews.value = true
      try {
        const params = {
          page: currentReviewPage.value,
          pageSize: reviewPageSize.value
        }
        if (reviewStatusFilter.value) {
          params.status = reviewStatusFilter.value
        }
        
        const response = await dishApi.getDishReviews(dishId, params)
        
        if (response.code === 200 && response.data) {
          Object.assign(reviewsData, response.data)
        } else {
          throw new Error(response.message || '获取评论失败')
        }
      } catch (error) {
        console.error('获取评论失败:', error)
        // 不显示错误提示，只清空数据
        reviewsData.items = []
        reviewsData.meta = {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0
        }
        reviewsData.rating = {
          average: 0,
          total: 0,
          detail: {}
        }
      } finally {
        isLoadingReviews.value = false
      }
    }
    
    // 切换评论页码
    const changeReviewPage = (page) => {
      if (page >= 1 && page <= reviewsData.meta.totalPages) {
        currentReviewPage.value = page
        loadReviews()
      }
    }
    
    // 预览图片
    const previewImage = (imgUrl) => {
      window.open(imgUrl, '_blank')
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const goBack = () => {
      router.push('/modify-dish')
    }
    
    onMounted(() => {
      loadDishData()
      loadReviews()
    })
    
    return {
      dishData,
      reviewsData,
      isLoading,
      isLoadingReviews,
      reviewStatusFilter,
      currentReviewPage,
      dishImage,
      allergensText,
      ingredientsText,
      loadReviews,
      changeReviewPage,
      previewImage,
      formatDate,
      goBack
    }
  }
}
</script>

