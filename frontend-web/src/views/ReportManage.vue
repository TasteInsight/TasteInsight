<template>
  <div class="admin-page">
    <div class="admin-panel">
      <Header
        title="举报管理"
        description="处理用户举报的评价、评论和社区内容"
        header-icon="carbon:warning"
      />

      <!-- 筛选区域 -->
      <div class="mb-6 mt-6">
        <div class="admin-toolbar">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">处理状态</span>
            <div class="relative">
              <select
                v-model="statusFilter"
                aria-label="处理状态"
                @change="handleFilterChange"
                class="bg-white min-w-[150px] transition-all cursor-pointer hover:border-gray-400 admin-input"
              >
                <option value="">所有状态</option>
                <option value="pending">待处理</option>
                <option value="approved">已处理</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">举报类型</span>
            <div class="relative">
              <select
                v-model="targetTypeFilter"
                aria-label="举报类型"
                @change="handleFilterChange"
                class="bg-white min-w-[150px] transition-all cursor-pointer hover:border-gray-400 admin-input"
              >
                <option value="">所有类型</option>
                <option v-for="targetType in availableTargetTypes" :key="targetType" :value="targetType">
                  {{ reportTargets[targetType].label }}
                </option>
              </select>
            </div>
          </div>

          <div class="ml-auto flex items-center">
            <button
              v-if="statusFilter || targetTypeFilter"
              @click="statusFilter = ''; targetTypeFilter = ''; handleFilterChange()"
              class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 hover:bg-gray-200/50 transition-colors admin-button"
            >
              <AppIcon class="iconify" icon="carbon:reset"></AppIcon>
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <!-- 举报列表表格 -->
      <div class="admin-table-scroll">
        <table class="admin-table">
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
              <td colspan="5" class="admin-state">
                <AppIcon
                  class="iconify inline-block text-2xl animate-spin"
                  icon="mdi:loading"
                ></AppIcon>
                <span class="ml-2">加载中...</span>
              </td>
            </tr>
            <tr v-else-if="reports.length === 0">
              <td colspan="5" class="admin-state">暂无举报记录</td>
            </tr>
            <tr
              v-else
              v-for="report in reports"
              :key="report.id"
              class="hover:bg-gray-50"
            >
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <AdminImage
                    :src="report.reporter?.avatar"
                    variant="avatar"
                    :alt="report.reporterNickname || report.reporter?.nickname || '用户'"
                    image-class="w-8 h-8 rounded-full mr-2 border border-gray-200 object-cover"
                  />
                  <span class="text-sm font-medium text-gray-900">{{ report.reporterNickname || report.reporter?.nickname || '未知用户' }}</span>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="flex items-center space-x-2">
                  <div class="text-sm">
                    {{ reportTargets[report.targetType].label }}
                  </div>
                  <!-- 内容图片数量 -->
                  <div 
                    v-if="report.targetContent?.images?.length"
                    class="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                  >
                    <AppIcon class="iconify inline-block text-sm" icon="carbon:image"></AppIcon>
                    <span>{{ report.targetContent.images.length }} 张</span>
                  </div>
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
                  class="transition duration-200 flex items-center justify-center mx-auto admin-button admin-button-compact admin-button-primary"
                  @click="openDetailDialog(report)"
                >
                  <AppIcon class="iconify inline-block mr-1" icon="carbon:view" style="vertical-align: middle;"></AppIcon>
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 详情对话框 -->
      <AdminDialog
        v-if="selectedReport"
        :open="Boolean(selectedReport)"
        labelledby="report-detail-title"
        @close="closeDetailDialog"
      >
        <div class="max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col admin-dialog-panel">
          <!-- 对话框头部 -->
          <div class="bg-white flex items-center justify-between admin-dialog-header">
            <h3 id="report-detail-title" class="text-xl font-semibold text-gray-900 flex items-center">
              <AppIcon class="iconify inline-block mr-3 text-tsinghua-purple" icon="carbon:warning" style="font-size: 24px;"></AppIcon>
              举报详情
            </h3>
            <button
              aria-label="关闭举报详情"
              class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition admin-icon-button"
              @click="closeDetailDialog"
            >
              <AppIcon class="iconify text-xl" icon="carbon:close"></AppIcon>
            </button>
          </div>

          <!-- 对话框内容 -->
          <div class="overflow-y-auto flex-1 bg-gray-50 admin-dialog-body">
            <div class="space-y-5">
              <!-- 基本信息 -->
              <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="admin-form-grid">
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">举报人</div>
                    <div class="flex items-center">
                      <AdminImage
                        :src="selectedReport.reporter?.avatar"
                        variant="avatar"
                        :alt="selectedReport.reporterNickname || selectedReport.reporter?.nickname || '用户'"
                        image-class="w-6 h-6 rounded-full mr-2 border border-gray-200 object-cover"
                      />
                      <span class="text-sm font-medium text-gray-900">{{ selectedReport.reporterNickname || selectedReport.reporter?.nickname || '未知用户' }}</span>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">举报类型</div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ reportTargets[selectedReport.targetType].label }}
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
                  <div class="mb-4 flex items-center">
                    <span class="text-gray-500 text-sm mr-2">发布者：</span>
                    <AdminImage
                      :src="selectedReport.targetContent.userAvatar"
                      variant="avatar"
                      :alt="selectedReport.targetContent.userNickname || '用户'"
                      image-class="w-6 h-6 rounded-full mr-2 border border-gray-200 object-cover"
                    />
                    <span class="text-gray-900 font-medium text-sm">
                      {{ selectedReport.targetContent.userNickname || '未知用户' }}
                    </span>
                  </div>
                  <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300 mb-4">
                    <div class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {{ selectedReport.targetContent.content || '（无内容）' }}
                    </div>
                  </div>
                  <!-- 内容图片 -->
                  <div 
                    v-if="selectedReport.targetContent.images?.length"
                    class="mb-4"
                  >
                    <div class="text-xs text-gray-400 uppercase tracking-wide mb-2">{{ reportTargets[selectedReport.targetType].label }}图片</div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      <AdminImage
                        v-for="(image, index) in selectedReport.targetContent.images"
                        :key="index"
                        :src="image"
                        :alt="`${reportTargets[selectedReport.targetType].label}图片 ${Number(index) + 1}`"
                        variant="preview"
                        previewable
                        image-class="w-full aspect-square rounded-lg border border-gray-200 object-cover hover:opacity-90"
                        @preview="openImagePreview(selectedReport.targetContent.images, Number(index), `${reportTargets[selectedReport.targetType].label}图片`)"
                      />
                    </div>
                  </div>
                  <div v-if="selectedReport.targetContent.isDeleted" class="mt-3 flex items-center text-xs text-red-600">
                    <AppIcon class="iconify inline-block mr-1.5" icon="carbon:warning"></AppIcon>
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
          <div class="admin-dialog-footer">
            <div v-if="selectedReport.status === 'pending'" class="flex flex-wrap items-center justify-end gap-3 w-full">
              <button
                v-if="selectedReport.targetContent && !selectedReport.targetContent.isDeleted"
                class="bg-red-600 text-white hover:bg-red-700 transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed admin-button"
                @click="handleReport(selectedReport, 'delete_content')"
                :disabled="isHandling || !canDeleteContent(selectedReport)"
                :title="canDeleteContent(selectedReport) ? `删除被举报的${reportTargets[selectedReport.targetType].label}` : `无权限删除${reportTargets[selectedReport.targetType].label}`"
              >
                <AppIcon class="iconify inline-block mr-1.5" icon="carbon:trash-can" style="font-size: 16px;"></AppIcon>
                删除{{ reportTargets[selectedReport.targetType].label }}
              </button>
              <button
                class="bg-gray-600 text-white hover:bg-gray-700 transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed admin-button"
                @click="handleReport(selectedReport, 'reject_report')"
                :disabled="isHandling || !canHandleReport(selectedReport)"
                :title="canHandleReport(selectedReport) ? '拒绝举报' : '无权限处理举报'"
              >
                <AppIcon class="iconify inline-block mr-1.5" icon="carbon:close" style="font-size: 16px;"></AppIcon>
                拒绝举报
              </button>
            </div>
            <div v-else class="text-sm text-gray-500 text-center py-2">
              <AppIcon class="iconify inline-block mr-1" icon="carbon:checkmark-filled" style="color: #10b981;"></AppIcon>
              该举报已处理
            </div>
          </div>
        </div>
      </AdminDialog>

      <Pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalReports"
        @page-change="handlePageChange"
      />
    </div>

    <!-- 图片预览对话框 -->
    <AdminDialog
      v-if="imagePreview.show"
      :open="imagePreview.show"
      label="图片预览"
      @close="closeImagePreview"
      @keydown="handleImageKeyDown"
    >
      <div class="admin-image-viewer">
        <!-- 关闭按钮 -->
        <button
          aria-label="关闭图片预览"
          class="absolute top-4 right-4 z-10 text-white bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition admin-icon-button"
          @click="closeImagePreview"
        >
          <AppIcon class="iconify text-2xl" icon="carbon:close"></AppIcon>
        </button>
        
        <!-- 图片 -->
        <AdminImage
          :src="imagePreview.images[imagePreview.currentIndex]"
          :alt="`${imagePreview.label} ${imagePreview.currentIndex + 1}`"
          variant="preview"
          image-class="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
        
        <!-- 导航按钮 -->
        <button
          v-if="imagePreview.images.length > 1"
          aria-label="上一张图片"
          :aria-disabled="imagePreview.currentIndex === 0"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition disabled:opacity-50 disabled:cursor-not-allowed admin-icon-button"
          @click.stop="previousImage"
          :disabled="imagePreview.currentIndex === 0"
        >
          <AppIcon class="iconify text-2xl" icon="carbon:chevron-left"></AppIcon>
        </button>
        <button
          v-if="imagePreview.images.length > 1"
          aria-label="下一张图片"
          :aria-disabled="imagePreview.currentIndex === imagePreview.images.length - 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition disabled:opacity-50 disabled:cursor-not-allowed admin-icon-button"
          @click.stop="nextImage"
          :disabled="imagePreview.currentIndex === imagePreview.images.length - 1"
        >
          <AppIcon class="iconify text-2xl" icon="carbon:chevron-right"></AppIcon>
        </button>
        
        <!-- 图片计数 -->
        <div
          v-if="imagePreview.images.length > 1"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-50 rounded-full px-4 py-2 text-sm"
        >
          {{ imagePreview.currentIndex + 1 }} / {{ imagePreview.images.length }}
        </div>
      </div>
    </AdminDialog>
  </div>
</template>

<script lang="ts">
import { ref, computed, onMounted, onActivated, defineComponent } from 'vue'
import { reviewApi } from '@/api/modules/review'
import type { GetReportsParams, Report, ReportHandleRequest } from '@/types/api'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import AdminImage from '@/components/Common/AdminImage.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import Pagination from '@/components/Common/Pagination.vue'
import { savePageState, restorePageState } from '@/utils/page-state-cache'
import { showConfirm } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'
import { getAuthSessionVersion } from '@/utils/auth-session'

const PAGE_STATE_KEY = 'report-manage'
const reportTargets = {
  review: { label: '评价', deletePermission: 'review:delete', globalOnly: false },
  comment: { label: '评论', deletePermission: 'comment:delete', globalOnly: false },
  post: { label: '帖子', deletePermission: 'post:delete', globalOnly: true },
  postComment: { label: '帖子评论', deletePermission: 'post:delete', globalOnly: true },
} satisfies Record<Report['targetType'], { label: string; deletePermission: string; globalOnly: boolean }>

export default defineComponent({
  name: 'ReportManage',
  components: {
    AdminImage,
    Header,
    AdminDialog,
    Pagination,
  },
  setup() {
    const notify = useNotification()
    const authStore = useAuthStore()
    const reports = ref<Report[]>([])
    const isLoading = ref(false)
    const isHandling = ref(false)
    const pageSize = ref(20)
    const totalReports = ref(0)

    // 默认状态定义
    const defaultState: {
      currentPage: number
      statusFilter: Report['status'] | ''
      targetTypeFilter: Report['targetType'] | ''
    } = {
      currentPage: 1,
      statusFilter: '',
      targetTypeFilter: '',
    }

    // 从缓存恢复状态
    const restoredState = restorePageState(PAGE_STATE_KEY, defaultState)
    const currentPage = ref(restoredState.currentPage)
    const statusFilter = ref(restoredState.statusFilter)
    const targetTypeFilter = ref(restoredState.targetTypeFilter)
    const canAccessTargetType = (targetType: Report['targetType']) =>
      authStore.user?.scope === 'GLOBAL' || !reportTargets[targetType].globalOnly
    const availableTargetTypes = computed(() =>
      (Object.keys(reportTargets) as Report['targetType'][]).filter(canAccessTargetType),
    )
    const canHandleReport = (report: Report) =>
      authStore.hasPermission('report:handle') && canAccessTargetType(report.targetType)
    const canDeleteContent = (report: Report) =>
      canHandleReport(report) && authStore.hasPermission(reportTargets[report.targetType].deletePermission)

    // 保存页面状态
    const saveState = () => {
      savePageState(PAGE_STATE_KEY, {
        currentPage: currentPage.value,
        statusFilter: statusFilter.value,
        targetTypeFilter: targetTypeFilter.value,
      })
    }
    const selectedReport = ref<Report | null>(null)
    const imagePreview = ref<{
      show: boolean
      images: string[]
      currentIndex: number
      label: string
    }>({
      show: false,
      images: [],
      currentIndex: 0,
      label: '内容图片',
    })

    const statusClasses: Record<Report['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }

    const statusText: Record<Report['status'], string> = {
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
        const params: GetReportsParams = {
          page: currentPage.value,
          pageSize: pageSize.value,
        }
        if (statusFilter.value) {
          params.status = statusFilter.value
        }
        if (targetTypeFilter.value && !canAccessTargetType(targetTypeFilter.value)) {
          targetTypeFilter.value = ''
          saveState()
        }
        if (targetTypeFilter.value) {
          params.targetType = targetTypeFilter.value
        }

        const response = await reviewApi.getReports(params)

        if (response.code === 200 && response.data) {
          reports.value = response.data.items || []
          totalReports.value = response.data.meta?.total ?? reports.value.length
        } else {
          reports.value = []
          totalReports.value = 0
        }
      } catch (error) {
        console.error('加载举报列表失败:', error)
        notify.error('加载举报列表失败，请刷新重试')
        reports.value = []
        totalReports.value = 0
      } finally {
        isLoading.value = false
      }
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      saveState() // 保存状态
      loadReports()
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      saveState() // 保存状态
      loadReports()
    }

    const handleReport = async (report: Report, action: 'delete_content' | 'reject_report') => {
      if (isHandling.value || report.status !== 'pending') return
      if (!canHandleReport(report)) {
        notify.error('您没有权限处理举报')
        return
      }
      const deleting = action === 'delete_content'
      const target = reportTargets[report.targetType]
      if (deleting && !canDeleteContent(report)) {
        notify.error(`您没有权限删除${target.label}`)
        return
      }
      if (deleting && (!report.targetContent || report.targetContent.isDeleted)) return

      isHandling.value = true
      const sessionVersion = getAuthSessionVersion()
      try {
        const confirmed = await showConfirm(
          deleting ? `确定要删除这个${target.label}吗？此操作不可恢复。` : '确定要拒绝这个举报吗？',
          deleting ? '确认删除' : '确认操作',
        )
        if (!confirmed || sessionVersion !== getAuthSessionVersion()) return
        if (!canHandleReport(report) || (deleting && !canDeleteContent(report))) {
          notify.info('权限已变更，请刷新后重试')
          return
        }
        const requestData: ReportHandleRequest = deleting
          ? { action }
          : { action, result: '举报被拒绝' }
        const response = await reviewApi.handleReport(report.id, requestData)
        if (sessionVersion !== getAuthSessionVersion()) return

        if (response.code === 200) {
          notify.success(deleting ? '删除成功' : '处理成功')
          await loadReports()
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
          notify.error(response.message || (deleting ? '删除失败' : '处理失败'))
        }
      } catch (error) {
        if (sessionVersion !== getAuthSessionVersion()) return
        console.error('处理举报失败:', error)
        notify.error(deleting ? `删除${target.label}失败，请重试` : '处理举报失败，请重试')
      } finally {
        isHandling.value = false
      }
    }

    const openDetailDialog = (report: Report) => {
      selectedReport.value = report
    }

    const closeDetailDialog = () => {
      selectedReport.value = null
    }

    const openImagePreview = (images: string[], index: number = 0, label = '内容图片') => {
      imagePreview.value = {
        show: true,
        images,
        currentIndex: index,
        label,
      }
    }

    const closeImagePreview = () => {
      imagePreview.value = {
        show: false,
        images: [],
        currentIndex: 0,
        label: '内容图片',
      }
    }

    const previousImage = () => {
      if (imagePreview.value.currentIndex > 0) {
        imagePreview.value.currentIndex--
      }
    }

    const nextImage = () => {
      if (imagePreview.value.currentIndex < imagePreview.value.images.length - 1) {
        imagePreview.value.currentIndex++
      }
    }

    // 键盘快捷键支持
    const handleImageKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        previousImage()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextImage()
      }
    }

    onMounted(() => {
      loadReports()
    })

    onActivated(() => {
      // 组件激活时仅重新加载数据，避免重复恢复状态覆盖当前修改
      loadReports()
    })

    return {
      reports,
      isLoading,
      isHandling,
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
      handleReport,
      reportTargets,
      availableTargetTypes,
      canHandleReport,
      canDeleteContent,
      openDetailDialog,
      closeDetailDialog,
      imagePreview,
      openImagePreview,
      closeImagePreview,
      handleImageKeyDown,
      previousImage,
      nextImage,
      authStore,
    }
  },
})
</script>
