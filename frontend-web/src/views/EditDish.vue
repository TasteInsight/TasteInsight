<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="编辑菜品" 
            description="修改菜品信息并提交审核"
            header-icon="carbon:edit"
          />
          
          <form class="space-y-6">
            <div class="grid grid-cols-2 gap-6">
              <!-- 左侧列 -->
              <div>
                <!-- 食堂信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">食堂信息 <span class="text-red-500">*</span></label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">食堂名称 <span class="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        v-model="formData.canteen" 
                        class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                        placeholder="例如：紫荆园"
                        required
                      >
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">食堂楼层 <span class="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        v-model="formData.floor" 
                        class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                        placeholder="例如：一层、二层"
                        required
                      >
                    </div>
                  </div>
                </div>
                
                <!-- 窗口信息 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">窗口信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">窗口名称 <span class="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        v-model="formData.windowName" 
                        class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                        placeholder="例如：川湘风味"
                        required
                      >
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">窗口编号</label>
                      <input 
                        type="text" 
                        v-model="formData.windowNumber" 
                        class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                        placeholder="例如：01、A01（可选）"
                      >
                    </div>
                  </div>
                </div>
                
                <!-- 菜品名称 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品名称 <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    v-model="formData.name" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：水煮肉片"
                  >
                </div>
                
                <!-- 菜品价格 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品价格（元）</label>
                  <input 
                    type="number" 
                    v-model.number="formData.price" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：15.00（默认为0）"
                    step="0.01"
                    min="0"
                  >
                  <p class="mt-1 text-sm text-gray-500">如不填写，默认为0</p>
                </div>
                
                <!-- 菜品描述 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">菜品描述</label>
                  <textarea 
                    v-model="formData.description" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple resize-none"
                    rows="4"
                    placeholder="请输入菜品描述..."
                  ></textarea>
                </div>
                
                <!-- 菜品图片上传 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">菜品图片</label>
                  <div class="border-2 border-dashed rounded-lg aspect-square w-[40%] relative flex items-center justify-center bg-gray-50 overflow-hidden">
                    <img 
                      v-if="formData.imageUrl" 
                      :src="formData.imageUrl" 
                      alt="菜品图片预览"
                      class="w-full h-full object-cover object-center"
                    >
                    <div v-else class="text-center p-6">
                      <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
                      <div class="mt-2">点击上传菜品图片</div>
                      <p class="text-sm text-gray-500 mt-1">建议尺寸800x800像素，小于2MB</p>
                    </div>
                    <input 
                      type="file" 
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      @change="handleImageUpload"
                      accept="image/*"
                    >
                  </div>
                </div>
              </div>
              
              <!-- 右侧列 -->
              <div>
                <!-- 菜品子项（仅父菜品显示） -->
                <div v-if="!isSubDish" class="mb-6">
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-gray-700 font-medium">
                      菜品子项
                      <span class="text-sm text-gray-500 font-normal ml-1">（点击子项可进入编辑）</span>
                    </label>
                    <button 
                      type="button" 
                      class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                      @click="addSubItem"
                    >
                      <span class="iconify" data-icon="carbon:add-alt"></span>
                      添加子项
                    </button>
                  </div>
                  
                  <div v-if="subDishes.length > 0" class="space-y-3">
                    <!-- 子项列表 -->
                    <div 
                      v-for="(subDish, index) in subDishes" 
                      :key="subDish.id || index"
                      class="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                      @click="editSubDish(subDish.id)"
                    >
                      <div class="flex items-center flex-1">
                        <span class="iconify text-tsinghua-purple mr-2" data-icon="carbon:dot-mark"></span>
                        <span class="text-gray-700 font-medium">{{ subDish.name || '未命名子项' }}</span>
                        <span class="ml-3 text-sm text-gray-500">¥{{ subDish.price || 0 }}</span>
                      </div>
                      <button 
                        type="button" 
                        class="px-4 py-1.5 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center text-sm"
                        @click.stop="editSubDish(subDish.id)"
                      >
                        <span class="iconify mr-1" data-icon="carbon:edit"></span>
                        编辑
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <p>暂无子项。点击"添加子项"可以添加新的子项。</p>
                  </div>
                </div>
                
                <!-- 子项提示（如果是子项，显示父菜品信息） -->
                <div v-if="isSubDish" class="mb-6">
                  <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="flex items-center">
                      <span class="iconify text-blue-500 mr-2" data-icon="carbon:information"></span>
                      <span class="text-sm text-blue-700">这是子项菜品，子项不能再添加子项。</span>
                    </div>
                  </div>
                </div>
                
                <!-- 供应信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应信息</label>
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">菜系TAG</label>
                      <div class="space-y-2">
                        <!-- TAG 输入和添加按钮 -->
                        <div class="flex gap-2">
                          <input 
                            type="text" 
                            v-model="newTag" 
                            class="flex-1 px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                            placeholder="输入TAG，例如：麻辣、油腻、日料等"
                            @keyup.enter="addTag"
                          >
                          <button 
                            type="button"
                            @click="addTag"
                            class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                          >
                            <span class="iconify mr-1" data-icon="carbon:add-alt"></span>
                            添加
                          </button>
                        </div>
                        <!-- TAG 列表显示 -->
                        <div v-if="formData.tags && formData.tags.length > 0" class="flex flex-wrap gap-2">
                          <span 
                            v-for="(tag, index) in formData.tags" 
                            :key="index"
                            class="inline-flex items-center px-3 py-1 bg-tsinghua-purple/10 text-tsinghua-purple rounded-full text-sm"
                          >
                            #{{ tag }}
                            <button 
                              type="button"
                              @click="removeTag(index)"
                              class="ml-2 text-tsinghua-purple hover:text-tsinghua-dark"
                            >
                              <span class="iconify text-xs" data-icon="carbon:close"></span>
                            </button>
                          </span>
                        </div>
                        <p v-else class="text-sm text-gray-500">暂无TAG，可以添加如 #麻辣 #油腻 #日料 等标签</p>
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">口味指标（0-5分，0为无，5为最高，默认为0）</label>
                      <div class="grid grid-cols-4 gap-3">
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">辣度</label>
                          <input 
                            type="number" 
                            v-model.number="formData.spicyLevel" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                            placeholder="0"
                            min="0"
                            max="5"
                            step="0.5"
                          >
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">咸度</label>
                          <input 
                            type="number" 
                            v-model.number="formData.saltiness" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                            placeholder="0"
                            min="0"
                            max="5"
                            step="0.5"
                          >
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">甜度</label>
                          <input 
                            type="number" 
                            v-model.number="formData.sweetness" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                            placeholder="0"
                            min="0"
                            max="5"
                            step="0.5"
                          >
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">油度</label>
                          <input 
                            type="number" 
                            v-model.number="formData.oiliness" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                            placeholder="0"
                            min="0"
                            max="5"
                            step="0.5"
                          >
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
                      <input 
                        type="checkbox" 
                        id="breakfast" 
                        v-model="formData.servingTime.breakfast"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="breakfast">早餐</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="lunch" 
                        v-model="formData.servingTime.lunch"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="lunch">午餐</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="dinner" 
                        v-model="formData.servingTime.dinner"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="dinner">晚餐</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="night-food" 
                        v-model="formData.servingTime.night"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="night-food">夜宵</label>
                    </div>
                  </div>
                </div>
                
                <!-- 供应日期段 -->
                <div class="mb-6">
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-gray-700 font-medium">供应日期段</label>
                    <button 
                      type="button" 
                      class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                      @click="addDateRange"
                    >
                      <span class="iconify" data-icon="carbon:add-alt"></span>
                      添加日期段
                    </button>
                  </div>
                  <div v-if="formData.availableDates && formData.availableDates.length > 0" class="space-y-3">
                    <div 
                      v-for="(dateRange, index) in formData.availableDates" 
                      :key="index"
                      class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                    >
                      <div class="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">开始日期</label>
                          <input 
                            type="date" 
                            v-model="dateRange.startDate" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          >
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">结束日期</label>
                          <input 
                            type="date" 
                            v-model="dateRange.endDate" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                            :min="dateRange.startDate"
                          >
                        </div>
                      </div>
                      <button 
                        type="button" 
                        class="text-red-500 hover:text-red-700 px-2"
                        @click="removeDateRange(index)"
                        title="删除日期段"
                      >
                        <span class="iconify" data-icon="carbon:trash-can"></span>
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <p>可以添加多个供应日期段，例如：2024-01-01 至 2024-03-31</p>
                  </div>
                </div>
                
                <!-- 过敏原 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">过敏原</label>
                  <input 
                    type="text" 
                    v-model="formData.allergens" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：花生、牛奶、鸡蛋等"
                  >
                </div>
                
                <!-- 原辅料 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">原辅料</label>
                  <input 
                    type="text" 
                    v-model="formData.ingredients" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：猪肉、豆芽、辣椒、花椒等"
                  >
                </div>
              </div>
            </div>
            
            <!-- 表单按钮 -->
            <div class="flex space-x-4 pt-6 border-t border-gray-200">
              <button 
                type="button" 
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                @click="submitForm"
                :disabled="isSubmitting || isLoading"
              >
                <span class="iconify mr-1" data-icon="carbon:save"></span>
                {{ isSubmitting ? '提交中...' : '提交审核' }}
              </button>
              <button 
                type="button" 
                class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="goBack"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { dishApi } from '@/api/modules/dish'
import { useDishStore } from '@/store/modules/use-dish-store'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'EditDish',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const dishStore = useDishStore()
    const dishId = route.params.id
    const isLoading = ref(false)
    const isSubmitting = ref(false)
    
    const newTag = ref('')
    
    const formData = reactive({
      id: '',
      canteen: '',
      floor: '',
      windowName: '',
      windowNumber: '',
      name: '',
      price: 0,
      description: '',
      allergens: '',
      ingredients: '',
      image: null,
      imageUrl: '',
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
      availableDates: []
    })
    
    const subDishes = ref([]) // 存储子项列表
    
    // 加载菜品信息
    const loadDishData = async () => {
      isLoading.value = true
      try {
        // 优先从 API 获取
        const response = await dishApi.getDishById(dishId)
        
        if (response.code === 200 && response.data) {
          const dish = response.data
          fillFormData(dish)
        } else {
          throw new Error(response.message || '获取菜品信息失败')
        }
      } catch (error) {
        console.error('从 API 获取菜品失败:', error)
        alert('获取菜品信息失败，请重试')
        router.push('/modify-dish')
      } finally {
        isLoading.value = false
      }
    }
    
    // 判断是否为子项（有 parentDishId）
    const isSubDish = ref(false)
    
    // 填充表单数据
    const fillFormData = (dish) => {
      formData.id = dish.id || dishId
      formData.canteen = dish.canteenName || dish.canteen || ''
      formData.floor = dish.floorName || dish.floor || ''
      formData.windowName = dish.windowName || dish.window || ''
      formData.windowNumber = dish.windowNumber || ''
      formData.name = dish.name || ''
      formData.description = dish.description || ''
      
      // 判断是否为子项
      isSubDish.value = !!dish.parentDishId
      
      // 处理过敏原（可能是数组或字符串）
      if (Array.isArray(dish.allergens)) {
        formData.allergens = dish.allergens.join('、')
      } else {
        formData.allergens = dish.allergens || ''
      }
      
      // 处理原辅料（可能是数组或字符串）
      if (Array.isArray(dish.ingredients)) {
        formData.ingredients = dish.ingredients.join('、')
      } else {
        formData.ingredients = dish.ingredients || ''
      }
      
      // 处理图片
      if (dish.images && dish.images.length > 0) {
        formData.imageUrl = dish.images[0]
      } else if (dish.image) {
        formData.imageUrl = dish.image
      }
      
      // 处理标签（TAG）
      if (dish.tags && Array.isArray(dish.tags) && dish.tags.length > 0) {
        formData.tags = [...dish.tags]
      } else {
        formData.tags = []
      }
      
      // 处理口味指标（默认为0）
      formData.spicyLevel = dish.spicyLevel !== null && dish.spicyLevel !== undefined ? dish.spicyLevel : 0
      formData.saltiness = dish.saltiness !== null && dish.saltiness !== undefined ? dish.saltiness : 0
      formData.sweetness = dish.sweetness !== null && dish.sweetness !== undefined ? dish.sweetness : 0
      formData.oiliness = dish.oiliness !== null && dish.oiliness !== undefined ? dish.oiliness : 0
      
      // 处理价格
      if (dish.price !== null && dish.price !== undefined) {
        const priceValue = typeof dish.price === 'number' ? dish.price : parseFloat(dish.price.toString().replace('¥', ''))
        formData.price = isNaN(priceValue) ? 0 : priceValue
      } else {
        formData.price = 0
      }
      
      // 加载子项列表（只有父菜品才显示子项列表）
      if (!isSubDish.value && dish.subDishId && dish.subDishId.length > 0) {
        loadSubDishes(dish.subDishId)
      } else {
        subDishes.value = []
      }
      
      // 处理供应时间
      if (dish.availableMealTime && Array.isArray(dish.availableMealTime)) {
        formData.servingTime = {
          breakfast: dish.availableMealTime.includes('breakfast'),
          lunch: dish.availableMealTime.includes('lunch'),
          dinner: dish.availableMealTime.includes('dinner'),
          night: dish.availableMealTime.includes('nightsnack')
        }
      }
      
      // 处理供应日期段
      if (dish.availableDates && Array.isArray(dish.availableDates) && dish.availableDates.length > 0) {
        formData.availableDates = dish.availableDates.map(range => ({
          startDate: range.startDate || '',
          endDate: range.endDate || ''
        }))
      } else {
        formData.availableDates = []
      }
    }
    
    // 加载子项列表
    const loadSubDishes = async (subDishIds) => {
      try {
        const subDishPromises = subDishIds.map(id => dishApi.getDishById(id))
        const responses = await Promise.all(subDishPromises)
        subDishes.value = responses
          .filter(res => res.code === 200 && res.data)
          .map(res => res.data)
      } catch (error) {
        console.error('加载子项列表失败:', error)
        subDishes.value = []
      }
    }
    
    const addSubItem = () => {
      // 跳转到添加子项页面
      router.push({
        path: '/add-sub-dish',
        query: {
          parentId: formData.id,
          subItemName: '',
          fromEdit: 'true' // 标记来自编辑页面
        }
      })
    }
    
    const editSubDish = (subDishId) => {
      // 跳转到编辑子项页面（使用EditDish组件）
      router.push(`/edit-dish/${subDishId}`)
    }
    
    const addDateRange = () => {
      if (!formData.availableDates) {
        formData.availableDates = []
      }
      formData.availableDates.push({ startDate: '', endDate: '' })
    }
    
    const removeDateRange = (index) => {
      formData.availableDates.splice(index, 1)
    }
    
    const addTag = () => {
      const tag = newTag.value.trim()
      if (tag && !formData.tags.includes(tag)) {
        formData.tags.push(tag)
        newTag.value = ''
      } else if (formData.tags.includes(tag)) {
        alert('该TAG已存在')
      }
    }
    
    const removeTag = (index) => {
      formData.tags.splice(index, 1)
    }
    
    const handleImageUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        formData.image = file
        // 创建预览 URL
        const reader = new FileReader()
        reader.onload = (e) => {
          formData.imageUrl = e.target.result
        }
        reader.readAsDataURL(file)
      }
    }
    
    const submitForm = async () => {
      // 表单验证
      if (!formData.name || !formData.canteen || !formData.floor || !formData.windowName) {
        alert('请填写必填字段：菜品名称、食堂名称、食堂楼层、窗口名称')
        return
      }
      
      // 验证价格：必须为数字，默认为0
      let dishPrice = 0
      
      if (formData.price !== null && formData.price !== undefined && formData.price !== '') {
        dishPrice = parseFloat(formData.price)
        if (isNaN(dishPrice) || dishPrice < 0) {
          alert('价格必须为有效的数字（大于等于0）')
          return
        }
      } else {
        // 如果没有直接输入价格，检查子项
        const validSubItems = formData.subItems.filter(item => item.name && item.price)
        if (validSubItems.length > 0) {
          dishPrice = parseFloat(validSubItems[0].price)
          if (isNaN(dishPrice) || dishPrice < 0) {
            alert('子项价格必须为有效的数字（大于等于0）')
            return
          }
        }
        // 如果都没有，使用默认值0
      }
      
      if (isSubmitting.value) {
        return
      }
      
      isSubmitting.value = true
      
      try {
        // 1. 上传新图片（如果有）
        let imageUrls = []
        if (formData.image && formData.image instanceof File) {
          try {
            const uploadResponse = await dishApi.uploadImage(formData.image)
            if (uploadResponse.code === 200 && uploadResponse.data) {
              imageUrls = [uploadResponse.data.url]
            } else {
              throw new Error(uploadResponse.message || '图片上传失败')
            }
          } catch (error) {
            console.error('图片上传失败:', error)
            alert('图片上传失败，请重试')
            isSubmitting.value = false
            return
          }
        } else if (formData.imageUrl) {
          // 如果已有图片 URL，直接使用
          imageUrls = [formData.imageUrl]
        }
        
        // 2. 构建更新数据
        // 处理TAG（使用formData.tags数组）
        const tags = formData.tags && formData.tags.length > 0 ? formData.tags : undefined
        
        // 处理供应时间
        const availableMealTime = []
        if (formData.servingTime.breakfast) availableMealTime.push('breakfast')
        if (formData.servingTime.lunch) availableMealTime.push('lunch')
        if (formData.servingTime.dinner) availableMealTime.push('dinner')
        if (formData.servingTime.night) availableMealTime.push('nightsnack')
        
        // 处理原辅料和过敏原（转换为数组）
        const ingredients = formData.ingredients
          ? formData.ingredients.split(/[，,、]/).map(item => item.trim()).filter(item => item)
          : []
        
        const allergens = formData.allergens
          ? formData.allergens.split(/[，,、]/).map(item => item.trim()).filter(item => item)
          : []
        
        // 处理供应日期段（过滤掉空的日期段）
        const availableDates = formData.availableDates && formData.availableDates.length > 0
          ? formData.availableDates
              .filter(range => range.startDate && range.endDate)
              .map(range => ({
                startDate: range.startDate,
                endDate: range.endDate
              }))
          : undefined
        
        // 获取当前菜品信息，保留 subDishId 和 parentDishId
        let currentDish = null
        try {
          const currentResponse = await dishApi.getDishById(formData.id)
          if (currentResponse.code === 200 && currentResponse.data) {
            currentDish = currentResponse.data
          }
        } catch (error) {
          console.error('获取当前菜品信息失败:', error)
        }
        
        // 构建菜品更新请求
        const updateData = {
          name: formData.name,
          canteenName: formData.canteen,
          windowName: formData.windowName,
          windowNumber: formData.windowNumber || formData.windowName, // 如果没有编号，使用窗口名称
          price: dishPrice,
          description: formData.description || undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
          tags: tags,
          ingredients: ingredients.length > 0 ? ingredients : undefined,
          allergens: allergens.length > 0 ? allergens : undefined,
          spicyLevel: formData.spicyLevel !== null && formData.spicyLevel !== undefined ? formData.spicyLevel : 0,
          saltiness: formData.saltiness !== null && formData.saltiness !== undefined ? formData.saltiness : 0,
          sweetness: formData.sweetness !== null && formData.sweetness !== undefined ? formData.sweetness : 0,
          oiliness: formData.oiliness !== null && formData.oiliness !== undefined ? formData.oiliness : 0,
          availableMealTime: availableMealTime.length > 0 ? availableMealTime : undefined,
          availableDates: availableDates,
          status: 'offline', // 修改后需要重新审核，状态设为 offline
          // 保留原有的 subDishId 和 parentDishId
          subDishId: currentDish?.subDishId || undefined,
          parentDishId: currentDish?.parentDishId || undefined
        }
        
        // 3. 调用 API 更新菜品
        const response = await dishApi.updateDish(formData.id, updateData)
        
        if (response.code === 200 && response.data) {
          // 4. 更新 store 中的菜品信息
          dishStore.updateDish(formData.id, response.data)
          
          alert('菜品信息已更新，已提交审核！')
          router.push('/modify-dish')
        } else {
          throw new Error(response.message || '更新菜品失败')
        }
      } catch (error) {
        console.error('更新菜品失败:', error)
        alert(error instanceof Error ? error.message : '更新菜品失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }
    
    const goBack = () => {
      router.push('/modify-dish')
    }
    
    onMounted(() => {
      loadDishData()
    })
    
    // 监听路由变化，如果从添加子项页面返回，刷新子项列表
    watch(() => route.query, (newQuery) => {
      if (newQuery.refreshSubDishes === 'true' && formData.id) {
        // 重新加载菜品数据以获取最新的子项列表
        loadDishData()
        // 清除查询参数
        router.replace({ path: route.path, query: {} })
      }
    })
    
    return {
      formData,
      newTag,
      isLoading,
      isSubmitting,
      subDishes,
      isSubDish,
      addSubItem,
      editSubDish,
      addDateRange,
      removeDateRange,
      addTag,
      removeTag,
      handleImageUpload,
      submitForm,
      goBack
    }
  }
}
</script>

