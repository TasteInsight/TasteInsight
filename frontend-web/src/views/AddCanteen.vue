<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8">
          <!-- 列表视图 -->
          <div v-if="viewMode === 'list'">
            <div class="flex justify-between items-center mb-6">
              <Header 
                title="食堂信息管理" 
                description="管理食堂信息，包括添加、编辑和查看食堂详情"
                header-icon="carbon:restaurant"
              />
              <button 
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                @click="createNewCanteen"
              >
                <span class="iconify mr-1" data-icon="carbon:add"></span>
                新建食堂
              </button>
            </div>
            
            <!-- 搜索栏 -->
            <div class="mb-6">
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="搜索食堂名称、位置..."
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
              >
            </div>
            
            <!-- 食堂列表表格 -->
            <div class="overflow-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂信息</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">位置</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">窗口数量</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评分</th>
                    <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr 
                    v-for="canteen in filteredCanteens" 
                    :key="canteen.id"
                    class="hover:bg-gray-50 cursor-pointer"
                    @click="editCanteen(canteen)"
                  >
                    <td class="py-4 px-6">
                      <div class="flex items-center">
                        <img 
                          v-if="canteen.images && canteen.images.length > 0"
                          :src="canteen.images[0]" 
                          :alt="canteen.name"
                          class="w-12 h-12 rounded object-cover border mr-3"
                        >
                        <div v-else class="w-12 h-12 rounded bg-gray-200 flex items-center justify-center mr-3">
                          <span class="iconify text-gray-400" data-icon="carbon:building"></span>
                        </div>
                        <div>
                          <div class="font-medium">{{ canteen.name }}</div>
                          <div class="text-sm text-gray-500">{{ canteen.description || '暂无描述' }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="py-4 px-6">{{ canteen.position || '未设置' }}</td>
                    <td class="py-4 px-6">{{ canteen.windowsList?.length || 0 }} 个窗口</td>
                    <td class="py-4 px-6">
                      <div class="flex items-center">
                        <span class="iconify text-yellow-400" data-icon="bxs:star"></span>
                        <span class="ml-1">{{ canteen.averageRating?.toFixed(1) || '暂无' }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-6 text-center" @click.stop>
                      <div class="flex items-center justify-center gap-2">
                        <button 
                          class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                          @click="editCanteen(canteen)"
                          title="编辑"
                        >
                          <span class="iconify" data-icon="carbon:edit"></span>
                        </button>
                        <button 
                          class="p-2 rounded-full hover:bg-gray-200 text-red-500"
                          @click="deleteCanteen(canteen)"
                          title="删除"
                        >
                          <span class="iconify" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 空状态 -->
            <div v-if="filteredCanteens.length === 0" class="text-center py-12">
              <span class="iconify text-6xl text-gray-300 mx-auto" data-icon="carbon:building"></span>
              <p class="mt-4 text-gray-500">暂无食堂信息</p>
              <button 
                class="mt-4 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
                @click="createNewCanteen"
              >
                创建第一个食堂
              </button>
            </div>
          </div>
          
          <!-- 编辑/新建视图 -->
          <div v-else>
            <div class="flex justify-between items-center mb-6">
              <Header 
                :title="editingCanteen ? '编辑食堂' : '新建食堂'" 
                :description="editingCanteen ? '修改食堂信息' : '填写食堂信息并上传图片'"
                header-icon="carbon:restaurant"
              />
              <button 
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="backToList"
              >
                返回列表
              </button>
            </div>
            
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
                  
                  <!-- 窗口管理 -->
                  <div class="mb-6">
                    <div class="flex justify-between items-center mb-2">
                      <label class="block text-gray-700 font-medium">窗口管理</label>
                      <button 
                        type="button" 
                        class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                        @click="addWindow"
                        :disabled="!editingCanteen"
                      >
                        <span class="iconify" data-icon="carbon:add-alt"></span>
                        添加窗口
                      </button>
                    </div>
                    
                    <div v-if="windows.length > 0" class="space-y-3">
                      <div 
                        v-for="(window, index) in windows" 
                        :key="window.id || index"
                        class="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                      >
                        <div class="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-xs text-gray-500 mb-1">窗口名称 <span class="text-red-500">*</span></label>
                            <input 
                              type="text" 
                              v-model="window.name" 
                              class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                              placeholder="例如：川湘风味"
                            >
                          </div>
                          <div>
                            <label class="block text-xs text-gray-500 mb-1">窗口编号</label>
                            <input 
                              type="text" 
                              v-model="window.number" 
                              class="w-full px-3 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
                              placeholder="例如：01、A01"
                            >
                          </div>
                        </div>
                        <button 
                          type="button" 
                          class="text-red-500 hover:text-red-700 px-2"
                          @click="removeWindow(index, window.id)"
                          title="删除窗口"
                        >
                          <span class="iconify" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </div>
                    <div v-else-if="editingCanteen" class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      <p>暂无窗口，点击"添加窗口"可以添加新窗口</p>
                    </div>
                    <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                      <p>保存食堂信息后，可以在此添加窗口</p>
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
                  {{ isSubmitting ? '提交中...' : (editingCanteen ? '保存修改' : '保存食堂信息') }}
                </button>
                <button 
                  type="button" 
                  class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                  @click="backToList"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, computed, onMounted } from 'vue'
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
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingCanteen = ref(null) // 当前编辑的食堂
    const canteens = ref([]) // 食堂列表
    const searchQuery = ref('')
    
    const formData = reactive({
      name: '',
      position: '',
      description: '',
      image: null,
      imageUrl: '',
      openingHours: []
    })
    
    const windows = ref([]) // 窗口列表
    
    // 过滤后的食堂列表
    const filteredCanteens = computed(() => {
      if (!searchQuery.value) {
        return canteens.value
      }
      const query = searchQuery.value.toLowerCase()
      return canteens.value.filter(canteen => 
        canteen.name.toLowerCase().includes(query) ||
        (canteen.position && canteen.position.toLowerCase().includes(query))
      )
    })
    
    // 加载食堂列表
    const loadCanteens = async () => {
      isLoading.value = true
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
        alert('加载食堂列表失败，请刷新重试')
      } finally {
        isLoading.value = false
      }
    }
    
    // 加载窗口列表
    const loadWindows = async (canteenId) => {
      try {
        const response = await canteenApi.getWindows(canteenId, { page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          windows.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载窗口列表失败:', error)
        windows.value = []
      }
    }
    
    // 创建新食堂
    const createNewCanteen = () => {
      editingCanteen.value = null
      resetForm()
      viewMode.value = 'edit'
    }
    
    // 编辑食堂
    const editCanteen = async (canteen) => {
      editingCanteen.value = canteen
      // 填充表单数据
      formData.name = canteen.name || ''
      formData.position = canteen.position || ''
      formData.description = canteen.description || ''
      formData.imageUrl = canteen.images && canteen.images.length > 0 ? canteen.images[0] : ''
      formData.image = null
      
      // 处理营业时间
      if (canteen.openingHours && Array.isArray(canteen.openingHours)) {
        formData.openingHours = canteen.openingHours.map(h => ({ ...h }))
      } else {
        formData.openingHours = []
      }
      
      // 加载窗口列表
      await loadWindows(canteen.id)
      
      viewMode.value = 'edit'
    }
    
    // 删除食堂
    const deleteCanteen = async (canteen) => {
      if (!confirm(`确定要删除食堂"${canteen.name}"吗？此操作不可恢复！`)) {
        return
      }
      
      try {
        const response = await canteenApi.deleteCanteen(canteen.id)
        if (response.code === 200) {
          alert('删除成功！')
          loadCanteens()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除食堂失败:', error)
        alert(error instanceof Error ? error.message : '删除食堂失败，请重试')
      }
    }
    
    // 返回列表
    const backToList = () => {
      viewMode.value = 'list'
      editingCanteen.value = null
      resetForm()
    }
    
    // 重置表单
    const resetForm = () => {
      formData.name = ''
      formData.position = ''
      formData.description = ''
      formData.image = null
      formData.imageUrl = ''
      formData.openingHours = []
      windows.value = []
    }
    
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
    
    // 添加窗口
    const addWindow = () => {
      windows.value.push({ name: '', number: '', position: '', description: '', tags: [] })
    }
    
    // 删除窗口
    const removeWindow = async (index, windowId) => {
      if (windowId) {
        // 如果窗口已保存，需要调用删除接口
        if (!confirm('确定要删除这个窗口吗？')) {
          return
        }
        try {
          const response = await canteenApi.deleteWindow(windowId)
          if (response.code === 200) {
            windows.value.splice(index, 1)
            alert('删除成功！')
          } else {
            throw new Error(response.message || '删除失败')
          }
        } catch (error) {
          console.error('删除窗口失败:', error)
          alert(error instanceof Error ? error.message : '删除窗口失败，请重试')
        }
      } else {
        // 如果窗口未保存，直接移除
        windows.value.splice(index, 1)
      }
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
        // 1. 上传图片（如果有新图片）
        let imageUrls = []
        if (formData.image && formData.image instanceof File) {
          try {
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
          // 如果已有完整的图片 URL，直接使用
          imageUrls = [formData.imageUrl]
        }
        
        // 2. 构建请求数据
        const requestData = {
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
        
        // 3. 创建或更新食堂
        let canteenId
        if (editingCanteen.value) {
          // 更新食堂
          const response = await canteenApi.updateCanteen(editingCanteen.value.id, requestData)
          if (response.code === 200 && response.data) {
            canteenId = response.data.id
            alert('食堂信息已更新！')
          } else {
            throw new Error(response.message || '更新食堂失败')
          }
        } else {
          // 创建食堂
          const response = await canteenApi.createCanteen(requestData)
          if (response.code === 200 && response.data) {
            canteenId = response.data.id
            alert('食堂信息已成功创建！')
          } else {
            throw new Error(response.message || '创建食堂失败')
          }
        }
        
        // 4. 保存窗口信息
        if (canteenId && windows.value.length > 0) {
          for (const window of windows.value) {
            if (!window.name || !window.name.trim()) {
              continue // 跳过未填写名称的窗口
            }
            
            try {
              if (window.id) {
                // 更新窗口
                await canteenApi.updateWindow(window.id, {
                  name: window.name.trim(),
                  number: window.number.trim() || undefined,
                  position: window.position || undefined,
                  description: window.description || undefined,
                  tags: window.tags || undefined
                })
              } else {
                // 创建窗口
                await canteenApi.createWindow({
                  name: window.name.trim(),
                  number: window.number.trim() || window.name.trim(),
                  canteenId: canteenId,
                  position: window.position || undefined,
                  description: window.description || undefined,
                  tags: window.tags || undefined
                })
              }
            } catch (error) {
              console.error('保存窗口失败:', error)
              // 继续处理其他窗口，不中断流程
            }
          }
        }
        
        // 5. 重新加载列表并返回
        await loadCanteens()
        backToList()
      } catch (error) {
        console.error('保存食堂失败:', error)
        alert(error instanceof Error ? error.message : '保存食堂失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }
    
    onMounted(() => {
      loadCanteens()
    })
    
    return {
      viewMode,
      editingCanteen,
      canteens,
      searchQuery,
      filteredCanteens,
      formData,
      windows,
      isSubmitting,
      isLoading,
      loadCanteens,
      createNewCanteen,
      editCanteen,
      deleteCanteen,
      backToList,
      handleImageUpload,
      addOpeningHours,
      removeOpeningHours,
      addWindow,
      removeWindow,
      submitForm
    }
  }
}
</script>
