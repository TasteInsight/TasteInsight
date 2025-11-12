<template>
  <div class="w-[1440px] h-[900px] flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 h-full overflow-auto bg-tsinghua-light">
      <div class="p-8 h-full">
        <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="添加新菜品" 
            description="填写菜品信息并上传图片"
            header-icon="carbon:add"
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
                        <option>清芬园</option>
                        <option>听涛园</option>
                      </select>
                    </div>
                    <div>
                      <select v-model="formData.floor" class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple">
                        <option selected disabled>选择楼层</option>
                        <option>一层</option>
                        <option>二层</option>
                        <option>三层</option>
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
                
                <!-- 菜品图片上传 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">菜品图片</label>
                  <div class="border-2 border-dashed rounded-lg h-48 relative flex items-center justify-center bg-gray-50">
                    <div class="text-center p-6">
                      <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
                      <div class="mt-2">点击上传菜品图片</div>
                      <p class="text-sm text-gray-500 mt-1">建议尺寸800x800像素，小于2MB</p>
                    </div>
                    <input 
                      type="file" 
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      @change="handleImageUpload"
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
                        <option>湘菜</option>
                        <option>淮扬菜</option>
                        <option>清真菜</option>
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
                <div>
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
              </div>
            </div>
            
            <!-- 表单按钮 -->
            <div class="flex space-x-4 pt-6 border-t border-gray-200">
              <button 
                type="button" 
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                @click="submitForm"
              >
                <span class="iconify mr-1" data-icon="carbon:save"></span>保存菜品信息
              </button>
              <button 
                type="reset" 
                class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="resetForm"
              >
                重置表单
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive } from 'vue'
import { useDishStore } from '../store'
import Sidebar from '../components/Layout/Sidebar.vue'
import Header from '../components/Layout/Header.vue'

export default {
  name: 'SingleAdd',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const dishStore = useDishStore()
    
    const formData = reactive({
      canteen: '',
      floor: '',
      window: '',
      name: '',
      image: null,
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
        // 这里可以添加图片预览逻辑
      }
    }
    
    const submitForm = () => {
      // 表单验证
      if (!formData.name || !formData.canteen || !formData.window) {
        alert('请填写必填字段')
        return
      }
      
      // 添加到store
      dishStore.addDish({
        name: formData.name,
        canteen: formData.canteen,
        floor: formData.floor,
        window: formData.window,
        cuisine: formData.cuisine,
        price: formData.subItems[0].price,
        rating: 0,
        status: 'pending'
      })
      
      alert('菜品添加成功！')
      resetForm()
    }
    
    const resetForm = () => {
      Object.assign(formData, {
        canteen: '',
        floor: '',
        window: '',
        name: '',
        image: null,
        subItems: [{ name: '', price: '' }],
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
    }
    
    return {
      formData,
      addSubItem,
      removeSubItem,
      handleImageUpload,
      submitForm,
      resetForm
    }
  }
}
</script>