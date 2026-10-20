<template>
  <div class="admin-page">
    <div class="admin-panel">
      <Header
        title="操作日志"
        description="查看自己与所有层级下属管理员的操作记录；超级管理员可查看全部记录"
        header-icon="carbon:document-view"
      />

      <!-- 筛选区域 -->
      <form class="my-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] items-end gap-3" @submit.prevent="applyFilters">
        <label class="min-w-0 admin-label">
          管理员
          <input
            type="text"
            v-model="filters.adminId"
            placeholder="管理员ID"
            class="mt-1.5 w-full bg-white transition-all hover:border-gray-400 admin-input"
          />
        </label>

        <label class="min-w-0 admin-label">
          操作类型
          <span class="relative block mt-1.5">
            <select
              v-model="filters.action"
              class="w-full bg-white transition-all cursor-pointer hover:border-gray-400 admin-input"
            >
              <option value="">全部操作</option>
              <option v-for="(label, action) in actionLabels" :key="action" :value="action">{{ label }}</option>
            </select>
          </span>
        </label>

        <label class="min-w-0 admin-label">
          开始日期
          <input
            type="date"
            v-model="filters.startDate"
            class="mt-1.5 w-full bg-white transition-all hover:border-gray-400 admin-input"
          />
        </label>

        <label class="min-w-0 admin-label">
          结束日期
          <input
            type="date"
            v-model="filters.endDate"
            :min="filters.startDate"
            class="mt-1.5 w-full bg-white transition-all hover:border-gray-400 admin-input"
          />
        </label>

        <div class="flex items-center justify-end gap-3 sm:col-span-2 xl:col-span-1">
          <button
            type="button"
            class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 hover:bg-gray-200/50 transition-colors admin-button"
            @click="resetFilters"
          >
            <AppIcon class="iconify" icon="carbon:reset"></AppIcon>
            重置
          </button>
          <button type="submit" class="transition duration-200 admin-button admin-button-primary">
            查询
          </button>
        </div>
      </form>

      <!-- 日志列表表格 -->
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">管理员</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">操作</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">目标类型</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">目标ID</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">结果</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">详情</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
              <td class="py-4 px-6 text-sm admin-cell-numeric">
                <div>{{ formatDateTime(log.createdAt) }}</div>
              </td>
              <td class="py-4 px-6">
                <div class="font-medium">{{ log.adminUsername || '未知' }}</div>
                <div class="text-xs text-gray-500">{{ log.adminId }}</div>
              </td>
              <td class="py-4 px-6">
                  <span class="inline-block whitespace-nowrap px-2 py-1 text-xs rounded-full" :class="getActionClass(log.action)">
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td class="py-4 px-6 text-sm">{{ log.targetType || '-' }}</td>
              <td class="py-4 px-6 text-sm text-gray-500">{{ log.targetId || '-' }}</td>
              <td class="py-4 px-6 text-sm" :class="log.result === 'success' ? 'text-green-800' : 'text-red-800'">
                {{ log.result === 'success' ? '成功' : '失败' }}
              </td>
              <td class="py-4 px-6 text-center">
                <button
                  v-if="log.details"
                  class="rounded-full hover:bg-gray-200 text-tsinghua-purple admin-icon-button"
                  @click="viewLogDetail(log)"
                  title="查看详情"
                >
                  <AppIcon class="iconify" icon="carbon:view"></AppIcon>
                </button>
                <span v-else class="text-gray-400">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-if="logs.length === 0 && !loading" class="admin-state">
        <AppIcon
          class="iconify text-6xl text-gray-300 mx-auto"
          icon="carbon:document-view"
        ></AppIcon>
        <p class="mt-4 text-gray-500">暂无日志记录</p>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="admin-state">
        <AppIcon
          class="iconify text-4xl text-gray-400 animate-spin"
          icon="carbon:circle-dash"
        ></AppIcon>
        <p class="mt-4 text-gray-500">加载中...</p>
      </div>

      <Pagination
        v-if="totalPages > 1"
        class="mt-6"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        @page-change="changePage"
      />

    </div>
  </div>

  <!-- 日志详情弹窗 -->
  <AdminDialog
    v-if="selectedLog"
    :open="Boolean(selectedLog)"
    label="日志详情"
    @close="closeLogDetail"
  >
    <div
      class="max-w-2xl w-full mx-4 max-h-[80dvh] overflow-hidden flex flex-col admin-dialog-panel"
      @click.stop
    >
      <div class="flex justify-between items-center shrink-0 admin-dialog-header">
        <h3 class="text-lg font-medium">日志详情</h3>
        <button class="text-gray-400 hover:text-gray-600 admin-icon-button" aria-label="关闭日志详情" @click="closeLogDetail">
          <AppIcon class="iconify text-2xl" icon="carbon:close"></AppIcon>
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 min-h-0 overflow-y-auto break-words admin-dialog-body">
        <div>
          <label class="block font-medium text-gray-600 mb-1 admin-label">时间</label>
          <p class="text-sm text-gray-800">{{ formatDateTime(selectedLog.createdAt) }}</p>
        </div>

        <div>
          <label class="block font-medium text-gray-600 mb-1 admin-label">管理员</label>
          <p class="text-sm text-gray-800">
            {{ selectedLog.adminUsername || '未知' }} ({{ selectedLog.adminId }})
          </p>
        </div>

        <div>
          <label class="block font-medium text-gray-600 mb-1 admin-label">操作</label>
          <p class="text-sm text-gray-800">{{ getActionLabel(selectedLog.action) }}</p>
        </div>

        <div>
          <label class="block font-medium text-gray-600 mb-1 admin-label">目标类型</label>
          <p class="text-sm text-gray-800">{{ selectedLog.targetType || '-' }}</p>
        </div>

        <div v-if="selectedLog.targetId">
          <label class="block font-medium text-gray-600 mb-1 admin-label">目标ID</label>
          <p class="text-sm text-gray-800">{{ selectedLog.targetId }}</p>
        </div>

        <div>
          <label class="block font-medium text-gray-600 mb-1 admin-label">结果</label>
          <p class="text-sm text-gray-800">
            {{ selectedLog.result === 'success' ? '成功' : '失败' }}
          </p>
        </div>

        <div v-if="selectedLog.details" class="min-w-0 sm:col-span-2">
          <label class="block font-medium text-gray-600 mb-1 admin-label">详细信息</label>
          <pre class="text-sm text-gray-800 bg-gray-50 p-3 rounded border overflow-auto">{{
            formatDetails(selectedLog.details)
          }}</pre>
        </div>
      </div>
    </div>
  </AdminDialog>
</template>

<script>
import { ref, reactive, onMounted, onActivated } from 'vue'
import { logApi } from '@/api/modules/log'
import Header from '@/components/Layout/Header.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import Pagination from '@/components/Common/Pagination.vue'
import { useNotification } from '@/composables/useNotification'

export default {
  name: 'LogView',
  components: {
    Header,
    AdminDialog,
    Pagination,
  },
  setup() {
    const notify = useNotification()
    const loading = ref(false)
    const logs = ref([])
    const selectedLog = ref(null)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const totalPages = ref(1)
    const total = ref(0)

    const filters = reactive({
      adminId: '',
      action: '',
      startDate: '',
      endDate: '',
    })

    const formatLocalDateBoundary = (dateString, endOfDay = false) => {
      const [year, month, day] = dateString.split('-').map(Number)
      const boundary = new Date(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
      )
      const offsetMinutes = -boundary.getTimezoneOffset()
      const offsetSign = offsetMinutes >= 0 ? '+' : '-'
      const absoluteOffset = Math.abs(offsetMinutes)
      const pad = (value) => String(value).padStart(2, '0')
      const time = endOfDay ? '23:59:59.999' : '00:00:00.000'

      return `${dateString}T${time}${offsetSign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
    }

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
          params.startDate = formatLocalDateBoundary(filters.startDate)
        }
        if (filters.endDate) {
          params.endDate = formatLocalDateBoundary(filters.endDate, true)
        }

        const response = await logApi.getLogs(params)

        if (response.code === 200 && response.data) {
          logs.value = response.data.items || []
          totalPages.value = response.data.meta?.totalPages || 1
          total.value = response.data.meta?.total ?? 0
        } else {
          throw new Error(response.message || '获取日志列表失败')
        }
      } catch (error) {
        console.error('加载日志列表失败:', error)
        notify.error('加载日志列表失败，请刷新重试')
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

    const formatDetails = (details) => JSON.stringify(details, null, 2)

    const actionLabels = {
      create: '创建', update: '更新', delete: '删除', view: '查看',
      approve: '审核通过', reject: '审核拒绝', access_denied: '权限拒绝',
      publish: '发布', revoke: '撤回', enable: '启用', disable: '停用', complete: '完成',
      'admin:create': '创建管理员', 'admin:permissions': '调整管理员授权',
      'admin:handover': '移交下属', 'admin:retire': '停用管理员',
      'admin:password:reset': '重置密码', 'admin:password:change': '修改密码',
      login: '登录', logout: '退出',
    }
    const getActionLabel = (action) => actionLabels[action] || action

    // 获取操作样式类
    const getActionClass = (action) => {
      const classMap = {
        create: 'bg-green-100 text-green-800',
        'admin:create': 'bg-green-100 text-green-800',
        'admin:permissions': 'bg-purple-100 text-purple-800',
        'admin:handover': 'bg-purple-100 text-purple-800',
        'admin:retire': 'bg-gray-100 text-gray-800',
        access_denied: 'bg-red-100 text-red-800',
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

    onActivated(() => {
      loadLogs()
    })

    return {
      loading,
      logs,
      selectedLog,
      filters,
      currentPage,
      totalPages,
      total,
      pageSize,
      loadLogs,
      applyFilters,
      resetFilters,
      viewLogDetail,
      closeLogDetail,
      changePage,
      formatDateTime,
      formatLocalDateBoundary,
      formatDetails,
      actionLabels,
      getActionLabel,
      getActionClass,
    }
  },
}
</script>
