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
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">举报人</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">举报类型</th>
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
                <div class="font-medium">
                  <span class="iconify inline-block mr-1" data-icon="mdi:account"></span>
                  {{ report.reporterNickname || report.reporter?.nickname || '未知用户' }}
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="text-sm">
                  {{ report.targetType === 'review' ? '评价' : '评论' }}
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
              </td>
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  class="px-4 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200 flex items-center justify-center mx-auto"
                  @click="openDetailDialog(report)"
                >
                  <span class="iconify inline-block mr-1" data-icon="carbon:view" style="vertical-align: middle;"></span>
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 详情对话框 -->
      <div
        v-if="selectedReport"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="closeDetailDialog"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          <!-- 对话框头部 -->
          <div class="px-8 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
            <h3 class="text-xl font-semibold text-gray-900 flex items-center">
              <span class="iconify inline-block mr-3 text-tsinghua-purple" data-icon="carbon:warning" style="font-size: 24px;"></span>
              举报详情
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition"
              @click="closeDetailDialog"
            >
              <span class="iconify text-xl" data-icon="carbon:close"></span>
            </button>
          </div>

          <!-- 对话框内容 -->
          <div class="px-8 py-6 overflow-y-auto flex-1 bg-gray-50">
            <div class="space-y-5">
              <!-- 基本信息 -->
              <div class="bg-white rounded-xl shadow-sm p-6">
                <div class="grid grid-cols-2 gap-6">
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">举报人</div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ selectedReport.reporterNickname || selectedReport.reporter?.nickname || '未知用户' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">举报类型</div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ selectedReport.targetType === 'review' ? '评价' : '评论' }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">举报时间</div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ formatDate(selectedReport.createdAt) }}
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">处理状态</div>
                    <span
                      class="inline-block px-3 py-1 rounded-full text-xs font-medium"
                      :class="statusClasses[selectedReport.status]"
                    >
                      {{ statusText[selectedReport.status] }}
                    </span>
                  </div>
                </div>
                
                <div v-if="selectedReport.handleResult" class="mt-6 pt-6 border-t border-gray-100">
                  <div class="text-xs text-gray-400 uppercase tracking-wide mb-2">处理结果</div>
                  <div class="text-sm text-gray-700">
                    {{ selectedReport.handleResult }}
                  </div>
                </div>
              </div>

              <!-- 举报原因 - 重点突出 -->
              <div class="bg-white rounded-xl shadow-md p-6">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">
                  举报原因
                </h4>
                <div class="text-sm text-gray-700 leading-relaxed">
                  <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300">
                    {{ selectedReport.reason || '未填写' }}
                  </div>
                </div>
              </div>

              <!-- 被举报内容 - 重点突出 -->
              <div class="bg-white rounded-xl shadow-md p-6">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">
                  被举报内容
                </h4>
                <div v-if="selectedReport.targetContent">
                  <div class="mb-4 text-sm">
                    <span class="text-gray-500">发布者：</span>
                    <span class="text-gray-900 font-medium ml-2">
                      {{ selectedReport.targetContent.userNickname || '未知用户' }}
                    </span>
                  </div>
                  <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300">
                    <div class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {{ selectedReport.targetContent.content || '（无内容）' }}
                    </div>
                  </div>
                  <div v-if="selectedReport.targetContent.isDeleted" class="mt-3 flex items-center text-xs text-red-600">
                    <span class="iconify inline-block mr-1.5" data-icon="carbon:warning"></span>
                    内容已被删除
                  </div>
                </div>
                <div v-else class="text-sm text-gray-400">
                  内容不存在或已被删除
                </div>
              </div>
            </div>
          </div>

          <!-- 对话框底部操作按钮 -->
          <div class="px-6 py-4 border-t bg-white">
            <div v-if="selectedReport.status === 'pending'" class="flex items-center justify-end space-x-3">
              <button
                v-if="selectedReport.targetType === 'review' && selectedReport.targetContent && !selectedReport.targetContent.isDeleted"
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition duration-200 flex items-center"
                @click="handleDeleteReview(selectedReport)"
                :disabled="!authStore.hasPermission('review:delete')"
                :title="!authStore.hasPermission('review:delete') ? '无权限删除评价' : '删除被举报的评价'"
              >
                <span class="iconify inline-block mr-1.5" data-icon="carbon:trash-can" style="font-size: 16px;"></span>
                删除评价
              </button>
              <button
                v-if="selectedReport.targetType === 'comment' && selectedReport.targetContent && !selectedReport.targetContent.isDeleted"
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition duration-200 flex items-center"
                @click="handleDeleteComment(selectedReport)"
                :disabled="!authStore.hasPermission('review:delete')"
                :title="!authStore.hasPermission('review:delete') ? '无权限删除评论' : '删除被举报的评论'"
              >
                <span class="iconify inline-block mr-1.5" data-icon="carbon:trash-can" style="font-size: 16px;"></span>
                删除评论
              </button>
              <button
                class="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition duration-200 flex items-center"
                @click="handleReport(selectedReport, 'reject_report')"
                :disabled="!authStore.hasPermission('report:handle')"
                :title="!authStore.hasPermission('report:handle') ? '无权限处理举报' : '拒绝举报'"
              >
                <span class="iconify inline-block mr-1.5" data-icon="carbon:close" style="font-size: 16px;"></span>
                拒绝举报
              </button>
            </div>
            <div v-else class="text-sm text-gray-500 text-center py-2">
              <span class="iconify inline-block mr-1" data-icon="carbon:checkmark-filled" style="color: #10b981;"></span>
              该举报已处理
            </div>
          </div>
        </div>
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
    const selectedReport = ref<any>(null)

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
          // 如果详情对话框打开，更新选中的举报信息
          if (selectedReport.value && selectedReport.value.id === report.id) {
            // 重新加载该举报的详细信息
            const updatedReport = reports.value.find(r => r.id === report.id)
            if (updatedReport) {
              selectedReport.value = updatedReport
            } else {
              closeDetailDialog()
            }
          }
        } else {
          alert(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评价失败:', error)
        alert('删除评价失败，请重试')
      }
    }

    const handleDeleteComment = async (report: any) => {
      if (!authStore.hasPermission('review:delete')) {
        alert('您没有权限删除评论')
        return
      }

      if (!confirm('确定要删除这个评论吗？此操作不可恢复。')) {
        return
      }

      try {
        const response = await reviewApi.deleteComment(report.targetId)
        if (response.code === 200) {
          alert('删除成功')
          loadReports()
          // 如果详情对话框打开，更新选中的举报信息
          if (selectedReport.value && selectedReport.value.id === report.id) {
            // 重新加载该举报的详细信息
            const updatedReport = reports.value.find(r => r.id === report.id)
            if (updatedReport) {
              selectedReport.value = updatedReport
            } else {
              closeDetailDialog()
            }
          }
        } else {
          alert(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评论失败:', error)
        alert('删除评论失败，请重试')
      }
    }

    const handleReport = async (report: any, action: 'reject_report') => {
      if (!authStore.hasPermission('report:handle')) {
        alert('您没有权限处理举报')
        return
      }

      let confirmMessage = ''
      let defaultResult = ''
      switch (action) {
        case 'reject_report':
          confirmMessage = '确定要拒绝这个举报吗？'
          defaultResult = '举报被拒绝'
          break
      }

      if (!confirm(confirmMessage)) {
        return
      }

      // 构建请求参数，result 为可选字段
      const requestData: { action: 'reject_report'; result?: string } = {
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
          // 如果详情对话框打开，更新选中的举报信息
          if (selectedReport.value && selectedReport.value.id === report.id) {
            // 重新加载该举报的详细信息
            const updatedReport = reports.value.find(r => r.id === report.id)
            if (updatedReport) {
              selectedReport.value = updatedReport
            } else {
              closeDetailDialog()
            }
          }
        } else {
          alert(response.message || '处理失败')
        }
      } catch (error) {
        console.error('处理举报失败:', error)
        alert('处理举报失败，请重试')
      }
    }

    const openDetailDialog = (report: any) => {
      selectedReport.value = report
    }

    const closeDetailDialog = () => {
      selectedReport.value = null
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
      selectedReport,
      statusClasses,
      statusText,
      formatDate,
      handlePageChange,
      handleFilterChange,
      handleDeleteReview,
      handleDeleteComment,
      handleReport,
      openDetailDialog,
      closeDetailDialog,
      authStore,
    }
  },
})
</script>