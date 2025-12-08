<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="举报管理"
        description="处理用户举报的评价和评论"
        header-icon="carbon:warning"
      />

      <!-- 筛选区域 -->
      <div class="p-6 bg-gray-50 border-b">
        <div class="flex items-center space-x-4">
          <select
            class="px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
            v-model="statusFilter"
            @change="handleFilterChange"
          >
            <option value="">所有状态</option>
            <option value="pending">待处理</option>
            <option value="approved">已处理</option>
            <option value="rejected">已拒绝</option>
          </select>
          <select
            class="px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
            v-model="targetTypeFilter"
            @change="handleFilterChange"
          >
            <option value="">所有类型</option>
            <option value="review">评价</option>
            <option value="comment">评论</option>
          </select>
        </div>
      </div>

      <!-- 举报列表表格 -->
      <div class="overflow-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">举报信息</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">被举报内容</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">举报时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="isLoading">
              <td colspan="5" class="py-8 text-center text-gray-500">
                <span
                  class="iconify inline-block text-2xl animate-spin"
                  data-icon="mdi:loading"
                ></span>
                <span class="ml-2">加载中...</span>
              </td>
            </tr>
            <tr v-else-if="reports.length === 0">
              <td colspan="5" class="py-8 text-center text-gray-500">暂无举报记录</td>
            </tr>
            <tr
              v-else
              v-for="report in reports"
              :key="report.id"
              class="hover:bg-gray-50"
            >
              <td class="py-4 px-6">
                <div>
                  <div class="font-medium">
                    <span class="iconify inline-block mr-1" data-icon="mdi:account"></span>
                    {{ report.reporterNickname || report.reporter?.nickname || '未知用户' }}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <span class="font-medium">举报类型：</span>
                    {{ report.targetType === 'review' ? '评价' : '评论' }}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <span class="font-medium">举报原因：</span>
                    {{ report.reason || '未填写' }}
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <div v-if="report.targetContent">
                  <div class="text-sm">
                    <span class="font-medium">发布者：</span>
                    {{ report.targetContent.userNickname || '未知用户' }}
                  </div>
                  <div class="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded border">
                    {{ report.targetContent.content || '（无内容）' }}
                  </div>
                  <div v-if="report.targetContent.isDeleted" class="text-xs text-red-500 mt-1">
                    <span class="iconify inline-block" data-icon="carbon:warning"></span>
                    内容已被删除
                  </div>
                </div>
                <div v-else class="text-sm text-gray-400">
                  内容不存在或已被删除
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="text-sm">
                  {{ formatDate(report.createdAt) }}
                </div>
              </td>
              <td class="py-4 px-6">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClasses[report.status]"
                >
                  {{ statusText[report.status] }}
                </span>
                <div v-if="report.handleResult" class="text-xs text-gray-500 mt-1">
                  {{ report.handleResult }}
                </div>
              </td>
              <td class="py-4 px-6 text-center" @click.stop>
                <div v-if="report.status === 'pending'" class="flex items-center justify-center space-x-2">
                  <button
                    v-if="report.targetType === 'review' && report.targetContent && !report.targetContent.isDeleted"
                    class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition duration-200"
                    @click="handleDeleteReview(report)"
                    :disabled="!authStore.hasPermission('review:delete')"
                    :title="!authStore.hasPermission('review:delete') ? '无权限删除评价' : '删除被举报的评价'"
                  >
                    <span class="iconify inline-block mr-1" data-icon="carbon:trash-can"></span>
                    删除评价
                  </button>
                  <button
                    class="px-3 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200"
                    @click="handleReport(report, 'delete_content')"
                    :disabled="!authStore.hasPermission('report:handle')"
                    :title="!authStore.hasPermission('report:handle') ? '无权限处理举报' : '删除被举报内容'"
                  >
                    <span class="iconify inline-block mr-1" data-icon="carbon:checkmark"></span>
                    删除内容
                  </button>
                  <button
                    class="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition duration-200"
                    @click="handleReport(report, 'warn_user')"
                    :disabled="!authStore.hasPermission('report:handle')"
                    :title="!authStore.hasPermission('report:handle') ? '无权限处理举报' : '警告用户'"
                  >
                    <span class="iconify inline-block mr-1" data-icon="carbon:warning"></span>
                    警告用户
                  </button>
                  <button
                    class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition duration-200"
                    @click="handleReport(report, 'reject_report')"
                    :disabled="!authStore.hasPermission('report:handle')"
                    :title="!authStore.hasPermission('report:handle') ? '无权限处理举报' : '拒绝举报'"
                  >
                    <span class="iconify inline-block mr-1" data-icon="carbon:close"></span>
                    拒绝举报
                  </button>
                </div>
                <div v-else class="text-sm text-gray-400">
                  已处理
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalReports"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent } from 'vue'
import { reviewApi } from '@/api/modules/review'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import Pagination from '@/components/Common/Pagination.vue'

export default defineComponent({
  name: 'ReportManage',
  components: {
    Header,
    Pagination,
  },
  setup() {
    const authStore = useAuthStore()
    const reports = ref<any[]>([])
    const isLoading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const totalReports = ref(0)
    const statusFilter = ref('')
    const targetTypeFilter = ref('')

    const statusClasses: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }

    const statusText: Record<string, string> = {
      pending: '待处理',
      approved: '已处理',
      rejected: '已拒绝',
    }

    const formatDate = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const loadReports = async () => {
      isLoading.value = true
      try {
        const params: any = {
          page: currentPage.value,
          pageSize: pageSize.value,
        }
        if (statusFilter.value) {
          params.status = statusFilter.value
        }

        const response = await reviewApi.getReports(params)

        if (response.code === 200 && response.data) {
          let items = response.data.items || []
          
          // 客户端筛选目标类型
          if (targetTypeFilter.value) {
            items = items.filter((item: any) => item.targetType === targetTypeFilter.value)
          }

          reports.value = items
          totalReports.value = items.length
        } else {
          reports.value = []
          totalReports.value = 0
        }
      } catch (error) {
        console.error('加载举报列表失败:', error)
        alert('加载举报列表失败，请刷新重试')
        reports.value = []
        totalReports.value = 0
      } finally {
        isLoading.value = false
      }
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadReports()
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      loadReports()
    }

    const handleDeleteReview = async (report: any) => {
      if (!authStore.hasPermission('review:delete')) {
        alert('您没有权限删除评价')
        return
      }

      if (!confirm('确定要删除这个评价吗？此操作不可恢复。')) {
        return
      }

      try {
        const response = await reviewApi.deleteReview(report.targetId)
        if (response.code === 200) {
          alert('删除成功')
          loadReports()
        } else {
          alert(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评价失败:', error)
        alert('删除评价失败，请重试')
      }
    }

    const handleReport = async (report: any, action: string) => {
      if (!authStore.hasPermission('report:handle')) {
        alert('您没有权限处理举报')
        return
      }

      let confirmMessage = ''
      let defaultResult = ''
      switch (action) {
        case 'delete_content':
          confirmMessage = '确定要删除被举报的内容吗？'
          defaultResult = '内容已删除'
          break
        case 'warn_user':
          confirmMessage = '确定要警告该用户吗？'
          defaultResult = '已警告用户'
          break
        case 'reject_report':
          confirmMessage = '确定要拒绝这个举报吗？'
          defaultResult = '举报被拒绝'
          break
      }

      if (!confirm(confirmMessage)) {
        return
      }

      // 构建请求参数，result 为可选字段
      const requestData: { action: string; result?: string } = {
        action,
      }
      
      // 根据接口文档，result 是可选的，但我们可以提供默认值
      if (defaultResult) {
        requestData.result = defaultResult
      }

      try {
        const response = await reviewApi.handleReport(report.id, requestData)

        if (response.code === 200) {
          alert('处理成功')
          loadReports()
        } else {
          alert(response.message || '处理失败')
        }
      } catch (error) {
        console.error('处理举报失败:', error)
        alert('处理举报失败，请重试')
      }
    }

    onMounted(() => {
      loadReports()
    })

    return {
      reports,
      isLoading,
      currentPage,
      pageSize,
      totalReports,
      statusFilter,
      targetTypeFilter,
      statusClasses,
      statusText,
      formatDate,
      handlePageChange,
      handleFilterChange,
      handleDeleteReview,
      handleReport,
      authStore,
    }
  },
})
</script>