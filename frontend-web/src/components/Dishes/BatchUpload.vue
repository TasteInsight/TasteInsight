<template>
  <div class="space-y-8">
    <!-- 步骤指引 -->
    <div class="bg-blue-50 p-4 rounded-lg">
      <h3 class="font-medium text-blue-700 mb-2 flex items-center space-x-2">
        <span class="iconify" data-icon="carbon:information"></span>
        <span>批量添加说明</span>
      </h3>
      <ol class="text-blue-600 space-y-2 list-decimal ml-5">
        <li>下载模板Excel文件</li>
        <li>按照模板格式填写菜品信息</li>
        <li>上传填写好的Excel文件</li>
        <li>确认解析结果无误后提交</li>
      </ol>
    </div>
    
    <!-- 模板下载 -->
    <div class="border-t border-b py-6">
      <h3 class="font-medium text-gray-700 mb-4">第一步：下载批量导入模板</h3>
      <button 
        class="px-5 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
        @click="downloadTemplate"
        :disabled="loading"
      >
        <span class="iconify mr-1" data-icon="carbon:download"></span>
        {{ loading ? '下载中...' : '下载Excel模板' }}
      </button>
    </div>
    
    <!-- 文件上传 -->
    <div class="border-b pb-6">
      <h3 class="font-medium text-gray-700 mb-4">第二步：上传填写好的Excel文件</h3>
      <div 
        class="border-2 border-dashed rounded-lg p-8 bg-gray-50 flex flex-col items-center justify-center"
        :class="{
          'border-tsinghua-purple': isDragging,
          'border-green-500': uploadedFile
        }"
        @drop.prevent="handleFileDrop"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
      >
        <span 
          class="iconify text-5xl mb-3"
          :class="uploadedFile ? 'text-green-500' : 'text-gray-400'"
          :data-icon="uploadedFile ? 'carbon:checkmark-outline' : 'carbon:document-add'"
        ></span>
        <div class="text-center mb-4">
          <p class="text-gray-600 mb-1">点击或拖拽文件到这里上传</p>
          <p class="text-sm text-gray-500">支持.xlsx格式，文件大小不超过10MB</p>
        </div>
        <button 
          class="px-5 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
          @click="triggerFileInput"
          :disabled="loading"
        >
          <span class="iconify mr-1" data-icon="carbon:upload"></span>
          {{ uploadedFile ? '重新选择文件' : '选择文件' }}
        </button>
        <input 
          ref="fileInput"
          type="file" 
          class="hidden" 
          accept=".xlsx,.xls"
          @change="handleFileSelect"
        >
      </div>
      <p v-if="uploadedFile" class="mt-2 text-green-600 flex items-center">
        <span class="iconify mr-1" data-icon="carbon:checkmark-filled"></span>
        已上传文件: {{ uploadedFile.name }}
      </p>
      <p v-if="uploadError" class="mt-2 text-red-600 flex items-center">
        <span class="iconify mr-1" data-icon="carbon:warning"></span>
        {{ uploadError }}
      </p>
    </div>
    
    <!-- 解析结果预览 -->
    <div v-if="parsedData.length > 0" class="border-b pb-6">
      <h3 class="font-medium text-gray-700 mb-4">第三步：确认解析结果</h3>
      <div class="overflow-auto max-h-96 border rounded-lg">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th 
                v-for="column in previewColumns" 
                :key="column.key"
                class="py-3 px-4 text-left text-sm font-medium text-gray-500"
              >
                {{ column.title }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr 
              v-for="item in parsedData" 
              :key="item.id"
              class="table-row"
            >
              <td 
                v-for="column in previewColumns" 
                :key="column.key"
                class="py-3 px-4"
                :class="getCellClass(item, column.key)"
              >
                {{ item[column.key] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 text-gray-500 text-sm flex items-center space-x-4">
        <p>共解析{{ parsedData.length }}条数据，{{ validCount }}条有效，{{ invalidCount }}条无效</p>
        <div class="flex items-center space-x-2">
          <span class="w-3 h-3 bg-green-500 rounded-full"></span>
          <span class="text-sm">有效数据</span>
          <span class="w-3 h-3 bg-red-500 rounded-full ml-2"></span>
          <span class="text-sm">无效数据</span>
        </div>
      </div>
    </div>
    
    <!-- 提交按钮 -->
    <div class="flex space-x-4">
      <button 
        class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
        :disabled="validCount === 0 || loading"
        @click="submitBatchData"
      >
        <span class="iconify mr-1" data-icon="carbon:checkmark"></span>
        {{ loading ? '导入中...' : `确认导入有效数据 (${validCount}条)` }}
      </button>
      <button 
        class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
        @click="resetBatchData"
        :disabled="loading"
      >
        取消
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'BatchUpload',
  props: {
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const fileInput = ref(null)
    const uploadedFile = ref(null)
    const isDragging = ref(false)
    const uploadError = ref('')
    
    // 预览表格列配置
    const previewColumns = [
      { key: 'id', title: '序号' },
      { key: 'name', title: '菜品名称' },
      { key: 'canteen', title: '食堂' },
      { key: 'window', title: '窗口' },
      { key: 'priceRange', title: '价格区间' },
      { key: 'status', title: '状态' }
    ]
    
    // 模拟解析数据
    const parsedData = ref([
      { id: 1, name: '麻婆豆腐', canteen: '紫荆园', window: '川菜窗口03', priceRange: '¥14-18', status: '有效' },
      { id: 2, name: '回锅肉', canteen: '紫荆园', window: '川菜窗口03', priceRange: '¥18-22', status: '有效' },
      { id: 3, name: '鱼香肉丝', canteen: '紫荆园', window: '川菜窗口03', priceRange: '¥16-20', status: '有效' },
      { id: 4, name: '', canteen: '清芬园', window: '粤菜窗口05', priceRange: '¥20-25', status: '菜品名称不能为空' },
      { id: 5, name: '宫保鸡丁', canteen: '', window: '川菜窗口03', priceRange: '¥15-19', status: '食堂不能为空' }
    ])
    
    const validCount = computed(() => 
      parsedData.value.filter(item => item.status === '有效').length
    )
    
    const invalidCount = computed(() => 
      parsedData.value.filter(item => item.status !== '有效').length
    )
    
    const downloadTemplate = () => {
      // 模拟下载模板文件
      console.log('下载模板文件...')
      // 这里应该调用API下载模板
      alert('模板下载功能开发中...')
    }
    
    const triggerFileInput = () => {
      fileInput.value?.click()
    }
    
    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        validateAndUploadFile(file)
      }
    }
    
    const handleFileDrop = (event) => {
      isDragging.value = false
      const files = event.dataTransfer.files
      if (files.length > 0) {
        validateAndUploadFile(files[0])
      }
    }
    
    const validateAndUploadFile = (file) => {
      uploadError.value = ''
      
      // 验证文件类型
      const allowedTypes = ['.xlsx', '.xls']
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      
      if (!allowedTypes.includes(fileExtension)) {
        uploadError.value = '只支持.xlsx和.xls格式的文件'
        return
      }
      
      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        uploadError.value = '文件大小不能超过10MB'
        return
      }
      
      uploadedFile.value = file
      // 这里应该调用API解析Excel文件
      console.log('上传文件:', file.name)
      
      // 模拟解析过程
      setTimeout(() => {
        // 在实际应用中，这里应该是从API返回的解析结果
        console.log('文件解析完成')
      }, 1000)
    }
    
    const getCellClass = (item, columnKey) => {
      if (columnKey === 'status') {
        return item.status === '有效' ? 'text-green-600' : 'text-red-600'
      }
      return ''
    }
    
    const submitBatchData = () => {
      const validItems = parsedData.value.filter(item => item.status === '有效')
      
      if (validItems.length === 0) {
        alert('没有有效数据可导入')
        return
      }
      
      emit('submit', validItems)
    }
    
    const resetBatchData = () => {
      uploadedFile.value = null
      uploadError.value = ''
      if (fileInput.value) {
        fileInput.value.value = ''
      }
      emit('cancel')
    }
    
    return {
      fileInput,
      uploadedFile,
      isDragging,
      uploadError,
      previewColumns,
      parsedData,
      validCount,
      invalidCount,
      downloadTemplate,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      getCellClass,
      submitBatchData,
      resetBatchData
    }
  }
}
</script>