<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="食堂信息管理" 
            description="管理食堂信息，包括添加、编辑和查看食堂详情"
            header-icon="carbon:building"
          />
          
          <form class="space-y-6">
            <div class="grid grid-cols-2 gap-6">
              <!-- 左侧列 -->
              <div>
                <!-- 食堂名称 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">
                    食堂名称 <span class="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    v-model="formData.name" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：紫荆园"
                    required
                  >
                </div>
                
                <!-- 食堂位置 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">食堂位置</label>
                  <input 
                    type="text" 
                    v-model="formData.position" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                    placeholder="例如：清华大学紫荆公寓区"
                  >
                </div>
                
                <!-- 食堂描述 -->
                <div class="mb-6">
                  <label class="block text-gray-700 font-medium mb-2">食堂描述</label>
                  <textarea 
                    v-model="formData.description" 
                    class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple resize-none"
                    rows="4"
                    placeholder="请输入食堂描述..."
                  ></textarea>
                </div>
                
                <!-- 食堂图片上传 -->
                <div>
                  <label class="block text-gray-700 font-medium mb-2">食堂图片</label>
                  <div class="border-2 border-dashed rounded-lg aspect-square w-[60%] relative flex items-center justify-center bg-gray-50 overflow-hidden">
                    <img 
                      v-if="formData.imageUrl" 
                      :src="formData.imageUrl" 
                      alt="食堂图片预览"
                      class="w-full h-full object-cover object-center"
                    >
                    <div v-else class="text-center p-6">
                      <span class="iconify text-4xl text-gray-400 mx-auto" data-icon="bi:image"></span>
                      <div class="mt-2">点击上传食堂图片</div>
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
                <!-- 营业时间 -->
                <div class="mb-6">
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-gray-700 font-medium">营业时间</label>
                    <button 
                      type="button" 
                      class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                      @click="addOpeningHours"
                    >
                      <span class="iconify" data-icon="carbon:add-alt"></span>
                      添加营业时间
                    </button>
                  </div>
                  
                  <div v-if="formData.openingHours && formData.openingHours.length > 0" class="space-y-3">
                    <div 
                      v-for="(hours, index) in formData.openingHours" 
                      :key="index"
                      class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                    >
                      <div class="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">星期</label>
                          <select 
                            v-model="hours.day" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          >
                            <option value="周一">周一</option>
                            <option value="周二">周二</option>
                            <option value="周三">周三</option>
                            <option value="周四">周四</option>
                            <option value="周五">周五</option>
                            <option value="周六">周六</option>
                            <option value="周日">周日</option>
                            <option value="每天">每天</option>
                          </select>
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">开始时间</label>
                          <input 
                            type="time" 
                            v-model="hours.open" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          >
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">结束时间</label>
                          <input 
                            type="time" 
                            v-model="hours.close" 
                            class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                          >
                        </div>
                      </div>
                      <button 
                        type="button" 
                        class="text-red-500 hover:text-red-700 px-2"
                        @click="removeOpeningHours(index)"
                        title="删除营业时间"
                      >
                        <span class="iconify" data-icon="carbon:trash-can"></span>
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                    <p>可以添加多个营业时间段，例如：周一至周五 6:30-22:00</p>
                  </div>
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
                {{ isSubmitting ? '提交中...' : '保存食堂信息' }}
              </button>
              <button 
                type="button" 
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
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { canteenApi } from '@/api/modules/canteen'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'AddCanteen',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const router = useRouter()
    const isSubmitting = ref(false)
    const isLoading = ref(false)
    
    const formData = reactive({
      name: '',
      position: '',
      description: '',
      image: null,
      imageUrl: '',
      openingHours: []
    })
    
    const handleImageUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        // 验证文件大小（2MB）
        if (file.size > 2 * 1024 * 1024) {
          alert('图片大小不能超过2MB')
          return
        }
        
        formData.image = file
        // 创建预览 URL
        const reader = new FileReader()
        reader.onload = (e) => {
          formData.imageUrl = e.target.result
        }
        reader.readAsDataURL(file)
      }
    }
    
    const addOpeningHours = () => {
      if (!formData.openingHours) {
        formData.openingHours = []
      }
      formData.openingHours.push({ day: '每天', open: '06:30', close: '22:00' })
    }
    
    const removeOpeningHours = (index) => {
      formData.openingHours.splice(index, 1)
    }
    
    const resetForm = () => {
      formData.name = ''
      formData.position = ''
      formData.description = ''
      formData.image = null
      formData.imageUrl = ''
      formData.openingHours = []
    }
    
    const submitForm = async () => {
      // 表单验证
      if (!formData.name || !formData.name.trim()) {
        alert('请填写食堂名称')
        return
      }
      
      if (isSubmitting.value) {
        return
      }
      
      isSubmitting.value = true
      
      try {
        // 1. 上传图片（如果有）
        let imageUrls = []
        if (formData.image && formData.image instanceof File) {
          try {
            // 使用 dishApi 的图片上传方法（通用的图片上传接口）
            const { dishApi } = await import('@/api/modules/dish')
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
        } else if (formData.imageUrl && formData.imageUrl.startsWith('http')) {
          // 如果已有完整的图片 URL（以 http 开头），直接使用
          imageUrls = [formData.imageUrl]
        }
        
        // 2. 构建创建食堂的请求数据
        const createData = {
          name: formData.name.trim(),
          position: formData.position.trim() || undefined,
          description: formData.description.trim() || undefined,
          images: imageUrls.length > 0 ? imageUrls : undefined,
          openingHours: formData.openingHours && formData.openingHours.length > 0 
            ? formData.openingHours.map(hours => ({
                day: hours.day,
                open: hours.open,
                close: hours.close
              }))
            : undefined
        }
        
        // 3. 调用 API 创建食堂
        const response = await canteenApi.createCanteen(createData)
        
        if (response.code === 200 && response.data) {
          alert('食堂信息已成功创建！')
          // 可以选择跳转到食堂列表页面，或者重置表单继续添加
          resetForm()
          // 或者跳转到其他页面
          // router.push('/canteen-list')
        } else {
          throw new Error(response.message || '创建食堂失败')
        }
      } catch (error) {
        console.error('创建食堂失败:', error)
        alert(error instanceof Error ? error.message : '创建食堂失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }
    
    return {
      formData,
      isSubmitting,
      isLoading,
      handleImageUpload,
      addOpeningHours,
      removeOpeningHours,
      resetForm,
      submitForm
    }
  }
}
</script>

