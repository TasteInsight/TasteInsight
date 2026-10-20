<template>
  <div class="admin-page">
    <div class="admin-panel">
      <Header
        title="评论和评价管理"
        description="管理菜品的评价和评论，支持删除操作"
        header-icon="carbon:chat"
      />

      <div class="admin-comment-layout">
        <!-- 左侧：菜品列表 -->
        <div class="admin-dish-picker">
          <!-- 搜索栏 -->
          <div class="mb-4">
            <div class="relative">
              <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
              <input
                type="text"
                placeholder="搜索菜品名称..."
                class="w-full pl-10 pr-10 admin-input"
                v-model="searchQuery"
                @input="handleSearchChange"
              />
              <button
                v-if="searchQuery"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-icon-button"
                @click="searchQuery = ''; handleSearchChange()"
                type="button"
                title="清除搜索"
              >
                <AppIcon class="iconify" icon="carbon:close"></AppIcon>
              </button>
            </div>
          </div>

          <!-- 筛选区域 -->
          <div
            v-if="canViewCanteens"
            class="admin-toolbar mb-3"
          >
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600 whitespace-nowrap">所属食堂</span>
              <div class="relative flex-1">
                <select
                  v-model="selectedCanteenId"
                  @change="handleCanteenChange"
                  class="w-full bg-white transition-all cursor-pointer hover:border-gray-400 admin-input"
                >
                  <option value="">全部食堂</option>
                  <option v-for="canteen in canteens" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600 whitespace-nowrap">所属窗口</span>
              <div class="relative flex-1">
                <select
                  v-model="selectedWindowId"
                  @change="handleWindowChange"
                  class="w-full bg-white transition-all cursor-pointer hover:border-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200 admin-input"
                  :disabled="!selectedCanteenId"
                >
                  <option value="">全部窗口</option>
                  <option v-for="window in windows" :key="window.id" :value="window.id">
                    {{ window.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                v-if="selectedCanteenId || selectedWindowId || searchQuery"
                @click="resetFilters"
                class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1 hover:bg-gray-200/50 transition-colors admin-button"
              >
                <AppIcon class="iconify text-sm" icon="carbon:reset"></AppIcon>
                重置筛选
              </button>
            </div>
          </div>

          <div class="admin-dish-list">
            <div v-if="isLoadingDishes" class="admin-state">
              <AppIcon class="iconify inline-block text-2xl animate-spin" icon="mdi:loading"></AppIcon>
              <span class="ml-2">加载中...</span>
            </div>
            <div v-else-if="filteredDishes.length === 0" class="admin-state">
              暂无菜品数据
            </div>
            <button
              v-else
              v-for="dish in filteredDishes"
              :key="dish.id"
              type="button"
              class="w-full p-3 mb-2 rounded-lg border text-left transition-colors duration-200"
              :aria-pressed="selectedDishId === dish.id"
              :class="selectedDishId === dish.id ? 'bg-tsinghua-purple text-white border-tsinghua-purple' : 'hover:bg-gray-50'"
              @click="selectDish(dish)"
            >
              <div class="flex items-center">
                <AdminImage
                  :src="dish.images?.[0]"
                  :alt="dish.name"
                  image-class="w-12 h-12 rounded object-cover border mr-3"
                />
                <div class="flex-1">
                  <div class="font-medium">{{ dish.name }}</div>
                  <div class="text-sm opacity-80">
                    {{ dish.canteenName || '' }}
                    <span v-if="dish.floorName || dish.floorLevel"> - {{ dish.floorName || dish.floorLevel || '' }}</span>
                    <span> - {{ dish.windowName || dish.windowNumber || '' }}</span>
                  </div>
                  <div class="text-sm opacity-80 mt-1 flex items-center gap-4">
                    <span>评价数: <span class="font-medium">{{ dish.reviewCount || 0 }}</span></span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <Pagination v-if="totalDishes > 0" class="mt-4" label="菜品分页"
            :current-page="dishPage" :page-size="dishPageSize" :total="totalDishes"
            :show-jump="false" :disabled="isLoadingDishes" @page-change="handleDishPageChange" />
        </div>

        <!-- 右侧：评价和评论列表（帖子式展示） -->
        <div class="flex-1">
          <div v-if="!selectedDishId" class="text-center py-16 text-gray-400">
            <AppIcon class="iconify inline-block text-6xl mb-4" icon="carbon:chat"></AppIcon>
            <p class="text-lg">请选择一个菜品查看评价和评论</p>
          </div>

          <div v-else>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold flex items-center">
                <AppIcon class="iconify inline-block mr-2" icon="carbon:star"></AppIcon>
                评价和评论
              </h3>
              <div class="text-sm text-gray-500">
                共 {{ totalReviews }} 条评价，{{ totalComments }} 条评论
              </div>
            </div>

            <div v-if="canDeleteReviews" class="mb-4">
              <label class="mb-2 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  aria-label="全选当前页评价"
                  class="h-4 w-4 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                  :checked="reviewSelection.allSelected"
                  :indeterminate="reviewSelection.someSelected"
                  :disabled="isLoadingReviews || isLoadingComments || isBatchDeleting || reviews.length === 0"
                  @change="reviewSelection.toggleAll"
                />
                全选当前页评价
              </label>
              <BatchActionBar
                :count="reviewSelection.selectedCount"
                resource="评价"
                :busy="isBatchDeleting"
                :disabled="isLoadingReviews || isLoadingComments"
                @clear="reviewSelection.clear"
                @delete="handleBatchDeleteReviews"
              />
            </div>
            <div v-if="canDeleteComments" class="mb-4">
              <label class="mb-2 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  aria-label="全选当前已加载评论"
                  class="h-4 w-4 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                  :checked="commentSelection.allSelected"
                  :indeterminate="commentSelection.someSelected"
                  :disabled="isLoadingReviews || isLoadingComments || isBatchDeleting || visibleCommentIds.length === 0"
                  @change="commentSelection.toggleAll"
                />
                全选当前已加载评论
              </label>
              <BatchActionBar
                :count="commentSelection.selectedCount"
                resource="评论"
                scope="仅当前页已加载评论，每次最多 100 条"
                :busy="isBatchDeleting"
                :disabled="isLoadingReviews || isLoadingComments"
                @clear="commentSelection.clear"
                @delete="handleBatchDeleteComments"
              />
            </div>

            <div v-if="isLoadingReviews || isLoadingComments" class="admin-state">
              <AppIcon class="iconify inline-block text-2xl animate-spin" icon="mdi:loading"></AppIcon>
              <span class="ml-2">加载中...</span>
            </div>
            <div v-else-if="reviews.length === 0" class="admin-state">
              暂无评价
            </div>
            <div v-else class="space-y-6">
              <!-- 每个评价作为一个帖子 -->
              <div
                v-for="review in reviews"
                :key="review.id"
                class="bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <!-- 评价内容（帖子主体） -->
                <div class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center flex-1">
                      <input
                        v-if="canDeleteReviews"
                        type="checkbox"
                        :aria-label="`选择评价 ${review.userNickname || '未知用户'}：${review.content}`"
                        class="mr-3 h-4 w-4 shrink-0 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                        :checked="reviewSelection.selectedIds.includes(review.id)"
                        :disabled="isBatchDeleting"
                        @change="reviewSelection.toggle(review.id)"
                      />
                      <AdminImage
                        :src="review.userAvatar"
                        variant="avatar"
                        :alt="review.userNickname || '用户'"
                        image-class="w-10 h-10 rounded-full mr-3 border-2 border-gray-200 object-cover"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-gray-900">{{ review.userNickname || '未知用户' }}</span>
                          <span class="flex items-center text-yellow-500 text-sm">
                            <AppIcon class="iconify inline-block" icon="bxs:star"></AppIcon>
                            <span class="ml-1 font-medium">{{ review.rating }}</span>
                          </span>
                          <span
                            class="px-2 py-0.5 rounded-full text-xs font-medium"
                            :class="statusClasses[review.status]"
                          >
                            {{ statusText[review.status] }}
                          </span>
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">
                          {{ formatDate(review.createdAt) }}
                        </div>
                      </div>
                    </div>
                    <button
                      class="bg-red-600 text-white hover:bg-red-700 transition duration-200 flex items-center gap-1 admin-button"
                      @click="handleDeleteReview(review)"
                      :disabled="isBatchDeleting || !authStore.hasPermission('review:delete')"
                      :title="!authStore.hasPermission('review:delete') ? '无权限删除评价' : '删除评价'"
                    >
                      <AppIcon class="iconify inline-block text-sm" icon="carbon:trash-can"></AppIcon>
                      删除
                    </button>
                  </div>

                  <!-- 评价文本内容 -->
                  <p class="text-gray-800 mb-3 leading-relaxed">{{ review.content }}</p>

                  <!-- 评价图片 -->
                  <div v-if="review.images && review.images.length > 0" class="grid gap-2 mb-4" :class="getImageGridClass(review.images.length)">
                    <AdminImage
                      v-for="(img, idx) in review.images"
                      :key="idx"
                      :src="img"
                      :alt="`评价图片${idx + 1}`"
                      variant="preview"
                      previewable
                      image-class="w-full aspect-square rounded-lg border border-gray-200 object-cover hover:opacity-90"
                      @preview="openImagePreview(review.images || [], idx)"
                    />
                  </div>
                </div>

                <!-- 评论区域 -->
                <div v-if="getCommentsByReviewId(review.id).length > 0" class="border-t bg-gray-50">
                  <div class="px-5 py-3 border-b bg-gray-100">
                    <span class="text-sm font-medium text-gray-700">
                      <AppIcon class="iconify inline-block mr-1" icon="carbon:chat"></AppIcon>
                      已加载 {{ getCommentsByReviewId(review.id).length }} / {{ commentPagination[review.id]?.total || 0 }} 条评论
                    </span>
                  </div>
                  <div class="p-4 space-y-3">
                    <div
                      v-for="comment in getCommentsByReviewId(review.id)"
                      :key="comment.id"
                      class="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center mb-2">
                            <input
                              v-if="canDeleteComments"
                              type="checkbox"
                              :aria-label="`选择评论 ${comment.userNickname || '未知用户'}：${comment.content}`"
                              class="mr-3 h-4 w-4 shrink-0 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                              :checked="commentSelection.selectedIds.includes(comment.id)"
                              :disabled="isBatchDeleting"
                              @change="commentSelection.toggle(comment.id)"
                            />
                            <AdminImage
                              :src="comment.userAvatar"
                              variant="avatar"
                              :alt="comment.userNickname || '用户'"
                              image-class="w-7 h-7 rounded-full mr-2 border border-gray-200 object-cover"
                            />
                            <span class="font-medium text-sm text-gray-900">{{ comment.userNickname || '未知用户' }}</span>
                            <span class="ml-2 text-xs text-gray-500">#{{ comment.floor }}楼</span>
                            <span
                              class="ml-2 px-1.5 py-0.5 rounded text-xs font-medium"
                              :class="statusClasses[comment.status]"
                            >
                              {{ statusText[comment.status] }}
                            </span>
                          </div>
                          <p class="text-sm text-gray-700 mb-1.5 ml-9">{{ comment.content }}</p>
                          <!-- 回复关系 -->
                          <div v-if="comment.parentComment" class="ml-9 mb-1.5 pl-3 border-l-2 border-gray-300 bg-gray-50 rounded py-1">
                            <div class="text-xs text-gray-600">
                              回复
                              <span class="font-medium">{{ comment.parentComment.userNickname }}</span>
                              <span v-if="comment.parentComment.deleted" class="text-red-500 ml-1">（已删除）</span>
                            </div>
                          </div>
                          <div class="text-xs text-gray-500 ml-9">
                            {{ formatDate(comment.createdAt) }}
                          </div>
                        </div>
                        <button
                          class="ml-3 bg-red-600 text-white hover:bg-red-700 transition duration-200 flex items-center gap-1 admin-icon-button"
                          @click="handleDeleteComment(comment)"
                          :disabled="isBatchDeleting || !authStore.hasPermission('comment:delete')"
                          :title="!authStore.hasPermission('comment:delete') ? '无权限删除评论' : '删除评论'"
                        >
                          <AppIcon class="iconify inline-block text-xs" icon="carbon:trash-can"></AppIcon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else-if="!commentPagination[review.id]?.error" class="border-t px-5 py-4 bg-gray-50">
                  <p class="text-sm text-gray-400 text-center">暂无评论</p>
                </div>
                <div v-if="commentPagination[review.id] && (commentPagination[review.id].error || commentPagination[review.id].page < commentPagination[review.id].totalPages)" class="border-t px-5 py-3 text-center">
                  <p v-if="commentPagination[review.id].error" class="mb-2 text-sm text-red-600">评论加载失败，请重试</p>
                  <button type="button" :disabled="isBatchDeleting || commentPagination[review.id].loading" @click="loadMoreComments(review.id)" class="text-tsinghua-purple hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-tsinghua-purple disabled:opacity-50 admin-button">
                    {{ commentPagination[review.id].loading ? '加载中...' : commentPagination[review.id].error ? '重试加载评论' : '加载更多评论' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 分页 -->
            <Pagination
              v-if="totalReviews > 0"
              :current-page="reviewPage"
              :page-size="reviewPageSize"
              :total="totalReviews"
              @page-change="handleReviewPageChange"
            />
          </div>
        </div>
      </div>
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
          :alt="`评价图片 ${imagePreview.currentIndex + 1}`"
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
import { ref, reactive, computed, watch, onMounted, onActivated, onDeactivated, onUnmounted, defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import { dishApi } from '@/api/modules/dish'
import { reviewApi } from '@/api/modules/review'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import AdminImage from '@/components/Common/AdminImage.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import Pagination from '@/components/Common/Pagination.vue'
import BatchActionBar from '@/components/Common/BatchActionBar.vue'
import { useBatchSelection } from '@/composables/useBatchSelection'
import { savePageState, restorePageState } from '@/utils/page-state-cache'
import { authSessionVersion, getAuthSessionVersion } from '@/utils/auth-session'
import type { Dish, Review, Comment } from '@/types/api'
import { showConfirmDanger } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'

const PAGE_STATE_KEY = 'comment-manage'

export default defineComponent({
  name: 'CommentManage',
  components: {
    AdminImage,
    Header,
    AdminDialog,
    Pagination,
    BatchActionBar,
  },
  setup() {
    const notify = useNotification()
    const route = useRoute()
    const authStore = useAuthStore()
    const sessionVersion = getAuthSessionVersion()
    let mounted = true
    let viewActive = true
    let viewVersion = 0
    const ownsView = (version = viewVersion) => mounted && viewActive &&
      sessionVersion === getAuthSessionVersion() && version === viewVersion
    let reviewRequest = 0
    let commentsEpoch = 0
    const canViewCanteens = authStore.hasPermission('canteen:view')

    // 默认状态定义
    const defaultState = {
      searchQuery: '',
      selectedCanteenId: '',
      selectedWindowId: '',
      dishPage: 1,
      reviewPage: 1,
      selectedDishId: null,
    }
    
    // 从缓存恢复状态
    const restoredState = restorePageState(PAGE_STATE_KEY, defaultState)

    // 菜品列表相关
    const dishes = ref<Dish[]>([])
    const searchQuery = ref(restoredState.searchQuery)
    const dishPage = ref(restoredState.dishPage)
    const dishPageSize = ref(10)
    const totalDishes = ref(0)
    const isLoadingDishes = ref(false)
    const selectedDishId = ref<string | null>(restoredState.selectedDishId)

    // 筛选相关
    const selectedCanteenId = ref(canViewCanteens ? restoredState.selectedCanteenId : '')
    const selectedWindowId = ref(canViewCanteens ? restoredState.selectedWindowId : '')
    const canteens = ref<any[]>([])
    const windows = ref<any[]>([])

    // 评价列表相关
    const reviews = ref<Review[]>([])
    const reviewPage = ref(restoredState.reviewPage)
    const reviewPageSize = ref(10)
    const totalReviews = ref(0)
    const isLoadingReviews = ref(false)
    
    // 保存页面状态
    const saveState = () => {
      savePageState(PAGE_STATE_KEY, {
        searchQuery: searchQuery.value,
        selectedCanteenId: selectedCanteenId.value,
        selectedWindowId: selectedWindowId.value,
        dishPage: dishPage.value,
        reviewPage: reviewPage.value,
        selectedDishId: selectedDishId.value,
      })
    }

    // 评论列表相关
    const commentsMap = ref<Record<string, Comment[]>>({})
    const commentPageSize = 30
    const commentPagination = ref<Record<string, { page: number; total: number; totalPages: number; loading: boolean; error: boolean }>>({})
    const totalComments = ref(0)
    const isLoadingComments = ref(false)

    const canDeleteReviews = computed(() => authStore.hasPermission('review:delete'))
    const canDeleteComments = computed(() => authStore.hasPermission('comment:delete'))
    const isBatchDeleting = ref(false)
    const selectionContext = () => [searchQuery.value, selectedCanteenId.value,
      selectedWindowId.value, dishPage.value, selectedDishId.value, reviewPage.value,
      reviewPageSize.value, route.fullPath, authSessionVersion.value]
    const reviewSelection = useBatchSelection({
      ids: () => reviews.value.map(review => review.id),
      context: selectionContext,
      enabled: () => canDeleteReviews.value,
    })
    const visibleCommentIds = computed(() => reviews.value.flatMap(review =>
      (commentsMap.value[review.id] || []).map(comment => comment.id)))
    const commentSelection = useBatchSelection({
      ids: () => visibleCommentIds.value,
      context: selectionContext,
      enabled: () => canDeleteComments.value,
    })

    // 图片预览相关
    const imagePreview = ref<{
      show: boolean
      images: string[]
      currentIndex: number
    }>({
      show: false,
      images: [],
      currentIndex: 0,
    })

    const statusClasses: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }

    const statusText: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
    }

    const filteredDishes = computed(() => {
      if (!searchQuery.value) {
        return dishes.value
      }
      const query = searchQuery.value.toLowerCase()
      return dishes.value.filter(
        (dish) =>
          dish.name.toLowerCase().includes(query) ||
          dish.canteenName?.toLowerCase().includes(query) ||
          dish.windowName?.toLowerCase().includes(query),
      )
    })

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

    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteens({ page: 1, pageSize: 100 })
        if (response.code === 200 && response.data) {
          canteens.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }

    // 处理食堂变化
    const handleCanteenChange = async () => {
      selectedWindowId.value = '' // 重置窗口选择
      windows.value = [] // 清空窗口列表
      
      // 重新加载菜品
      dishPage.value = 1
      saveState() // 保存状态
      loadDishes()

      if (selectedCanteenId.value) {
        try {
          const response = await canteenApi.getWindows(selectedCanteenId.value, { page: 1, pageSize: 100 })
          if (response.code === 200 && response.data) {
            windows.value = response.data.items || []
          }
        } catch (error) {
          console.error('加载窗口列表失败:', error)
        }
      }
    }

    // 处理窗口变化
    const handleWindowChange = () => {
      dishPage.value = 1
      saveState() // 保存状态
      loadDishes()
    }

    // 加载菜品列表
    const loadDishes = async () => {
      isLoadingDishes.value = true
      try {
        const params: any = {
          page: dishPage.value,
          pageSize: dishPageSize.value,
          keyword: searchQuery.value || undefined,
        }

        // 添加筛选参数
        if (selectedCanteenId.value) {
          params.canteenId = selectedCanteenId.value
        }
        if (selectedWindowId.value) {
          params.windowId = selectedWindowId.value
        }

        const response = await dishApi.getDishes(params)

        if (response.code === 200 && response.data) {
          dishes.value = response.data.items || []
          totalDishes.value = response.data.meta?.total || 0
        } else {
          dishes.value = []
          totalDishes.value = 0
        }
      } catch (error) {
        console.error('加载菜品列表失败:', error)
        notify.error('加载菜品列表失败，请刷新重试')
        dishes.value = []
        totalDishes.value = 0
      } finally {
        isLoadingDishes.value = false
      }
    }

    // 选择菜品
    const selectDish = (dish: Dish) => {
      selectedDishId.value = dish.id
      reviewPage.value = 1
      saveState() // 保存状态
      return loadReviews().then(loaded => {
        if (loaded) return loadCommentsForReviews()
      })
    }

    // 加载评价列表
    const loadReviews = async (clampPage = false): Promise<boolean> => {
      if (!selectedDishId.value || !ownsView()) return false
      const request = ++reviewRequest
      const dishId = selectedDishId.value
      const page = reviewPage.value
      const version = viewVersion
      const ownsRequest = () => ownsView(version) && request === reviewRequest && dishId === selectedDishId.value && page === reviewPage.value
      ++commentsEpoch
      reviews.value = []
      commentsMap.value = {}
      commentPagination.value = {}
      totalComments.value = 0
      isLoadingComments.value = false

      isLoadingReviews.value = true
      try {
        const response = await dishApi.getDishReviews(dishId, {
          page,
          pageSize: reviewPageSize.value,
        })

        if (!ownsRequest()) return false
        if (response.code === 200 && response.data) {
          const lastPage = Math.max(1, Math.ceil((response.data.meta?.total || 0) / reviewPageSize.value))
          if (clampPage && reviewPage.value > lastPage) {
            reviewPage.value = lastPage
            saveState()
            return loadReviews(true)
          }
          reviews.value = response.data.items
          totalReviews.value = response.data.meta?.total || 0
          return true
        } else {
          reviews.value = []
          totalReviews.value = 0
        }
      } catch (error) {
        if (!ownsRequest()) return false
        console.error('加载评价列表失败:', error)
        notify.error('加载评价列表失败，请重试')
        reviews.value = []
        totalReviews.value = 0
      } finally {
        if (ownsRequest()) isLoadingReviews.value = false
      }
      return false
    }

    // 加载评论列表（为所有评价加载评论）
    const loadCommentsForReviews = async () => {
      if (!selectedDishId.value || !ownsView()) return
      const epoch = ++commentsEpoch
      commentsMap.value = {}
      commentPagination.value = {}
      totalComments.value = 0
      if (reviews.value.length === 0) return
      isLoadingComments.value = true
      await Promise.all(reviews.value.map(review => loadCommentPage(review.id, 1, epoch)))
      if (ownsView() && epoch === commentsEpoch) isLoadingComments.value = false
    }

    const loadCommentPage = async (reviewId: string, page: number, epoch: number) => {
      const state = commentPagination.value[reviewId] ||= { page: 0, total: 0, totalPages: 0, loading: false, error: false }
      const ownsRequest = () => ownsView() && epoch === commentsEpoch
      if (!ownsRequest() || state.loading) return
      state.loading = true
      state.error = false
      try {
        const response = await reviewApi.getReviewComments(reviewId, { page, pageSize: commentPageSize })
        if (!ownsRequest()) return
        if (response.code !== 200 || !response.data) throw new Error(response.message || '加载评论失败')
        const existing = page === 1 ? [] : commentsMap.value[reviewId] || []
        const ids = new Set(existing.map(comment => comment.id))
        commentsMap.value[reviewId] = [...existing, ...response.data.items.filter(comment => !ids.has(comment.id))]
        state.page = response.data.meta.page
        state.total = response.data.meta.total
        state.totalPages = response.data.meta.totalPages
        totalComments.value = Object.values(commentPagination.value).reduce((sum, item) => sum + item.total, 0)
      } catch (error) {
        if (!ownsRequest()) return
        state.error = true
        console.error('加载评论列表失败:', error)
        notify.error('加载评论列表失败，请重试')
      } finally {
        if (ownsRequest()) state.loading = false
      }
    }

    const loadMoreComments = (reviewId: string) => {
      if (isBatchDeleting.value) return
      const state = commentPagination.value[reviewId]
      if (!state || state.loading || (!state.error && state.page >= state.totalPages)) return
      return loadCommentPage(reviewId, state.page + 1, commentsEpoch)
    }

    // 根据评价ID获取该评价下的所有评论
    const getCommentsByReviewId = (reviewId: string): Comment[] => {
      return commentsMap.value[reviewId] || []
    }

    // 根据图片数量返回网格布局类
    const getImageGridClass = (imageCount: number): string => {
      if (imageCount === 1) return 'grid-cols-1 max-w-md'
      if (imageCount === 2) return 'grid-cols-2'
      if (imageCount === 3) return 'grid-cols-3'
      if (imageCount === 4) return 'grid-cols-2'
      return 'grid-cols-3'
    }

    // 图片预览相关
    const openImagePreview = (images: string[], index: number = 0) => {
      imagePreview.value = {
        show: true,
        images,
        currentIndex: index,
      }
    }

    const closeImagePreview = () => {
      imagePreview.value = {
        show: false,
        images: [],
        currentIndex: 0,
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

    // 删除评价
    const handleDeleteReview = async (review: Review) => {
      if (isBatchDeleting.value) return
      if (!authStore.hasPermission('review:delete')) {
        notify.error('您没有权限删除评价')
        return
      }

      const confirmed = await showConfirmDanger(
        '确定要删除这个评价吗？此操作不可恢复。',
        '确认删除'
      )
      if (!confirmed) {
        return
      }

      try {
        const response = await reviewApi.deleteReview(review.id)
        if (response.code === 200) {
          notify.success('删除成功')
          loadReviews().then(loaded => {
            if (loaded) loadCommentsForReviews()
          })
        } else {
          notify.error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评价失败:', error)
        notify.error('删除评价失败，请重试')
      }
    }

    // 删除评论
    const handleDeleteComment = async (comment: Comment) => {
      if (isBatchDeleting.value) return
      if (!authStore.hasPermission('comment:delete')) {
        notify.error('您没有权限删除评论')
        return
      }

      const confirmed = await showConfirmDanger(
        '确定要删除这个评论吗？此操作不可恢复。',
        '确认删除'
      )
      if (!confirmed) {
        return
      }

      try {
        const response = await reviewApi.deleteComment(comment.id)
        if (response.code === 200) {
          notify.success('删除成功')
          loadCommentsForReviews() // 重新加载评论列表
        } else {
          notify.error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评论失败:', error)
        notify.error('删除评论失败，请重试')
      }
    }

    const handleBatchDeleteReviews = async () => {
      if (isBatchDeleting.value || isLoadingReviews.value || isLoadingComments.value || !ownsView() ||
          !authStore.hasPermission('review:delete')) return
      const ids = [...reviewSelection.selectedIds.value]
      if (ids.length === 0 || ids.length > 100) return
      const context = reviewSelection.contextVersion.value
      const version = viewVersion
      const ownsOperation = () => ownsView(version) && context === reviewSelection.contextVersion.value &&
        authStore.hasPermission('review:delete')
      isBatchDeleting.value = true
      try {
        const confirmed = await showConfirmDanger(
          `确定删除选中的 ${ids.length} 条评价吗？此操作不可恢复。任一项无法删除时整批不会删除。`,
          '批量删除评价', '删除所选评价',
        )
        if (!confirmed || !ownsOperation() ||
            !ids.every(id => reviewSelection.selectedIds.value.includes(id))) return
        const response = await reviewApi.batchDeleteReviews(ids)
        if (!ownsOperation()) return
        if (response.code !== 200) throw new Error(response.message || '批量删除失败')
        reviewSelection.clear()
        commentSelection.clear()
        notify.success(`已删除 ${response.data.deletedCount} 条评价`)
        const loaded = await loadReviews(true)
        if (loaded) await loadCommentsForReviews()
      } catch (error) {
        if (ownsOperation()) notify.error(error instanceof Error ? error.message : '批量删除失败，请重试')
      } finally {
        isBatchDeleting.value = false
      }
    }

    const handleBatchDeleteComments = async () => {
      if (isBatchDeleting.value || isLoadingReviews.value || isLoadingComments.value || !ownsView() ||
          !authStore.hasPermission('comment:delete')) return
      const ids = [...commentSelection.selectedIds.value]
      if (ids.length === 0 || ids.length > 100) return
      const context = commentSelection.contextVersion.value
      const version = viewVersion
      const ownsOperation = () => ownsView(version) && context === commentSelection.contextVersion.value &&
        authStore.hasPermission('comment:delete')
      isBatchDeleting.value = true
      try {
        const confirmed = await showConfirmDanger(
          `确定删除选中的 ${ids.length} 条评论吗？此操作不可恢复。未选中的回复会保留。任一项无法删除时整批不会删除。`,
          '批量删除评论', '删除所选评论',
        )
        if (!confirmed || !ownsOperation() ||
            !ids.every(id => commentSelection.selectedIds.value.includes(id))) return
        const response = await reviewApi.batchDeleteComments(ids)
        if (!ownsOperation()) return
        if (response.code !== 200) throw new Error(response.message || '批量删除失败')
        commentSelection.clear()
        notify.success(`已删除 ${response.data.deletedCount} 条评论`)
        await loadCommentsForReviews()
      } catch (error) {
        if (ownsOperation()) notify.error(error instanceof Error ? error.message : '批量删除失败，请重试')
      } finally {
        isBatchDeleting.value = false
      }
    }

    // 分页处理
    const handleDishPageChange = (page: number) => {
      dishPage.value = page
      saveState() // 保存状态
      loadDishes()
    }

    const handleReviewPageChange = (page: number) => {
      reviewPage.value = page
      saveState() // 保存状态
      loadReviews().then(loaded => {
        if (loaded) loadCommentsForReviews()
      })
    }

    // 搜索防抖
    let searchTimeout: ReturnType<typeof setTimeout> | null = null
    const handleSearchChange = () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
      searchTimeout = setTimeout(() => {
        dishPage.value = 1
        saveState() // 保存状态
        loadDishes()
      }, 500)
    }

    // 重置筛选
    const resetFilters = () => {
      searchQuery.value = ''
      selectedCanteenId.value = ''
      selectedWindowId.value = ''
      windows.value = []
      dishPage.value = 1
      saveState() // 保存状态
      loadDishes()
    }

    onMounted(() => {
      // 恢复状态后，如果有选中的食堂，需要加载窗口列表
      if (selectedCanteenId.value) {
        canteenApi.getWindows(selectedCanteenId.value, { page: 1, pageSize: 100 })
          .then(res => {
            if (res.code === 200 && res.data) {
              windows.value = res.data.items || []
            }
          })
          .catch(err => {
            console.error('加载窗口列表失败:', err)
          })
      }
      
      if (canViewCanteens) {
        loadCanteens()
      }
      loadDishes()
      
      // 如果有选中的菜品，加载评价和评论
      if (selectedDishId.value) {
        loadReviews().then(loaded => {
          if (loaded) loadCommentsForReviews()
        })
      }
    })

    onActivated(() => {
      viewActive = true
      // 组件激活时仅重新加载数据，状态已在setup()中恢复
      // 如果有选中的食堂且窗口列表为空，则尝试重新加载窗口列表
      if (selectedCanteenId.value && windows.value.length === 0) {
        canteenApi.getWindows(selectedCanteenId.value, { page: 1, pageSize: 100 })
          .then(res => {
            if (res.code === 200 && res.data) {
              windows.value = res.data.items || []
            }
          })
          .catch(err => {
            console.error('恢复窗口列表失败:', err)
          })
      }
      
      if (canViewCanteens) {
        loadCanteens()
      }
      loadDishes()
      if (selectedDishId.value) {
        loadReviews().then(loaded => {
          if (loaded) loadCommentsForReviews()
        })
      }
    })

    onUnmounted(() => {
      mounted = false
      retireView()
    })

    const retireView = () => {
      viewActive = false
      viewVersion += 1
      reviewRequest += 1
      commentsEpoch += 1
      reviewSelection.clear()
      commentSelection.clear()
      isLoadingReviews.value = false
      isLoadingComments.value = false
      if (searchTimeout) clearTimeout(searchTimeout)
    }
    onDeactivated(retireView)
    watch(authSessionVersion, () => {
      retireView()
      reviews.value = []
      commentsMap.value = {}
      commentPagination.value = {}
      totalReviews.value = 0
      totalComments.value = 0
    }, { flush: 'sync' })

    return {
      // 菜品列表
      canViewCanteens,
      dishes,
      searchQuery,
      dishPage,
      dishPageSize,
      totalDishes,
      isLoadingDishes,
      selectedDishId,
      filteredDishes,

      // 评价列表
      reviews,
      reviewPage,
      reviewPageSize,
      totalReviews,
      isLoadingReviews,

      // 评论列表
      commentsMap,
      commentPageSize,
      commentPagination,
      loadMoreComments,
      totalComments,
      isLoadingComments,

      // 方法
      statusClasses,
      statusText,
      formatDate,
      selectDish,
      handleDeleteReview,
      handleDeleteComment,
      handleDishPageChange,
      handleReviewPageChange,
      handleSearchChange,
      getCommentsByReviewId,
      getImageGridClass,
      imagePreview,
      openImagePreview,
      closeImagePreview,
      handleImageKeyDown,
      previousImage,
      nextImage,
      // 筛选相关
      selectedCanteenId,
      selectedWindowId,
      canteens,
      windows,
      handleCanteenChange,
      handleWindowChange,
      resetFilters,
      authStore,
      canDeleteReviews,
      canDeleteComments,
      reviewSelection: reactive(reviewSelection),
      commentSelection: reactive(commentSelection),
      visibleCommentIds,
      isBatchDeleting,
      handleBatchDeleteReviews,
      handleBatchDeleteComments,
    }
  },
})
</script>
