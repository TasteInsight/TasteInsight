<template>
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
            title="菜品审核详情" 
            description="查看菜品信息并决定是否通过审核"
            header-icon="carbon:task-approved"
          />
          
          <div class="space-y-6 mt-6">
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
                        {{ dishData.canteen || '未填写' }}
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
                  
                  <div v-if="dishData.images && dishData.images.length > 0">
                    <!-- 主图展示 -->
                    <div class="border-2 rounded-lg aspect-square w-full relative flex items-center justify-center bg-gray-50 overflow-hidden mb-4">
                    <img 
                        :src="selectedImage || dishData.images[0]" 
                      alt="菜品图片"
                        class="w-full h-full object-cover cursor-pointer"
                        @click="previewImage(selectedImage || dishData.images[0])"
                    >
                    </div>
                    
                    <!-- 缩略图列表 -->
                    <div class="flex gap-2 overflow-x-auto pb-2">
                      <div 
                        v-for="(img, index) in dishData.images" 
                        :key="index"
                        class="w-20 h-20 flex-shrink-0 border-2 rounded-lg overflow-hidden cursor-pointer transition-all"
                        :class="{'border-tsinghua-purple': (selectedImage || dishData.images[0]) === img, 'border-transparent': (selectedImage || dishData.images[0]) !== img}"
                        @mouseenter="selectedImage = img"
                        @mouseleave="selectedImage = ''"
                      >
                        <img :src="img" class="w-full h-full object-cover">
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="border-2 border-dashed rounded-lg h-48 flex items-center justify-center bg-gray-50 overflow-hidden">
                    <div class="text-center p-6">
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
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.breakfast ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.breakfast ? 'text-gray-700' : 'text-gray-400'">早餐</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.lunch ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.lunch ? 'text-gray-700' : 'text-gray-400'">午餐</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.dinner ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.dinner ? 'text-gray-700' : 'text-gray-400'">晚餐</span>
                    </div>
                    <div class="flex items-center px-4 py-2 border rounded-lg bg-gray-50">
                      <span class="iconify mr-2" :class="dishData.servingTime?.night ? 'text-green-500' : 'text-gray-300'" data-icon="carbon:checkmark"></span>
                      <span :class="dishData.servingTime?.night ? 'text-gray-700' : 'text-gray-400'">夜宵</span>
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
                    {{ dishData.allergens || '未填写' }}
                  </div>
                </div>
                
                <!-- 原辅料 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">原辅料</label>
                  <div class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {{ dishData.ingredients || '未填写' }}
                  </div>
                </div>
                
                <!-- 提交信息 -->
                <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div class="text-sm text-gray-600 mb-2">提交信息</div>
                  <div class="space-y-1 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">提交人：</span>
                      <span class="text-gray-800 font-medium">{{ dishData.submitter || '未知' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">提交时间：</span>
                      <span class="text-gray-800">{{ dishData.submitDate || '' }} {{ dishData.submitTime || '' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">当前状态：</span>
                      <span 
                        class="px-2 py-1 rounded-full text-xs font-medium"
                        :class="statusClasses[dishData.status]"
                      >
                        {{ statusText[dishData.status] }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 审核操作按钮 -->
            <div class="flex space-x-4 pt-6 border-t border-gray-200">
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center"
                @click="approveDish"
              >
                <span class="iconify mr-2" data-icon="carbon:checkmark-filled"></span>
                批准通过
              </button>
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center"
                @click="openRejectModal"
              >
                <span class="iconify mr-2" data-icon="carbon:close-filled"></span>
                拒绝审核
              </button>
              <button 
                type="button" 
                class="flex-1 px-6 py-3 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition duration-200 flex items-center justify-center"
                @click="revokeApproval"
              >
                <span class="iconify mr-2" data-icon="carbon:reset"></span>
                撤销审核结果
              </button>
              <button 
                type="button" 
                class="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="goBack"
              >
                取消
              </button>
            </div>
        </div>
      </div>
    
    <!-- 拒绝审核弹窗 -->
    <div v-if="isRejectModalOpen" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden animate-fade-in-up">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900">拒绝审核</h3>
          <button @click="closeRejectModal" class="text-gray-400 hover:text-gray-500 transition-colors">
            <span class="iconify text-xl" data-icon="carbon:close"></span>
          </button>
        </div>
        
        <div class="p-6">
          <p class="text-gray-600 mb-4">
            确定要拒绝菜品 <span class="font-medium text-gray-900">"{{ dishData.name }}"</span> 吗？
          </p>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">拒绝原因</label>
            <textarea
              v-model="rejectReason"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow resize-none"
              placeholder="请输入拒绝原因（建议填写，以便用户修改）..."
            ></textarea>
          </div>
        </div>
        
        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button 
            @click="closeRejectModal"
            class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
          >
            取消
          </button>
          <button 
            @click="confirmReject"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="iconify animate-spin mr-2" data-icon="mdi:loading"></span>
            确认拒绝
          </button>
      </div>
    </div>
  </div>
  </div>
</template>

<script>
import { reactive, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { reviewApi } from '@/api/modules/review'
import { dishApi } from '@/api/modules/dish'
import Header from '@/components/Layout/Header.vue';

export default {
  name: 'ReviewDishDetail',
  components: {
    Header
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const dishId = route.params.id
    const isLoading = ref(false)
    const selectedImage = ref('')
    
    const dishData = reactive({
      id: '',
      name: '',
      canteen: '',
      floor: '',
      windowName: '',
      windowNumber: '',
      window: '', // 保留用于兼容
      description: '',
      allergens: '',
      ingredients: '',
      image: '',
      imageUrl: '',
      images: [],
      subItems: [],
      tags: [],
      spicyLevel: 0,
      saltiness: 0,
      sweetness: 0,
      oiliness: 0,
      servingTime: {
        breakfast: false,
        lunch: true,
        dinner: true,
        night: true
      },
      availableDates: [],
      submitter: '',
      submitDate: '',
      submitTime: '',
      status: 'pending'
    })
    
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
    
    // 加载菜品信息
    const loadDishData = async () => {
      isLoading.value = true
      try {
        // 使用正确的 API 获取待审核菜品详情
        let dish = null
        try {
          const response = await reviewApi.getPendingUploadById(dishId.toString())
          if (response.code === 200 && response.data) {
            dish = response.data
          }
        } catch (error) {
          console.error('获取待审核菜品详情失败:', error)
        }
        
        if (dish) {
          // 填充数据
          dishData.id = dish.id || dishId
          dishData.name = dish.name || ''
          dishData.canteen = dish.canteenName || ''
          // 待审核详情接口可能不返回 floor，如果需要可以从 window 对象中获取（如果后端支持）
          // 目前后端 DTO 没有 floor 字段，暂时置空或移除
          dishData.floor = '' 
          dishData.windowName = dish.windowName || ''
          dishData.windowNumber = dish.windowNumber || ''
          dishData.window = dish.windowName || ''
          dishData.description = dish.description || ''
          
          // 处理过敏原
          if (Array.isArray(dish.allergens)) {
            dishData.allergens = dish.allergens.join('、')
          } else {
            dishData.allergens = dish.allergens || ''
          }
          
          // 处理原辅料
          if (Array.isArray(dish.ingredients)) {
            dishData.ingredients = dish.ingredients.join('、')
          } else {
            dishData.ingredients = dish.ingredients || ''
          }
          
          // 处理图片
          if (dish.images && dish.images.length > 0) {
            dishData.imageUrl = dish.images[0]
            dishData.image = dish.images[0]
            dishData.images = dish.images
          } else if (dish.image) {
            dishData.imageUrl = dish.image
            dishData.image = dish.image
            dishData.images = [dish.image]
          } else {
            dishData.images = []
          }
          
          // 处理标签
          dishData.tags = dish.tags || []
          
          // 处理口味指标
          dishData.spicyLevel = dish.spicyLevel !== null && dish.spicyLevel !== undefined ? dish.spicyLevel : 0
          dishData.saltiness = dish.saltiness !== null && dish.saltiness !== undefined ? dish.saltiness : 0
          dishData.sweetness = dish.sweetness !== null && dish.sweetness !== undefined ? dish.sweetness : 0
          dishData.oiliness = dish.oiliness !== null && dish.oiliness !== undefined ? dish.oiliness : 0
          
          // 处理供应时间
          if (dish.availableMealTime && Array.isArray(dish.availableMealTime)) {
            dishData.servingTime = {
              breakfast: dish.availableMealTime.includes('breakfast'),
              lunch: dish.availableMealTime.includes('lunch'),
              dinner: dish.availableMealTime.includes('dinner'),
              night: dish.availableMealTime.includes('nightsnack')
            }
          }
          
          // 处理供应日期段
          dishData.availableDates = dish.availableDates || []
          
          // 处理子项 (待审核 DTO 中没有 subItems，如果需要后端需添加)
          dishData.subItems = []
          
          // 处理提交信息
          dishData.submitter = dish.uploaderName || ''
          if (dish.createdAt) {
            const date = new Date(dish.createdAt)
            dishData.submitDate = date.toISOString().split('T')[0]
            dishData.submitTime = date.toTimeString().split(' ')[0]
          } else {
            dishData.submitDate = dish.submitDate || ''
            dishData.submitTime = dish.submitTime || ''
          }
          
          // 处理状态
          dishData.status = dish.status || 'pending'
        } else {
          alert('未找到该菜品信息')
          router.push('/review-dish')
        }
      } catch (error) {
        console.error('加载菜品信息失败:', error)
        alert('获取菜品信息失败，请重试')
        router.push('/review-dish')
      } finally {
        isLoading.value = false
      }
    }
    
    // 预览图片
    const previewImage = (imgUrl) => {
      window.open(imgUrl, '_blank')
    }
    
    // 批准通过
    const approveDish = async () => {
      if (!confirm(`确定要批准通过菜品 "${dishData.name}" 吗？`)) {
        return
      }
      
      try {
        const response = await reviewApi.approveUpload(dishData.id.toString())
        if (response.code === 200 || response.code === 201) {
          dishData.status = 'approved'
          // 通过路由参数传递刷新标志
          router.push({ path: '/review-dish', query: { refresh: 'true', updatedId: dishData.id, status: 'approved' } })
        } else {
          throw new Error(response.message || '审核失败')
        }
      } catch (error) {
        console.error('批准审核失败:', error)
        alert(error instanceof Error ? error.message : '批准审核失败，请重试')
      }
    }
    
    // 拒绝审核相关状态
    const isRejectModalOpen = ref(false)
    const rejectReason = ref('')
    const isSubmitting = ref(false)

    // 打开拒绝弹窗
    const openRejectModal = () => {
      rejectReason.value = ''
      isRejectModalOpen.value = true
    }

    // 关闭拒绝弹窗
    const closeRejectModal = () => {
      isRejectModalOpen.value = false
    }

    // 确认拒绝
    const confirmReject = async () => {
      if (isSubmitting.value) return
      isSubmitting.value = true
      
      try {
        const response = await reviewApi.rejectUpload(dishData.id.toString(), rejectReason.value || '')
        if (response.code === 200 || response.code === 201) {
          dishData.status = 'rejected'
          isRejectModalOpen.value = false
          // 通过路由参数传递刷新标志
          router.push({ path: '/review-dish', query: { refresh: 'true', updatedId: dishData.id, status: 'rejected' } })
        } else {
          throw new Error(response.message || '审核失败')
        }
      } catch (error) {
        console.error('拒绝审核失败:', error)
        alert(error instanceof Error ? error.message : '拒绝审核失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }
    
    // 撤销审核结果
    const revokeApproval = async () => {
      if (dishData.status === 'pending') {
        alert('该菜品当前为待审核状态，无需撤销。')
        return
      }
      
      if (!confirm(`确定要撤销菜品 "${dishData.name}" 的审核结果吗？\n撤销后菜品将变为"待审核"状态，如果已上架将被下架。`)) {
        return
      }
      
      try {
        const response = await reviewApi.revokeUpload(dishData.id.toString())
        if (response.code === 200 || response.code === 201) {
          dishData.status = 'pending'
          // 通过路由参数传递刷新标志
          router.push({ path: '/review-dish', query: { refresh: 'true', updatedId: dishData.id, status: 'pending' } })
          alert('菜品审核结果已撤销，重新进入待审核状态。')
        } else {
          throw new Error(response.message || '撤销审核失败')
        }
      } catch (error) {
        console.error('撤销审核失败:', error)
        alert(error instanceof Error ? error.message : '撤销审核失败，请重试')
      }
    }
    
    // 返回
    const goBack = () => {
      router.push('/review-dish')
    }
    
    onMounted(() => {
      loadDishData()
    })
    
    return {
      dishData,
      isLoading,
      selectedImage,
      statusClasses,
      statusText,
      previewImage,
      approveDish,
      revokeApproval,
      goBack,
      isRejectModalOpen,
      rejectReason,
      isSubmitting,
      openRejectModal,
      closeRejectModal,
      confirmReject
    }
  }
}
</script>

