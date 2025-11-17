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
                  <label class="block text-gray-700 font-medium mb-2">食堂信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <select v-model="formData.canteen" class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple">
                        <option selected disabled>选择食堂</option>
                        <option>紫荆园</option>
                        <option>桃李园</option>
                        <option>丁香园</option>
                        <option>清芬园（清青快餐）</option>
                        <option>听涛园</option>
                        <option>观畴园（清青咖啡）</option>
                        <option>玉树园</option>
                        <option>芝兰园</option>
                        <option>澜园</option>
                        <option>荷园</option>
                        <option>寓园</option>
                        <option>家园</option>
                        <option>南园</option>
                        <option>北园</option>
                        <option>熙春园</option>
                        <option>清青牛拉</option>
                      </select>
                    </div>
                    <div>
                      <select v-model="formData.floor" class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple">
                        <option selected disabled>选择楼层</option>
                        <option>一层</option>
                        <option>二层</option>
                        <option>三层</option>
                        <option>四层</option>
                        <option>地下一层</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <!-- 窗口信息 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">窗口名称/编号</label>
                  <input 
                    type="text" 
                    v-model="formData.window" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：川湘风味"
                  >
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
                  <label class="block text-gray-700 font-medium mb-2">菜品价格（元） <span class="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    v-model="formData.price" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：15.00"
                    step="0.01"
                    min="0"
                  >
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
                <!-- 菜品子项（可选） -->
                <div class="mb-6">
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-gray-700 font-medium">
                      菜品子项
                      <span class="text-sm text-gray-500 font-normal ml-1">（可选，用于有多个规格的菜品）</span>
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
                  
                  <div v-if="formData.subItems.length > 0" class="space-y-4">
                    <!-- 子项行 -->
                    <div 
                      v-for="(item, index) in formData.subItems" 
                      :key="index"
                      class="sub-item-row"
                    >
                      <div class="flex space-x-4">
                        <div class="flex-1">
                          <input 
                            type="text" 
                            v-model="item.name" 
                            class="w-full px-4 py-2 border rounded-lg" 
                            placeholder="子项名称（如：小份、中份、大份）"
                          >
                        </div>
                        <div class="w-32">
                          <input 
                            type="number" 
                            v-model="item.price" 
                            class="w-full px-4 py-2 border rounded-lg" 
                            placeholder="价格（元）"
                            step="0.01"
                            min="0"
                          >
                        </div>
                        <button 
                          type="button" 
                          class="text-red-500 hover:text-red-700 px-2"
                          @click="removeSubItem(index)"
                          title="删除子项"
                        >
                          <span class="iconify" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <p>如果菜品有多个规格（如小份/大份），可以添加子项。否则直接在上方输入价格即可。</p>
                  </div>
                </div>
                
                <!-- 供应信息组 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应信息</label>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">菜系分类</label>
                      <select v-model="formData.cuisine" class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple">
                        <option selected disabled>选择菜系</option>
                        <option>川菜</option>
                        <option>粤菜</option>
                        <option>鲁菜</option>
                        <option>苏菜</option>
                        <option>闽菜</option>
                        <option>徽菜</option>
                        <option>湘菜</option>
                        <option>浙菜</option>
                        <option>东北菜</option>
                        <option>云贵菜</option>
                        <option>沪菜</option>
                        <option>京菜</option>
                        <option>赣菜</option>
                        <option>鄂菜</option>
                        <option>豫菜</option>
                        <option>港澳菜</option>
                        <option>台湾菜</option>
                        <option>琼菜</option>
                        <option>天津菜</option>
                        <option>冀菜</option>
                        <option>桂菜</option>
                        <option>晋菜</option>
                        <option>西藏菜</option>
                        <option>新疆菜</option>
                        <option>清真菜</option>
                        <option>日本料理</option>
                        <option>韩国料理</option>
                        <option>东南亚菜</option>
                        <option>墨西哥菜</option>
                        <option>地中海菜</option>
                        <option>印度菜</option>
                        <option>西餐</option>
                        <option>其他</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-600 mb-1">主要口味</label>
                      <select v-model="formData.taste" class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple">
                        <option selected disabled>选择口味</option>
                        <option>微辣</option>
                        <option>中辣</option>
                        <option>麻辣</option>
                        <option>咸鲜</option>
                        <option>酸甜</option>
                        <option>清淡</option>
                      </select>
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
                      <label for="breakfast">早餐（6:30-9:30）</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="lunch" 
                        v-model="formData.servingTime.lunch"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="lunch">午餐（10:30-13:30）</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="dinner" 
                        v-model="formData.servingTime.dinner"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="dinner">晚餐（16:30-19:30）</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="night-food" 
                        v-model="formData.servingTime.night"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="night-food">夜宵（19:40-22:00）</label>
                    </div>
                  </div>
                </div>
                
                <!-- 供应季节 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">供应季节</label>
                  <div class="grid grid-cols-4 gap-2">
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="spring" 
                        v-model="formData.seasons.spring"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="spring">春季</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="summer" 
                        v-model="formData.seasons.summer"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="summer">夏季</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="autumn" 
                        v-model="formData.seasons.autumn"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="autumn">秋季</label>
                    </div>
                    <div class="flex items-center">
                      <input 
                        type="checkbox" 
                        id="winter" 
                        v-model="formData.seasons.winter"
                        class="mr-2 h-4 w-4 text-tsinghua-purple"
                      >
                      <label for="winter">冬季</label>
                    </div>
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
import { reactive, onMounted, ref } from 'vue'
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
    
    const formData = reactive({
      id: '',
      canteen: '',
      floor: '',
      window: '',
      name: '',
      price: '',
      description: '',
      allergens: '',
      ingredients: '',
      image: null,
      imageUrl: '',
      subItems: [],
      cuisine: '',
      taste: '',
      servingTime: {
        breakfast: false,
        lunch: true,
        dinner: true,
        night: true
      },
      seasons: {
        spring: true,
        summer: true,
        autumn: true,
        winter: true
      }
    })
    
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
        console.error('从 API 获取菜品失败，尝试从 store 或 Mock 数据获取:', error)
        
        // 如果 API 失败，尝试从 store 获取
        const dishes = dishStore.dishes || []
        const dish = dishes.find(d => d.id === dishId)
        
        if (dish) {
          fillFormData(dish)
        } else {
          // 最后尝试使用 Mock 数据（仅用于开发测试）
          const mockDish = getMockDishById(dishId)
          if (mockDish) {
            fillFormData(mockDish)
          } else {
            alert('未找到该菜品信息')
            router.push('/modify-dish')
          }
        }
      } finally {
        isLoading.value = false
      }
    }
    
    // 填充表单数据
    const fillFormData = (dish) => {
      formData.id = dish.id || dishId
      formData.canteen = dish.canteenName || dish.canteen || ''
      formData.floor = dish.floor || ''
      formData.window = dish.windowName || dish.window || dish.windowNumber || ''
      formData.name = dish.name || ''
      formData.description = dish.description || ''
      
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
      
      // 处理标签（菜系和口味）
      if (dish.tags && dish.tags.length > 0) {
        // 假设第一个标签是菜系，第二个是口味
        formData.cuisine = dish.tags[0] || ''
        formData.taste = dish.tags[1] || ''
      }
      
      // 处理价格和子项
      if (dish.price) {
        const priceValue = typeof dish.price === 'number' ? dish.price : parseFloat(dish.price.toString().replace('¥', ''))
        formData.price = priceValue.toString()
        
        // 如果有子项，填充子项；否则使用主价格
        if (dish.subDishId && dish.subDishId.length > 0) {
          // 如果有子项ID，可能需要从其他地方获取子项详情
          // 这里先使用主价格作为默认子项
          formData.subItems = [{
            name: dish.name || '',
            price: priceValue.toString()
          }]
        } else {
          formData.subItems = [{
            name: dish.name || '',
            price: priceValue.toString()
          }]
        }
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
      
      // 注意：季节信息在 API 中可能不存在，保持默认值
    }
    
    // Mock 数据（仅用于开发测试，当 API 不可用时）
    const getMockDishById = (id) => {
      const mockDishes = [
        { 
          id: 'FD0123', 
          name: '海南椰子鸡', 
          canteenName: '紫荆园', 
          floor: '二层',
          windowName: '海南鸡饭窗口',
          tags: ['琼菜', '清淡'],
          price: 15,
          images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
          description: '选用新鲜椰子，配以优质鸡肉，口感鲜嫩',
          allergens: [],
          ingredients: ['鸡肉', '椰子', '姜', '蒜'],
          availableMealTime: ['lunch', 'dinner']
        },
        { 
          id: 'FD0124', 
          name: '芹菜炒肉丝', 
          canteenName: '桃李园', 
          floor: '二层',
          windowName: '自选菜',
          tags: [],
          price: 6,
          images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
          availableMealTime: ['lunch', 'dinner']
        },
        { 
          id: 'FD0125', 
          name: '辛拉面', 
          canteenName: '桃李园', 
          floor: '一层',
          windowName: '韩式风味',
          tags: ['韩国料理', '微辣'],
          price: 10,
          images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
          availableMealTime: ['lunch', 'dinner', 'nightsnack']
        },
        { 
          id: 'FD0126', 
          name: '红烧牛肉面', 
          canteenName: '清青牛拉', 
          floor: '二层',
          windowName: '清青牛拉',
          tags: ['陇菜', '咸鲜'],
          price: 22,
          images: ['/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg'],
          availableMealTime: ['lunch', 'dinner']
        }
      ]
      return mockDishes.find(d => d.id === id)
    }
    
    const addSubItem = () => {
      formData.subItems.push({ name: '', price: '' })
    }
    
    const removeSubItem = (index) => {
      formData.subItems.splice(index, 1)
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
      if (!formData.name || !formData.canteen || !formData.window) {
        alert('请填写必填字段：菜品名称、食堂、窗口')
        return
      }
      
      // 验证价格：优先使用直接输入的价格，如果没有则使用第一个子项的价格
      let dishPrice = null
      
      if (formData.price) {
        dishPrice = parseFloat(formData.price)
        if (isNaN(dishPrice) || dishPrice <= 0) {
          alert('请输入有效的价格')
          return
        }
      } else {
        const validSubItems = formData.subItems.filter(item => item.name && item.price)
        if (validSubItems.length > 0) {
          dishPrice = parseFloat(validSubItems[0].price)
          if (isNaN(dishPrice) || dishPrice <= 0) {
            alert('请输入有效的价格（在价格字段或子项中）')
            return
          }
        } else {
          alert('请输入菜品价格（在价格字段或添加子项）')
          return
        }
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
        const tags = []
        if (formData.cuisine) tags.push(formData.cuisine)
        if (formData.taste) tags.push(formData.taste)
        
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
        
        // 构建菜品更新请求
        const updateData = {
          name: formData.name,
          canteenName: formData.canteen,
          floor: formData.floor || undefined,
          windowName: formData.window,
          windowNumber: formData.window,
          price: dishPrice,
          description: formData.description || undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
          tags: tags.length > 0 ? tags : undefined,
          ingredients: ingredients.length > 0 ? ingredients : undefined,
          allergens: allergens.length > 0 ? allergens : undefined,
          availableMealTime: availableMealTime.length > 0 ? availableMealTime : undefined,
          status: 'offline' // 修改后需要重新审核，状态设为 offline
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
    
    return {
      formData,
      isLoading,
      isSubmitting,
      addSubItem,
      removeSubItem,
      handleImageUpload,
      submitForm,
      goBack
    }
  }
}
</script>

