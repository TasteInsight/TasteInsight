<template>
  <div class="admin-page">
    <div class="admin-panel">
      <Header
        title="菜品审核"
        description="审核用户和管理员提交的菜品及补充资料"
        header-icon="carbon:task-approved"
      />

      <!-- 搜索和筛选区域 -->
      <div class="mt-6 admin-filters">
        <!-- 搜索栏 -->
        <div class="relative">
          <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
          <input
            type="text"
            placeholder="搜索菜品名称..."
            class="w-full pl-10 pr-10 admin-input"
            v-model="searchQuery"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-icon-button"
            @click="searchQuery = ''"
            type="button"
            title="清除搜索"
          >
            <AppIcon class="iconify" icon="carbon:close"></AppIcon>
          </button>
        </div>

        <!-- 筛选栏 -->
        <div class="admin-toolbar">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">审核状态</span>
            <div class="relative">
              <select
                v-model="statusFilter"
                class="bg-white min-w-[150px] transition-all cursor-pointer hover:border-gray-400 admin-input"
              >
                <option value="">所有状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
                <option value="withdrawn">已撤回</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-600">所属食堂</span>
            <div class="relative">
              <select
                v-model="canteenFilter"
                class="bg-white min-w-[150px] transition-all cursor-pointer hover:border-gray-400 admin-input"
              >
                <option value="">所有食堂</option>
                <option v-for="canteen in canteens" :key="canteen.id" :value="canteen.id">
                  {{ canteen.name }}
                </option>
              </select>
            </div>
          </div>

          <div v-if="statusFilter || canteenFilter || searchQuery" class="ml-auto flex items-center">
            <button
              @click="statusFilter = ''; canteenFilter = ''; searchQuery = ''"
              class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 hover:bg-gray-200/50 transition-colors admin-button"
            >
              <AppIcon class="iconify" icon="carbon:reset"></AppIcon>
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <!-- 审核表格 -->
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜品信息</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交人</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody v-if="!isLoading && !loadError" class="divide-y divide-gray-200">
            <tr
              v-for="dish in filteredReviewDishes"
              :key="dish.id"
              class="table-row cursor-pointer hover:bg-gray-50"
              @click="viewDishDetail(dish)"
            >
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <AdminImage
                    :src="dish.image"
                    :alt="dish.name"
                    image-class="w-12 h-12 rounded object-cover border mr-3"
                  />
                  <div>
                    <div class="font-medium">{{ dish.name }}</div>
                    <div class="text-sm text-gray-500">{{ dish.location }}</div>
                    <div class="text-xs text-gray-600 mt-1">{{ dish.kind === 'update' ? '补充资料' : dish.targetDishId ? '归并菜品' : '新增菜品' }}</div>
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="font-medium">{{ dish.submitDate }}</div>
                <div class="text-sm text-gray-500">{{ dish.submitTime }}</div>
              </td>
              <td class="py-4 px-6">{{ dish.submitter }}</td>
              <td class="py-4 px-6">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClasses[dish.status]"
                >
                  {{ statusText[dish.status] }}
                </span>
              </td>
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  class="text-white transition duration-200 admin-button admin-button-compact"
                  :class="[
                    !authStore.hasPermission('upload:approve') ? 'bg-gray-400 cursor-not-allowed' :
                    dish.status === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                    'bg-tsinghua-purple hover:bg-tsinghua-dark'
                  ]"
                  @click="reviewDish(dish)"
                  :title="!authStore.hasPermission('upload:approve') ? '无权限审核' : ''"
                >
                  {{
                    dish.status === 'withdrawn' ? '查看详情' : dish.status === 'rejected'
                      ? '重新审核'
                      : dish.status === 'approved'
                        ? '已审核'
                        : '审核'
                  }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="isLoading" class="admin-state">
        <AppIcon
          class="iconify inline-block text-2xl animate-spin"
          icon="mdi:loading"
        ></AppIcon>
        <span class="ml-2">加载中...</span>
      </div>
      <div v-else-if="loadError" class="admin-state">
        <p role="alert" class="text-red-700 mb-3">{{ loadError }}</p>
        <button type="button" class="border hover:bg-gray-50 admin-button admin-button-compact" @click="loadReviewDishes">重试</button>
      </div>
      <div v-else-if="filteredReviewDishes.length === 0" class="admin-state">
        {{ statusFilter === 'pending' && !searchQuery.trim() && !canteenFilter ? '暂无待审核菜品' : '暂无符合条件的记录' }}
      </div>

      <Pagination v-if="!loadError"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalDishes"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref, computed, defineComponent, onMounted, onActivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import { reviewApi } from '@/api/modules/review'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import AdminImage from '@/components/Common/AdminImage.vue'
import Pagination from '@/components/Common/Pagination.vue'
import { savePageState, restorePageState } from '@/utils/page-state-cache'
import { useNotification } from '@/composables/useNotification'
import { contributionLocation } from '@/components/Dishes/contribution-fields'
import type { Canteen, GetPendingParams } from '@/types/api'
import type { ContributionStatus, DishContribution } from '@/types/dish-contribution'

interface ReviewRow {
  id: string
  name: string
  location: string
  submitDate: string
  submitTime: string
  submitter: string
  status: ContributionStatus
  kind: DishContribution['kind']
  targetDishId?: string | null
  image: string
  canteen: string
  window?: string | null
}

const PAGE_STATE_KEY = 'review-dish'

export default defineComponent({
  name: 'ReviewDish',
  components: {
    AdminImage,
    Header,
    Pagination,
  },
  setup() {
    const notify = useNotification()
    const router = useRouter()
    const authStore = useAuthStore()

    // 默认状态定义
    const defaultState = {
      searchQuery: '',
      statusFilter: '' as NonNullable<GetPendingParams['status']> | '',
      canteenFilter: '',
      currentPage: 1,
    }

    // 从缓存恢复状态
    const restoredState = restorePageState(PAGE_STATE_KEY, defaultState)
    const searchQuery = ref(restoredState.searchQuery)
    const statusFilter = ref(restoredState.statusFilter)
    const canteenFilter = ref(restoredState.canteenFilter)
    const currentPage = ref(restoredState.currentPage)
    const pageSize = ref(10)
    const isLoading = ref(false)
    const loadError = ref('')
    const totalDishes = ref(0)

    // 保存页面状态
    const saveState = () => {
      savePageState(PAGE_STATE_KEY, {
        searchQuery: searchQuery.value,
        statusFilter: statusFilter.value,
        canteenFilter: canteenFilter.value,
        currentPage: currentPage.value,
      })
    }

    // 审核数据
    const reviewDishes = ref<ReviewRow[]>([])

    // 食堂列表
    const canteens = ref<Canteen[]>([])

    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-100 text-gray-700',
    }

    const statusText = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      withdrawn: '已撤回',
    }

    const filteredReviewDishes = computed(() => reviewDishes.value)

    const viewDishDetail = (dish: Pick<ReviewRow, 'id'>) => {
      // 保存当前状态后再跳转
      saveState()
      // 跳转到审核详情页面
      router.push(`/review-dish/${dish.id}`)
    }

    const reviewDish = (dish: Pick<ReviewRow, 'id'>) => {
      if (!authStore.hasPermission('upload:approve')) {
        notify.error('您没有权限审核菜品')
        return
      }
      // 保存当前状态后再跳转
      saveState()
      // 跳转到审核详情页面
      router.push(`/review-dish/${dish.id}`)
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      saveState() // 保存状态
      loadReviewDishes()
    }

    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data && response.data.items) {
          canteens.value = response.data.items
          // 旧缓存以食堂名称保存筛选值，查询契约使用食堂 id。
          const selected = canteenFilter.value
          if (selected && !canteens.value.some((canteen) => canteen.id === selected)) {
            canteenFilter.value = canteens.value.find((canteen) => canteen.name === selected)?.id || ''
          }
        } else {
          canteens.value = []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
        canteens.value = []
      }
    }

    let uploadsRequestId = 0
    // 加载审核菜品列表
    const loadReviewDishes = async () => {
      const requestId = ++uploadsRequestId
      isLoading.value = true
      loadError.value = ''
      try {
        // 从 API 获取数据
        const params: GetPendingParams = {
          page: currentPage.value,
          pageSize: pageSize.value,
        }
        if (statusFilter.value) {
          params.status = statusFilter.value
        }
        if (searchQuery.value.trim()) params.keyword = searchQuery.value.trim()
        if (canteenFilter.value) params.canteenId = canteenFilter.value
        const response = await reviewApi.getPendingUploads(params)
        if (requestId !== uploadsRequestId) return

        if (response.code === 200 && response.data && response.data.items) {
          // 转换 API 数据格式
          reviewDishes.value = response.data.items.map((item) => ({
            id: item.id,
            name: item.name,
            location: contributionLocation(item),
            submitDate: item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '',
            submitTime: item.createdAt ? new Date(item.createdAt).toLocaleTimeString('zh-CN') : '',
            submitter: item.uploaderName || '未知',
            status: item.status || 'pending',
            kind: item.kind || 'create',
            targetDishId: item.targetDishId,
            image: item.images && item.images.length > 0 ? item.images[0] : '',
            canteen: item.canteenName,
            window: item.windowName,
          }))
          // 更新总数
          totalDishes.value = response.data.meta?.total || 0
        } else {
          throw new Error(response.message || '审核列表加载失败，请重试')
        }
      } catch (error) {
        if (requestId !== uploadsRequestId) return
        loadError.value = error instanceof Error ? error.message : '审核列表加载失败，请重试'
      } finally {
        if (requestId === uploadsRequestId) isLoading.value = false
      }
    }

    // 监听筛选条件变化，重新加载数据
    watch([searchQuery, statusFilter, canteenFilter], () => {
      currentPage.value = 1
      saveState() // 保存状态
      loadReviewDishes()
    })

    // 组件挂载时加载数据
    onMounted(() => {
      loadCanteens()
      loadReviewDishes()
    })

    onActivated(() => {
      // 组件重新激活时仅重新加载数据，状态已在setup()中恢复
      loadCanteens()
      loadReviewDishes()
    })

    return {
      searchQuery,
      statusFilter,
      canteenFilter,
      currentPage,
      pageSize,
      isLoading,
      loadError,
      totalDishes,
      filteredReviewDishes,
      statusClasses,
      statusText,
      reviewDish,
      handlePageChange,
      loadReviewDishes,
      viewDishDetail,
      authStore,
      canteens,
    }
  },
})
</script>
