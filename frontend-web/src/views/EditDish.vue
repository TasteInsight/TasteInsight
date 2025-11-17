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
                  <label class="block text-gray-700 font-medium mb-2">菜品名称</label>
                  <input 
                    type="text" 
                    v-model="formData.name" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：水煮肉片"
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
                  <div class="border-2 border-dashed rounded-lg h-48 relative flex items-center justify-center bg-gray-50">
                    <img 
                      v-if="formData.imageUrl" 
                      :src="formData.imageUrl" 
                      alt="菜品图片"
                      class="w-full h-full object-cover rounded-lg"
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
                <!-- 菜品子项 -->
                <div class="mb-6">
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-gray-700 font-medium">菜品子项</label>
                    <button 
                      type="button" 
                      class="text-tsinghua-purple text-sm flex items-center"
                      @click="addSubItem"
                    >
                      <span class="iconify" data-icon="carbon:add-alt"></span>
                      添加子项
                    </button>
                  </div>
                  
                  <div class="space-y-4">
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
                            placeholder="子项名称"
                          >
                        </div>
                        <div class="w-32">
                          <input 
                            type="number" 
                            v-model="item.price" 
                            class="w-full px-4 py-2 border rounded-lg" 
                            placeholder="价格（元）"
                          >
                        </div>
                        <button 
                          type="button" 
                          class="text-red-500 hover:text-red-700"
                          @click="removeSubItem(index)"
                        >
                          <span class="iconify" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </div>
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
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                @click="submitForm"
              >
                <span class="iconify mr-1" data-icon="carbon:save"></span>提交审核
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
import { reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDishStore } from '../store'
import Sidebar from '../components/Layout/Sidebar.vue'
import Header from '../components/Layout/Header.vue'

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
    
    const formData = reactive({
      id: '',
      canteen: '',
      floor: '',
      window: '',
      name: '',
      description: '',
      allergens: '',
      ingredients: '',
      image: null,
      imageUrl: '',
      subItems: [
        { name: '', price: '' }
      ],
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
    const loadDishData = () => {
      // 从 store 中查找菜品，或者从 API 获取
      const dishes = dishStore.dishes || []
      const dish = dishes.find(d => d.id === dishId) || getDishById(dishId)
      
      if (dish) {
        // 填充表单数据
        formData.id = dish.id
        formData.canteen = dish.canteen || ''
        formData.floor = dish.floor || ''
        formData.window = dish.window || ''
        formData.name = dish.name || ''
        formData.description = dish.description || ''
        formData.allergens = dish.allergens || ''
        formData.ingredients = dish.ingredients || ''
        formData.imageUrl = dish.image || ''
        formData.cuisine = dish.cuisine || ''
        formData.taste = dish.taste || ''
        
        // 处理子项
        if (dish.subItems && dish.subItems.length > 0) {
          formData.subItems = dish.subItems.map(item => ({
            name: item.name || '',
            price: item.price || ''
          }))
        } else if (dish.price) {
          // 如果没有子项，从价格创建子项
          formData.subItems = [{
            name: dish.name || '',
            price: dish.price.toString().replace('¥', '') || ''
          }]
        }
        
        // 处理供应时间和季节（如果有的话）
        if (dish.servingTime) {
          formData.servingTime = { ...formData.servingTime, ...dish.servingTime }
        }
        if (dish.seasons) {
          formData.seasons = { ...formData.seasons, ...dish.seasons }
        }
      } else {
        alert('未找到该菜品信息')
        router.push('/modify-dish')
      }
    }
    
    // 模拟根据 ID 获取菜品（实际应该调用 API）
    const getDishById = (id) => {
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
          image: '/ai/uploads/ai_pics/40/406134/aigp_1760528654.jpeg',
          description: '选用新鲜椰子，配以优质鸡肉，口感鲜嫩',
          allergens: '无',
          ingredients: '鸡肉、椰子、姜、蒜'
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
      return sampleDishes.find(d => d.id === id)
    }
    
    const addSubItem = () => {
      formData.subItems.push({ name: '', price: '' })
    }
    
    const removeSubItem = (index) => {
      if (formData.subItems.length > 1) {
        formData.subItems.splice(index, 1)
      }
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
    
    const submitForm = () => {
      // 表单验证
      if (!formData.name || !formData.canteen || !formData.window) {
        alert('请填写必填字段')
        return
      }
      
      // 更新菜品信息
      const updatedDish = {
        id: formData.id,
        name: formData.name,
        canteen: formData.canteen,
        floor: formData.floor,
        window: formData.window,
        description: formData.description,
        allergens: formData.allergens,
        ingredients: formData.ingredients,
        cuisine: formData.cuisine,
        taste: formData.taste,
        price: formData.subItems[0]?.price ? `¥${formData.subItems[0].price}` : '',
        subItems: formData.subItems,
        servingTime: formData.servingTime,
        seasons: formData.seasons,
        image: formData.imageUrl,
        status: 'pending' // 提交后状态改为待审核
      }
      
      // 更新到 store
      dishStore.updateDish(formData.id, updatedDish)
      
      alert('菜品信息已更新，已提交审核！')
      router.push('/modify-dish')
    }
    
    const goBack = () => {
      router.push('/modify-dish')
    }
    
    onMounted(() => {
      loadDishData()
    })
    
    return {
      formData,
      addSubItem,
      removeSubItem,
      handleImageUpload,
      submitForm,
      goBack
    }
  }
}
</script>

