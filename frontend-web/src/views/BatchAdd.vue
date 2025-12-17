<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="批量添加菜品" 
            description="通过上传表格批量添加多个菜品"
            header-icon="carbon:document-multiple"
          />
          
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
              >
                <span class="iconify mr-1" data-icon="carbon:download"></span>下载Excel模板
              </button>
            </div>
            
            <!-- 文件上传 -->
            <div class="border-b pb-6">
              <h3 class="font-medium text-gray-700 mb-4">第二步：上传填写好的Excel文件</h3>
              <div 
                class="border-2 border-dashed rounded-lg p-8 bg-gray-50 flex flex-col items-center justify-center"
                @drop.prevent="handleFileDrop"
                @dragover.prevent
              >
                <span class="iconify text-5xl text-gray-400 mb-3" data-icon="carbon:document-add"></span>
                <div class="text-center mb-4">
                  <p class="text-gray-600 mb-1">点击或拖拽文件到这里上传</p>
                  <p class="text-sm text-gray-500">支持.xlsx格式，文件大小不超过10MB</p>
                </div>
                <button 
                  class="px-5 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                  @click="triggerFileInput"
                >
                  <span class="iconify mr-1" data-icon="carbon:upload"></span>选择文件
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
            </div>
            
            <!-- 解析结果预览 -->
            <div class="border-b pb-6" v-if="parsedData.length > 0 || isParsing">
              <h3 class="font-medium text-gray-700 mb-4">第三步：确认解析结果</h3>
              <div v-if="isParsing" class="text-center py-8">
                <span class="iconify text-4xl text-tsinghua-purple animate-spin" data-icon="carbon:circle-dash"></span>
                <p class="mt-2 text-gray-600">正在解析文件，请稍候...</p>
              </div>
              <div v-else class="overflow-auto max-h-96 border rounded-lg">
                <table class="w-full min-w-[1400px]">
                  <thead class="bg-gray-50 sticky top-0">
                    <tr>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">序号</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">食堂</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">楼层</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">窗口</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">窗口编号</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">菜品名</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">菜品子项</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">价格</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">价格单位</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">供应时间</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">供应时段</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">菜品描述</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">Tags</th>
                      <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">状态</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr 
                      v-for="(item, index) in parsedData" 
                      :key="item.tempId || index"
                      class="hover:bg-gray-50"
                      :class="{
                        'bg-red-50': item.status === 'invalid',
                        'bg-yellow-50': item.status === 'warning'
                      }"
                    >
                      <td class="py-3 px-4 text-sm">{{ index + 1 }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.canteenName || '-' }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.floorName || '-' }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.windowName || '-' }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.windowNumber || '-' }}</td>
                      <td class="py-3 px-4 text-sm font-medium">{{ item.name || '-' }}</td>
                      <td class="py-3 px-4 text-sm">
                        <span v-if="item.subDishNames && item.subDishNames.length > 0">
                          {{ item.subDishNames.join(', ') }}
                        </span>
                        <span v-else class="text-gray-400">-</span>
                      </td>
                      <td class="py-3 px-4 text-sm">¥{{ item.price || '-' }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.priceUnit || '元' }}</td>
                      <td class="py-3 px-4 text-sm">{{ item.supplyTime || '-' }}</td>
                      <td class="py-3 px-4 text-sm">
                        <span v-if="item.supplyPeriod && item.supplyPeriod.length > 0">
                          {{ item.supplyPeriod.join(', ') }}
                        </span>
                        <span v-else class="text-gray-400">-</span>
                      </td>
                      <td class="py-3 px-4 text-sm max-w-xs truncate" :title="item.description || ''">
                        {{ item.description || '-' }}
                      </td>
                      <td class="py-3 px-4 text-sm">
                        <div v-if="item.tags && item.tags.length > 0" class="flex flex-wrap gap-1">
                          <span 
                            v-for="tag in item.tags" 
                            :key="tag"
                            class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                          >
                            {{ tag }}
                          </span>
                        </div>
                        <span v-else class="text-gray-400">-</span>
                      </td>
                      <td class="py-3 px-4 text-sm">
                        <span 
                          v-if="item.status === 'valid'"
                          class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                        >
                          有效
                        </span>
                        <span 
                          v-else-if="item.status === 'warning'"
                          class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium"
                        >
                          警告
                        </span>
                        <span 
                          v-else
                          class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"
                        >
                          无效
                        </span>
                        <div v-if="item.message" class="mt-1 text-xs text-gray-500" :title="item.message">
                          {{ item.message }}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-4 text-gray-500 text-sm flex items-center justify-between">
                <p>共解析{{ parsedData.length }}条数据，{{ validCount }}条有效，{{ warningCount }}条警告，{{ invalidCount }}条无效</p>
                <button 
                  v-if="parsedData.length > 0"
                  class="text-tsinghua-purple hover:text-tsinghua-dark text-sm"
                  @click="exportErrorList"
                >
                  <span class="iconify mr-1" data-icon="carbon:download"></span>
                  导出错误列表
                 </button>
              </div>
            </div>
            
            <!-- 提交按钮 -->
            <div class="flex space-x-4" v-if="parsedData.length > 0">
              <button 
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="validCount + warningCount === 0 || isSubmitting"
                @click="submitBatchData"
              >
                <span 
                  v-if="isSubmitting"
                  class="iconify mr-1 animate-spin" 
                  data-icon="carbon:circle-dash"
                ></span>
                <span 
                  v-else
                  class="iconify mr-1" 
                  data-icon="carbon:checkmark"
                ></span>
                {{ isSubmitting ? '导入中...' : `确认导入有效数据 (${validCount + warningCount} 条)` }}
              </button>
              <button 
                class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                :disabled="isSubmitting"
                @click="resetBatchData"
              >
                取消
              </button>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="parseError" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-start">
                <span class="iconify text-red-500 mt-1 mr-2" data-icon="carbon:warning"></span>
                <div>
                  <h4 class="font-medium text-red-800">解析失败</h4>
                  <p class="text-sm text-red-600 mt-1">{{ parseError }}</p>
                </div>
              </div>
            </div>
          </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { dishApi } from '@/api/modules/dish'
import type { BatchParsedDish } from '@/types/api'
import Header from '@/components/Layout/Header.vue'

const fileInput = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<File | null>(null)
const parsedData = ref<BatchParsedDish[]>([])
const isParsing = ref(false)
const isSubmitting = ref(false)
const parseError = ref<string | null>(null)
    
    const validCount = computed(() => 
      parsedData.value.filter((item: BatchParsedDish) => item.status === 'valid').length
    )
    
    const warningCount = computed(() => 
      parsedData.value.filter((item: BatchParsedDish) => item.status === 'warning').length
    )
    
    const invalidCount = computed(() => 
      parsedData.value.filter((item: BatchParsedDish) => item.status === 'invalid').length
    )

    const downloadTemplate = () => {
      // TODO: 实现模板下载功能
      alert('模板下载功能开发中...')
    }

    const triggerFileInput = () => {
      fileInput.value?.click()
    }
    
    const parseFile = async (file: File) => {
      // 验证文件类型
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
      ]
      const hasValidMime = !file.type || validTypes.includes(file.type)
      const hasValidExtension = /\.(xlsx|xls)$/i.test(file.name)
      if (!hasValidMime || !hasValidExtension) {
        alert('请上传 Excel 文件（.xlsx 或 .xls 格式）')
        return
      }
      
      // 验证文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        alert('文件大小不能超过 10MB')
        return
      }
      
      uploadedFile.value = file
      isParsing.value = true
      parseError.value = null
      parsedData.value = []
      
      try {
        const response = await dishApi.parseBatchExcel(file)
        
        if (response.code === 200 && response.data) {
          // 为每条数据添加临时ID（如果后端没有提供）
          parsedData.value = response.data.items.map((item, index) => ({
            ...item,
            tempId: item.tempId || `temp-${index}-${Date.now()}`
          }))
          
          if (parsedData.value.length === 0) {
            alert('解析完成，但未找到有效数据')
          }
        } else {
          throw new Error(response.message || '解析文件失败')
        }
      } catch (error) {
        console.error('解析文件失败:', error)
        parseError.value = error instanceof Error ? error.message : '解析文件失败，请检查文件格式'
        alert(parseError.value)
        parsedData.value = []
      } finally {
        isParsing.value = false
      }
    }
    
    const handleFileSelect = (event: Event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        parseFile(file)
      }
    }
    
    const handleFileDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        parseFile(files[0])
      }
    }
    
    const submitBatchData = async () => {
      const validItems = parsedData.value.filter(
        (item: BatchParsedDish) => item.status === 'valid' || item.status === 'warning'
      )
      
      if (validItems.length === 0) {
        alert('没有可导入的有效数据')
        return
      }
      
      if (!confirm(`确定要导入 ${validItems.length} 条数据吗？`)) {
        return
      }
      
      isSubmitting.value = true
      
      try {
        const response = await dishApi.confirmBatchImport({
          dishes: validItems
        })
        
        if (response.code === 200 && response.data) {
          const { successCount, failCount, errors } = response.data
          
          let message = `导入完成！成功：${successCount} 条`
          if (failCount > 0) {
            message += `，失败：${failCount} 条`
            if (errors && errors.length > 0) {
              message += '\n\n失败详情：\n' + errors.map(e => {
                const typeLabel =
                  e.type === 'permission'
                    ? '[权限]'
                    : e.type === 'validation'
                      ? '[校验]'
                      : '[系统]'
                return `${typeLabel} 第 ${e.index + 1} 条：${e.message}`
              }).join('\n')
            }
          }
          
          alert(message)
          
          // 重置数据
          resetBatchData()
        } else {
          throw new Error(response.message || '导入失败')
        }
      } catch (error) {
        console.error('导入失败:', error)
        alert(error instanceof Error ? error.message : '导入失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    const resetBatchData = () => {
      uploadedFile.value = null
      parsedData.value = []
      parseError.value = null
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }
    
    const exportErrorList = () => {
      const errorItems = parsedData.value.filter((item: BatchParsedDish) => item.status === 'invalid')
      if (errorItems.length === 0) {
        alert('没有错误数据可导出')
        return
      }
      
      // 构建 CSV 内容
      const headers = ['序号', '食堂', '楼层', '窗口', '窗口编号', '菜品名', '错误信息']
      const rows = errorItems.map((item: BatchParsedDish, index: number) => [
        index + 1,
        item.canteenName || '',
        item.floorName || '',
        item.windowName || '',
        item.windowNumber || '',
        item.name || '',
        item.message || '未知错误'
      ])
      
      const csvContent = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      // 创建下载链接
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `批量导入错误列表_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
</script>
