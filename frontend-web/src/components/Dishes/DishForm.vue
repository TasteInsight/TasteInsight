<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div class="grid grid-cols-2 gap-6">
      <!-- 左侧列 -->
      <div>
        <!-- 食堂信息组 -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">食堂信息</label>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">食堂</label>
              <select 
                v-model="formData.canteen" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                :class="{ 'border-red-500': errors.canteen }"
              >
                <option value="" disabled>选择食堂</option>
                <option v-for="canteen in canteenOptions" :key="canteen" :value="canteen">
                  {{ canteen }}
                </option>
              </select>
              <p v-if="errors.canteen" class="text-red-500 text-sm mt-1">{{ errors.canteen }}</p>
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">楼层</label>
              <select 
                v-model="formData.floor" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                :class="{ 'border-red-500': errors.floor }"
              >
                <option value="" disabled>选择楼层</option>
                <option v-for="floor in floorOptions" :key="floor" :value="floor">
                  {{ floor }}
                </option>
              </select>
              <p v-if="errors.floor" class="text-red-500 text-sm mt-1">{{ errors.floor }}</p>
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
            :class="{ 'border-red-500': errors.window }"
            placeholder="例如：川湘风味"
          >
          <p v-if="errors.window" class="text-red-500 text-sm mt-1">{{ errors.window }}</p>
        </div>
        
        <!-- 菜品名称 -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">菜品名称</label>
          <input 
            type="text" 
            v-model="formData.name" 
            class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
            :class="{ 'border-red-500': errors.name }"
            placeholder="例如：水煮肉片"
          >
          <p v-if="errors.name" class="text-red-500 text-sm mt-1">{{ errors.name }}</p>
        </div>
        
        <!-- 菜品图片上传 -->
        <div>
          <label class="block text-gray-700 font-medium mb-2">菜品图片</label>
          <div 
            class="border-2 border-dashed rounded-lg h-48 relative flex items-center justify-center bg-gray-50"
            :class="{ 'border-tsinghua-purple': isDragging }"
            @drop.prevent="handleFileDrop"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
          >
            <div v-if="!previewImage" class="text-center p-6">
              <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
              <div class="mt-2">点击上传菜品图片</div>
              <p class="text-sm text-gray-500 mt-1">建议尺寸800x800像素，小于2MB</p>
            </div>
            <div v-else class="text-center p-6">
              <img :src="previewImage" alt="预览图" class="max-h-32 mx-auto mb-2 rounded">
              <p class="text-sm text-gray-600">点击更换图片</p>
            </div>
            <input 
              ref="fileInput"
              type="file" 
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="image/*"
              @change="handleFileSelect"
            >
          </div>
          <p v-if="errors.image" class="text-red-500 text-sm mt-1">{{ errors.image }}</p>
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
                    min="0"
                    step="0.01"
                  >
                </div>
                <button 
                  type="button" 
                  class="text-red-500 hover:text-red-700 transition-colors"
                  @click="removeSubItem(index)"
                  :disabled="formData.subItems.length <= 1"
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
              <select 
                v-model="formData.cuisine" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
              >
                <option value="" disabled>选择菜系</option>
                <option v-for="cuisine in cuisineOptions" :key="cuisine" :value="cuisine">
                  {{ cuisine }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">主要口味</label>
              <select 
                v-model="formData.taste" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
              >
                <option value="" disabled>选择口味</option>
                <option v-for="taste in tasteOptions" :key="taste" :value="taste">
                  {{ taste }}
                </option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- 供应时间 -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">供应时间</label>
          <div class="space-y-2">
            <div 
              v-for="time in servingTimeOptions" 
              :key="time.value"
              class="flex items-center"
            >
              <input 
                type="checkbox" 
                :id="time.value" 
                v-model="formData.servingTime[time.value]"
                class="mr-2 h-4 w-4 text-tsinghua-purple"
              >
              <label :for="time.value">{{ time.label }}</label>
            </div>
          </div>
        </div>
        
        <!-- 供应季节 -->
        <div>
          <label class="block text-gray-700 font-medium mb-2">供应季节</label>
          <div class="grid grid-cols-4 gap-2">
            <div 
              v-for="season in seasonOptions" 
              :key="season.value"
              class="flex items-center"
            >
              <input 
                type="checkbox" 
                :id="season.value" 
                v-model="formData.seasons[season.value]"
                class="mr-2 h-4 w-4 text-tsinghua-purple"
              >
              <label :for="season.value">{{ season.label }}</label>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 表单按钮 -->
    <div class="flex space-x-4 pt-6 border-t border-gray-200">
      <button 
        type="submit" 
        class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
        :disabled="loading"
      >
        <span class="iconify mr-1" data-icon="carbon:save"></span>
        {{ loading ? '保存中...' : submitText }}
      </button>
      <button 
        type="button" 
        class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
        @click="$emit('cancel')"
        :disabled="loading"
      >
        取消
      </button>
    </div>
  </form>
</template>

<script>
import { ref, reactive, watch, computed } from 'vue'

export default {
  name: 'DishForm',
  props: {
    dish: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    },
    submitText: {
      type: String,
      default: '保存菜品信息'
    }
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const fileInput = ref(null)
    const isDragging = ref(false)
    const previewImage = ref('')
    
    // 选项数据
    const canteenOptions = ['紫荆园', '桃李园', '丁香园', '清芬园', '听涛园', '观畴园']
    const floorOptions = ['一层', '二层', '三层', '地下一层']
    const cuisineOptions = ['川菜', '粤菜', '鲁菜', '湘菜', '淮扬菜', '清真菜', '西餐', '其他']
    const tasteOptions = ['微辣', '中辣', '麻辣', '咸鲜', '酸甜', '清淡']
    const servingTimeOptions = [
      { value: 'breakfast', label: '早餐（6:30-9:30）' },
      { value: 'lunch', label: '午餐（10:30-13:30）' },
      { value: 'dinner', label: '晚餐（16:30-19:30）' },
      { value: 'night', label: '夜宵（19:40-22:00）' }
    ]
    const seasonOptions = [
      { value: 'spring', label: '春季' },
      { value: 'summer', label: '夏季' },
      { value: 'autumn', label: '秋季' },
      { value: 'winter', label: '冬季' }
    ]
    
    // 表单数据
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
    
    // 错误信息
    const errors = reactive({})
    
    // 验证表单
    const validateForm = () => {
      const newErrors = {}
      
      if (!formData.canteen) newErrors.canteen = '请选择食堂'
      if (!formData.floor) newErrors.floor = '请选择楼层'
      if (!formData.window.trim()) newErrors.window = '请输入窗口名称'
      if (!formData.name.trim()) newErrors.name = '请输入菜品名称'
      
      // 验证子项
      formData.subItems.forEach((item, index) => {
        if (!item.name.trim()) {
          newErrors[`subItem_${index}_name`] = '子项名称不能为空'
        }
        if (!item.price || parseFloat(item.price) <= 0) {
          newErrors[`subItem_${index}_price`] = '请输入有效的价格'
        }
      })
      
      Object.assign(errors, newErrors)
      return Object.keys(newErrors).length === 0
    }
    
    // 处理文件选择
    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          errors.image = '文件大小不能超过2MB'
          return
        }
        
        formData.image = file
        const reader = new FileReader()
        reader.onload = (e) => {
          previewImage.value = e.target.result
        }
        reader.readAsDataURL(file)
        delete errors.image
      }
    }
    
    const handleFileDrop = (event) => {
      isDragging.value = false
      const files = event.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          const input = fileInput.value
          if (input) {
            // 创建一个新的FileList
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            input.files = dataTransfer.files
            handleFileSelect({ target: input })
          }
        } else {
          errors.image = '请选择图片文件'
        }
      }
    }
    
    const triggerFileInput = () => {
      fileInput.value?.click()
    }
    
    const addSubItem = () => {
      formData.subItems.push({ name: '', price: '' })
    }
    
    const removeSubItem = (index) => {
      if (formData.subItems.length > 1) {
        formData.subItems.splice(index, 1)
      }
    }
    
    const handleSubmit = () => {
      if (validateForm()) {
        const payload = Object.assign({}, formData)
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'floor')) {
          delete payload.floor
        }
        emit('submit', payload)
      }
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
      previewImage.value = ''
      Object.keys(errors).forEach(key => delete errors[key])
    }
    
    // 监听props.dish变化，用于编辑模式
    watch(() => props.dish, (newDish) => {
      if (newDish) {
        Object.assign(formData, newDish)
        if (newDish.image) {
          previewImage.value = newDish.image
        }
      }
    }, { immediate: true })
    
    return {
      fileInput,
      isDragging,
      previewImage,
      formData,
      errors,
      canteenOptions,
      floorOptions,
      cuisineOptions,
      tasteOptions,
      servingTimeOptions,
      seasonOptions,
      handleFileSelect,
      handleFileDrop,
      triggerFileInput,
      addSubItem,
      removeSubItem,
      handleSubmit,
      resetForm
    }
  }
}
</script>