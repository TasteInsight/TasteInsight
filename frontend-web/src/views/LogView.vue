<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="操作日志"
        description="查看系统操作日志，包括管理员操作记录和详细信息"
        header-icon="carbon:document-view"
      />

      <!-- 筛选区域 -->
      <div class="mt-6 mb-6 p-6 bg-gray-50 border rounded-lg">
        <div class="grid grid-cols-4 gap-4">
          <!-- 管理员筛选 -->
          <div>
            <label class="block text-sm text-gray-600 mb-2">管理员</label>
            <input
              type="text"
              v-model="filters.adminId"
              placeholder="管理员ID"
              class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
            />
          </div>

          <!-- 操作类型筛选 -->
          <div>
            <label class="block text-sm text-gray-600 mb-2">操作类型</label>
            <select
              v-model="filters.action"
              class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
            >
              <option value="">全部操作</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
              <option value="view">查看</option>
              <option value="approve">审核通过</option>
              <option value="reject">审核拒绝</option>
            </select>
          </div>

          <!-- 开始日期 -->
          <div>
            <label class="block text-sm text-gray-600 mb-2">开始日期</label>
            <input
              type="date"
              v-model="filters.startDate"
              class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
            />
          </div>

          <!-- 结束日期 -->
          <div>
            <label class="block text-sm text-gray-600 mb-2">结束日期</label>
            <input
              type="date"
              v-model="filters.endDate"
              :min="filters.startDate"
              class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple text-sm"
            />
          </div>
        </div>

        <!-- 筛选按钮 -->
        <div class="flex justify-end gap-3 mt-4">
          <button
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
            @click="resetFilters"
          >
            重置
          </button>
          <button
            class="px-4 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
            @click="applyFilters"
          >
            查询
          </button>
        </div>
      </div>

      <!-- 日志列表表格 -->
      <div class="overflow-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">管理员</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">操作</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">资源</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">资源ID</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">IP地址</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">详情</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
              <td class="py-4 px-6 text-sm">
                <div>{{ formatDateTime(log.createdAt) }}</div>
              </td>
              <td class="py-4 px-6">
                <div class="font-medium">{{ log.adminName || '未知' }}</div>
                <div class="text-xs text-gray-500">{{ log.adminId }}</div>
              </td>
              <td class="py-4 px-6">
                <span class="px-2 py-1 text-xs rounded-full" :class="getActionClass(log.action)">
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td class="py-4 px-6 text-sm">{{ log.resource || '-' }}</td>
              <td class="py-4 px-6 text-sm text-gray-500">{{ log.resourceId || '-' }}</td>
              <td class="py-4 px-6 text-sm text-gray-500">{{ log.ipAddress || '-' }}</td>
              <td class="py-4 px-6 text-center">
                <button
                  v-if="log.details"
                  class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                  @click="viewLogDetail(log)"
                  title="查看详情"
                >
                  <span class="iconify" data-icon="carbon:view"></span>
                </button>
                <span v-else class="text-gray-400">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-if="logs.length === 0 && !loading" class="text-center py-12">
        <span
          class="iconify text-6xl text-gray-300 mx-auto"
          data-icon="carbon:document-view"
        ></span>
        <p class="mt-4 text-gray-500">暂无日志记录</p>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-12">
        <span
          class="iconify text-4xl text-gray-400 animate-spin"
          data-icon="carbon:circle-dash"
        ></span>
        <p class="mt-4 text-gray-500">加载中...</p>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
        <button
          @click="changePage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <button
          v-for="page in totalPages"
          :key="page"
          @click="changePage(page)"
          class="px-4 py-2 border rounded-lg transition"
          :class="
            currentPage === page
              ? 'bg-tsinghua-purple text-white border-tsinghua-purple'
              : 'border-gray-300 hover:bg-gray-50'
          "
        >
          {{ page }}
        </button>
        <button
          @click="changePage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </div>
  </div>

  <!-- 日志详情弹窗 -->
  <div
    v-if="selectedLog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="closeLogDetail"
  >
    <div
      class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
      @click.stop
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">日志详情</h3>
        <button class="text-gray-400 hover:text-gray-600" @click="closeLogDetail">
          <span class="iconify text-2xl" data-icon="carbon:close"></span>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">时间</label>
          <p class="text-sm text-gray-800">{{ formatDateTime(selectedLog.createdAt) }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">管理员</label>
          <p class="text-sm text-gray-800">
            {{ selectedLog.adminName || '未知' }} ({{ selectedLog.adminId }})
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">操作</label>
          <p class="text-sm text-gray-800">{{ getActionLabel(selectedLog.action) }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">资源</label>
          <p class="text-sm text-gray-800">{{ selectedLog.resource || '-' }}</p>
        </div>

        <div v-if="selectedLog.resourceId">
          <label class="block text-sm font-medium text-gray-600 mb-1">资源ID</label>
          <p class="text-sm text-gray-800">{{ selectedLog.resourceId }}</p>
        </div>

        <div v-if="selectedLog.details">
          <label class="block text-sm font-medium text-gray-600 mb-1">详细信息</label>
          <pre class="text-sm text-gray-800 bg-gray-50 p-3 rounded border overflow-auto">{{
            selectedLog.details
          }}</pre>
        </div>

        <div v-if="selectedLog.ipAddress">
          <label class="block text-sm font-medium text-gray-600 mb-1">IP地址</label>
          <p class="text-sm text-gray-800">{{ selectedLog.ipAddress }}</p>
        </div>

        <div v-if="selectedLog.userAgent">
          <label class="block text-sm font-medium text-gray-600 mb-1">用户代理</label>
          <p class="text-sm text-gray-800 break-all">{{ selectedLog.userAgent }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { logApi } from '@/api/modules/log'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'LogView',
  components: {
    Header,
  },
  setup() {
    const loading = ref(false)
    const logs = ref([])
    const selectedLog = ref(null)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const totalPages = ref(1)

    const filters = reactive({
      adminId: '',
      action: '',
      startDate: '',
      endDate: '',
    })

    // 加载日志列表
    const loadLogs = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          pageSize: pageSize.value,
        }

        // 添加筛选条件
        if (filters.adminId) {
          params.adminId = filters.adminId
        }
        if (filters.action) {
          params.action = filters.action
        }
        if (filters.startDate) {
          params.startDate = filters.startDate
        }
        if (filters.endDate) {
          params.endDate = filters.endDate
        }

        const response = await logApi.getLogs(params)

        if (response.code === 200 && response.data) {
          logs.value = response.data.items || []
          totalPages.value = response.data.meta?.totalPages || 1
        } else {
          throw new Error(response.message || '获取日志列表失败')
        }
      } catch (error) {
        console.error('加载日志列表失败:', error)
        alert('加载日志列表失败，请刷新重试')
        logs.value = []
      } finally {
        loading.value = false
      }
    }

    // 应用筛选
    const applyFilters = () => {
      currentPage.value = 1
      loadLogs()
    }

    // 重置筛选
    const resetFilters = () => {
      filters.adminId = ''
      filters.action = ''
      filters.startDate = ''
      filters.endDate = ''
      currentPage.value = 1
      loadLogs()
    }

    // 查看日志详情
    const viewLogDetail = (log) => {
      selectedLog.value = log
    }

    // 关闭日志详情
    const closeLogDetail = () => {
      selectedLog.value = null
    }

    // 切换页码
    const changePage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        loadLogs()
      }
    }

    // 格式化日期时间
    const formatDateTime = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }

    // 获取操作标签
    const getActionLabel = (action) => {
      const actionMap = {
        create: '创建',
        update: '更新',
        delete: '删除',
        view: '查看',
        approve: '审核通过',
        reject: '审核拒绝',
        login: '登录',
        logout: '退出',
      }
      return actionMap[action] || action
    }

    // 获取操作样式类
    const getActionClass = (action) => {
      const classMap = {
        create: 'bg-green-100 text-green-800',
        update: 'bg-blue-100 text-blue-800',
        delete: 'bg-red-100 text-red-800',
        view: 'bg-gray-100 text-gray-800',
        approve: 'bg-green-100 text-green-800',
        reject: 'bg-orange-100 text-orange-800',
        login: 'bg-purple-100 text-purple-800',
        logout: 'bg-gray-100 text-gray-800',
      }
      return classMap[action] || 'bg-gray-100 text-gray-800'
    }

    onMounted(() => {
      loadLogs()
    })

    return {
      loading,
      logs,
      selectedLog,
      filters,
      currentPage,
      totalPages,
      loadLogs,
      applyFilters,
      resetFilters,
      viewLogDetail,
      closeLogDetail,
      changePage,
      formatDateTime,
      getActionLabel,
      getActionClass,
    }
  },
}
</script>
