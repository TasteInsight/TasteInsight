<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="批量添加"
        description="通过上传表格批量添加多个菜品"
        header-icon="carbon:document-multiple-02"
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
            <span
              class="iconify text-5xl text-gray-400 mb-3"
              data-icon="carbon:document-add"
            ></span>
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
            />
          </div>
          <p v-if="uploadedFile" class="mt-2 text-green-600 flex items-center">
            <span class="iconify mr-1" data-icon="carbon:checkmark-filled"></span>
            已上传文件: {{ uploadedFile.name }}
          </p>
        </div>

        <!-- 解析结果预览 -->
        <div class="border-b pb-6">
          <h3 class="font-medium text-gray-700 mb-4">第三步：确认解析结果</h3>
          <div class="overflow-auto max-h-96 border rounded-lg">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">序号</th>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">菜品名称</th>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">食堂</th>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">窗口</th>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">价格区间</th>
                  <th class="py-3 px-4 text-left text-sm font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="item in parsedData" :key="item.id" class="table-row">
                  <td class="py-3 px-4">{{ item.id }}</td>
                  <td class="py-3 px-4">{{ item.name }}</td>
                  <td class="py-3 px-4">{{ item.canteen }}</td>
                  <td class="py-3 px-4">{{ item.window }}</td>
                  <td class="py-3 px-4">{{ item.priceRange }}</td>
                  <td
                    class="py-3 px-4"
                    :class="item.status === '有效' ? 'text-green-600' : 'text-red-600'"
                  >
                    {{ item.status }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-4 text-gray-500 text-sm">
            <p>
              共解析{{ parsedData.length }}条数据，{{ validCount }}条有效，{{ invalidCount }}条无效
            </p>
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="flex space-x-4">
          <button
            class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
            :class="{ 'opacity-50 cursor-not-allowed': !authStore.hasPermission('dish:create') }"
            :disabled="validCount === 0 || !authStore.hasPermission('dish:create')"
            @click="submitBatchData"
            :title="!authStore.hasPermission('dish:create') ? '无权限创建' : '确认导入有效数据'"
          >
            <span class="iconify mr-1" data-icon="carbon:checkmark"></span>确认导入有效数据
          </button>
          <button
            class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="resetBatchData"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useDishStore } from '../store'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '../components/Layout/Header.vue'

export default {
  name: 'BatchAdd',
  components: {
    Header,
  },
  setup() {
    const dishStore = useDishStore()
    const authStore = useAuthStore()
    const fileInput = ref(null)
    const uploadedFile = ref(null)

    // 模拟解析数据
    const parsedData = ref([
      {
        id: 1,
        name: '麻婆豆腐',
        canteen: '紫荆园',
        window: '川菜窗口03',
        priceRange: '¥14-18',
        status: '有效',
      },
      {
        id: 2,
        name: '回锅肉',
        canteen: '紫荆园',
        window: '川菜窗口03',
        priceRange: '¥18-22',
        status: '有效',
      },
      {
        id: 3,
        name: '鱼香肉丝',
        canteen: '紫荆园',
        window: '川菜窗口03',
        priceRange: '¥16-20',
        status: '有效',
      },
      {
        id: 4,
        name: '',
        canteen: '清芬园',
        window: '粤菜窗口05',
        priceRange: '¥20-25',
        status: '菜品名称不能为空',
      },
    ])

    const validCount = computed(
      () => parsedData.value.filter((item) => item.status === '有效').length,
    )

    const invalidCount = computed(
      () => parsedData.value.filter((item) => item.status !== '有效').length,
    )

    const downloadTemplate = () => {
      // 模拟下载模板文件
      alert('模板下载功能开发中...')
    }

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        uploadedFile.value = file
        // 这里应该调用API解析Excel文件
        console.log('上传文件:', file.name)
      }
    }

    const handleFileDrop = (event) => {
      const files = event.dataTransfer.files
      if (files.length > 0) {
        uploadedFile.value = files[0]
        // 这里应该调用API解析Excel文件
        console.log('拖拽上传文件:', files[0].name)
      }
    }

    const submitBatchData = () => {
      if (!authStore.hasPermission('dish:create')) {
        alert('您没有权限创建菜品')
        return
      }
      const validItems = parsedData.value.filter((item) => item.status === '有效')

      validItems.forEach((item) => {
        dishStore.addDish({
          name: item.name,
          canteen: item.canteen,
          window: item.window,
          price: item.priceRange,
          rating: 0,
          status: 'active',
        })
      })

      alert(`成功导入 ${validItems.length} 条菜品数据！`)
      resetBatchData()
    }

    const resetBatchData = () => {
      uploadedFile.value = null
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }

    return {
      fileInput,
      uploadedFile,
      parsedData,
      validCount,
      invalidCount,
      downloadTemplate,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      submitBatchData,
      resetBatchData,
      authStore,
    }
  },
}
</script>
