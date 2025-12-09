<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="评论和评价管理"
        description="管理菜品的评价和评论，支持删除操作"
        header-icon="carbon:chat"
      />

      <div class="flex gap-6 mt-6">
        <!-- 左侧：菜品列表 -->
        <div class="w-1/3 border-r pr-6">
          <div class="mb-4">
            <input
              type="text"
              placeholder="搜索菜品名称..."
              class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
              v-model="searchQuery"
              @input="handleSearchChange"
            />
          </div>

          <div class="overflow-auto" style="max-height: calc(100vh - 300px)">
            <div v-if="isLoadingDishes" class="text-center py-8 text-gray-500">
              <span class="iconify inline-block text-2xl animate-spin" data-icon="mdi:loading"></span>
              <span class="ml-2">加载中...</span>
            </div>
            <div v-else-if="filteredDishes.length === 0" class="text-center py-8 text-gray-500">
              暂无菜品数据
            </div>
            <div
              v-else
              v-for="dish in filteredDishes"
              :key="dish.id"
              class="p-4 mb-2 border rounded-lg cursor-pointer transition duration-200"
              :class="selectedDishId === dish.id ? 'bg-tsinghua-purple text-white border-tsinghua-purple' : 'hover:bg-gray-50'"
              @click="selectDish(dish)"
            >
              <div class="flex items-center">
                <img
                  :src="(dish.images && dish.images.length > 0 ? dish.images[0] : '') || '/default-dish.png'"
                  :alt="dish.name"
                  class="w-12 h-12 rounded object-cover border mr-3"
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
            </div>
          </div>

          <!-- 紧凑型分页 -->
          <div v-if="totalDishes > 0" class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex items-center justify-between gap-2">
              <div class="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                共 {{ totalDishes }} 条
              </div>
              <div class="flex items-center gap-1 flex-1 justify-end min-w-0">
                <button
                  class="px-2 py-1 text-xs border rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  :disabled="dishPage === 1"
                  @click="handleDishPageChange(dishPage - 1)"
                >
                  上一页
                </button>
                <div class="flex items-center gap-1">
                  <button
                    v-for="page in getDishPaginationPages()"
                    :key="page"
                    class="px-2 py-1 text-xs border rounded min-w-[28px] text-center flex-shrink-0"
                    :class="
                      page === dishPage
                        ? 'bg-tsinghua-purple text-white border-tsinghua-purple'
                        : 'text-gray-500 hover:bg-gray-100'
                    "
                    @click="handleDishPageChange(page)"
                  >
                    {{ page }}
                  </button>
                </div>
                <button
                  class="px-2 py-1 text-xs border rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  :disabled="dishPage === getDishTotalPages()"
                  @click="handleDishPageChange(dishPage + 1)"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：评价和评论列表（帖子式展示） -->
        <div class="flex-1">
          <div v-if="!selectedDishId" class="text-center py-16 text-gray-400">
            <span class="iconify inline-block text-6xl mb-4" data-icon="carbon:chat"></span>
            <p class="text-lg">请选择一个菜品查看评价和评论</p>
          </div>

          <div v-else>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold flex items-center">
                <span class="iconify inline-block mr-2" data-icon="carbon:star"></span>
                评价和评论
              </h3>
              <div class="text-sm text-gray-500">
                共 {{ totalReviews }} 条评价，{{ totalComments }} 条评论
              </div>
            </div>

            <div v-if="isLoadingReviews || isLoadingComments" class="text-center py-8 text-gray-500">
              <span class="iconify inline-block text-2xl animate-spin" data-icon="mdi:loading"></span>
              <span class="ml-2">加载中...</span>
            </div>
            <div v-else-if="reviews.length === 0" class="text-center py-8 text-gray-500">
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
                      <img
                        :src="review.userAvatar || '/default-avatar.png'"
                        :alt="review.userNickname"
                        class="w-10 h-10 rounded-full mr-3 border-2 border-gray-200"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-gray-900">{{ review.userNickname }}</span>
                          <span class="flex items-center text-yellow-500 text-sm">
                            <span class="iconify inline-block" data-icon="bxs:star"></span>
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
                      class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition duration-200 flex items-center gap-1"
                      @click="handleDeleteReview(review)"
                      :disabled="!authStore.hasPermission('review:delete')"
                      :title="!authStore.hasPermission('review:delete') ? '无权限删除评价' : '删除评价'"
                    >
                      <span class="iconify inline-block text-sm" data-icon="carbon:trash-can"></span>
                      删除
                    </button>
                  </div>

                  <!-- 评价文本内容 -->
                  <p class="text-gray-800 mb-3 leading-relaxed">{{ review.content }}</p>

                  <!-- 评价图片 -->
                  <div v-if="review.images && review.images.length > 0" class="grid gap-2 mb-4" :class="getImageGridClass(review.images.length)">
                    <img
                      v-for="(img, idx) in review.images"
                      :key="idx"
                      :src="img"
                      :alt="`评价图片${idx + 1}`"
                      class="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      @click="previewImage(img, review.images || [])"
                    />
                  </div>
                </div>

                <!-- 评论区域 -->
                <div v-if="getCommentsByReviewId(review.id).length > 0" class="border-t bg-gray-50">
                  <div class="px-5 py-3 border-b bg-gray-100">
                    <span class="text-sm font-medium text-gray-700">
                      <span class="iconify inline-block mr-1" data-icon="carbon:chat"></span>
                      {{ getCommentsByReviewId(review.id).length }} 条评论
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
                            <img
                              :src="comment.userAvatar || '/default-avatar.png'"
                              :alt="comment.userNickname"
                              class="w-7 h-7 rounded-full mr-2 border border-gray-200"
                            />
                            <span class="font-medium text-sm text-gray-900">{{ comment.userNickname }}</span>
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
                          class="ml-3 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition duration-200 flex items-center gap-1"
                          @click="handleDeleteComment(comment)"
                          :disabled="!authStore.hasPermission('review:delete')"
                          :title="!authStore.hasPermission('review:delete') ? '无权限删除评论' : '删除评论'"
                        >
                          <span class="iconify inline-block text-xs" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="border-t px-5 py-4 bg-gray-50">
                  <p class="text-sm text-gray-400 text-center">暂无评论</p>
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
  </div>
</template>

<script lang="ts">
import { ref, computed, onMounted, defineComponent } from 'vue'
import { dishApi } from '@/api/modules/dish'
import { reviewApi } from '@/api/modules/review'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import Pagination from '@/components/Common/Pagination.vue'
import type { Dish, Review, Comment } from '@/types/api'

export default defineComponent({
  name: 'CommentManage',
  components: {
    Header,
    Pagination,
  },
  setup() {
    const authStore = useAuthStore()

    // 菜品列表相关
    const dishes = ref<Dish[]>([])
    const searchQuery = ref('')
    const dishPage = ref(1)
    const dishPageSize = ref(10)
    const totalDishes = ref(0)
    const isLoadingDishes = ref(false)
    const selectedDishId = ref<string | null>(null)

    // 评价列表相关
    const reviews = ref<Review[]>([])
    const reviewPage = ref(1)
    const reviewPageSize = ref(10)
    const totalReviews = ref(0)
    const isLoadingReviews = ref(false)

    // 评论列表相关
    const commentsMap = ref<Record<string, Comment[]>>({})
    const commentPage = ref(1)
    const commentPageSize = ref(10)
    const totalComments = ref(0)
    const isLoadingComments = ref(false)

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

    // 加载菜品列表
    const loadDishes = async () => {
      isLoadingDishes.value = true
      try {
        const response = await dishApi.getDishes({
          page: dishPage.value,
          pageSize: dishPageSize.value,
          keyword: searchQuery.value || undefined,
        })

        if (response.code === 200 && response.data) {
          dishes.value = response.data.items || []
          totalDishes.value = response.data.meta?.total || 0
        } else {
          dishes.value = []
          totalDishes.value = 0
        }
      } catch (error) {
        console.error('加载菜品列表失败:', error)
        alert('加载菜品列表失败，请刷新重试')
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
      commentPage.value = 1
      loadReviews().then(() => {
        loadCommentsForReviews()
      })
    }

    // 加载评价列表
    const loadReviews = async () => {
      if (!selectedDishId.value) return

      isLoadingReviews.value = true
      try {
        const response = await dishApi.getDishReviews(selectedDishId.value, {
          page: reviewPage.value,
          pageSize: reviewPageSize.value,
        })

        if (response.code === 200 && response.data) {
          reviews.value = response.data.items || []
          totalReviews.value = response.data.meta?.total || 0
        } else {
          reviews.value = []
          totalReviews.value = 0
        }
      } catch (error) {
        console.error('加载评价列表失败:', error)
        alert('加载评价列表失败，请重试')
        reviews.value = []
        totalReviews.value = 0
      } finally {
        isLoadingReviews.value = false
      }
    }

    // 加载评论列表（为所有评价加载评论）
    const loadCommentsForReviews = async () => {
      if (!selectedDishId.value || reviews.value.length === 0) return

      isLoadingComments.value = true
      try {
        // 为每个评价加载评论
        const commentPromises = reviews.value.map(review =>
          reviewApi.getReviewComments(review.id, {
            page: 1,
            pageSize: 30, // 加载足够多的评论以便显示
          })
        )

        const responses = await Promise.all(commentPromises)

        // 清空之前的评论
        commentsMap.value = {}

        let totalCommentCount = 0
        responses.forEach((response, index) => {
          if (response.code === 200 && response.data) {
            const reviewId = reviews.value[index].id
            commentsMap.value[reviewId] = response.data.items || []
            totalCommentCount += response.data.meta?.total || 0
          }
        })

        totalComments.value = totalCommentCount
      } catch (error) {
        console.error('加载评论列表失败:', error)
        alert('加载评论列表失败，请重试')
        commentsMap.value = {}
        totalComments.value = 0
      } finally {
        isLoadingComments.value = false
      }
    }

    // 根据评价ID获取该评价下的所有评论
    const getCommentsByReviewId = (reviewId: string): Comment[] => {
      return commentsMap.value[reviewId] || []
    }

    // 获取菜品的评论数（从已加载的评论中计算）
    const getDishCommentCount = (dishId: string): number => {
      // 如果当前选中的菜品是目标菜品，返回已加载的评论数
      if (selectedDishId.value === dishId) {
        return Object.values(commentsMap.value).reduce((total, comments) => total + comments.length, 0)
      }
      // 否则返回0，因为还没有加载该菜品的评论
      return 0
    }

    // 根据图片数量返回网格布局类
    const getImageGridClass = (imageCount: number): string => {
      if (imageCount === 1) return 'grid-cols-1'
      if (imageCount === 2) return 'grid-cols-2'
      if (imageCount === 3) return 'grid-cols-3'
      if (imageCount === 4) return 'grid-cols-2'
      return 'grid-cols-3'
    }

    // 图片预览（简单实现，可以后续优化为图片查看器）
    const previewImage = (currentImg: string, _allImages?: string[]) => {
      // 可以在这里实现图片预览功能，比如使用模态框
      // 暂时使用浏览器默认行为
      window.open(currentImg, '_blank')
    }

    // 删除评价
    const handleDeleteReview = async (review: Review) => {
      if (!authStore.hasPermission('review:delete')) {
        alert('您没有权限删除评价')
        return
      }

      if (!confirm('确定要删除这个评价吗？此操作不可恢复。')) {
        return
      }

      try {
        const response = await reviewApi.deleteReview(review.id)
        if (response.code === 200) {
          alert('删除成功')
          loadReviews()
        } else {
          alert(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评价失败:', error)
        alert('删除评价失败，请重试')
      }
    }

    // 删除评论
    const handleDeleteComment = async (comment: Comment) => {
      if (!authStore.hasPermission('review:delete')) {
        alert('您没有权限删除评论')
        return
      }

      if (!confirm('确定要删除这个评论吗？此操作不可恢复。')) {
        return
      }

      try {
        const response = await reviewApi.deleteComment(comment.id)
        if (response.code === 200) {
          alert('删除成功')
          loadComments() // 重新加载评论列表
        } else {
          alert(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除评论失败:', error)
        alert('删除评论失败，请重试')
      }
    }

    // 分页处理
    const handleDishPageChange = (page: number) => {
      dishPage.value = page
      loadDishes()
    }

    const handleReviewPageChange = (page: number) => {
      reviewPage.value = page
      loadReviews().then(() => {
        loadCommentsForReviews()
      })
    }

    // 获取菜品分页总页数
    const getDishTotalPages = (): number => {
      return Math.ceil(totalDishes.value / dishPageSize.value)
    }

    // 获取菜品分页页码数组
    const getDishPaginationPages = (): number[] => {
      const pages: number[] = []
      const totalPages = getDishTotalPages()
      const start = Math.max(1, dishPage.value - 2)
      const end = Math.min(totalPages, start + 4)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      return pages
    }

    // 搜索防抖
    let searchTimeout: ReturnType<typeof setTimeout> | null = null
    const handleSearchChange = () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
      searchTimeout = setTimeout(() => {
        dishPage.value = 1
        loadDishes()
      }, 500)
    }

    onMounted(() => {
      loadDishes()
    })

    return {
      // 菜品列表
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
      commentPage,
      commentPageSize,
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
      previewImage,
      getDishTotalPages,
      getDishPaginationPages,
      getDishCommentCount,
      authStore,
    }
  },
})
</script>

