<template>
  <div class="p-8 min-h-screen min-w-[1200px]">
    <div class="bg-white rounded-lg container-shadow p-8">
      <Header
        title="评价和评论审核"
        description="审核用户提交的评价和评论"
        header-icon="carbon:task-approved"
      />

      <!-- 标签页切换 -->
      <div class="p-6 bg-gray-50 border-b">
        <div class="flex items-center space-x-4">
          <button
            class="px-6 py-2 rounded-lg font-medium transition duration-200"
            :class="
              activeTab === 'reviews'
                ? 'bg-tsinghua-purple text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            "
            @click="switchTab('reviews')"
          >
            <span class="iconify inline-block mr-2" data-icon="carbon:star"></span>
            评价审核
          </button>
          <button
            class="px-6 py-2 rounded-lg font-medium transition duration-200"
            :class="
              activeTab === 'comments'
                ? 'bg-tsinghua-purple text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            "
            @click="switchTab('comments')"
          >
            <span class="iconify inline-block mr-2" data-icon="carbon:chat"></span>
            评论审核
          </button>
        </div>
      </div>

      <!-- 评价审核列表表格 -->
      <div v-if="activeTab === 'reviews'" class="overflow-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">菜品</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评分</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="isLoadingReviews">
              <td colspan="5" class="py-8 text-center text-gray-500">
                <span
                  class="iconify inline-block text-2xl animate-spin"
                  data-icon="mdi:loading"
                ></span>
                <span class="ml-2">加载中...</span>
              </td>
            </tr>
            <tr v-else-if="reviews.length === 0">
              <td colspan="5" class="py-8 text-center text-gray-500">暂无待审核评价</td>
            </tr>
            <tr
              v-else
              v-for="review in reviews"
              :key="review.id"
              class="hover:bg-gray-50"
            >
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <img
                    v-if="review.dishImage"
                    :src="review.dishImage"
                    :alt="review.dishName"
                    class="w-12 h-12 rounded object-cover border mr-3"
                  />
                  <div>
                    <div class="font-medium">{{ review.dishName }}</div>
                    <div class="text-sm text-gray-500">
                      {{ review.content ? (review.content.length > 30 ? review.content.substring(0, 30) + '...' : review.content) : '无内容' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="flex items-center">
                  <span class="text-yellow-500 mr-1">
                    <span class="iconify" data-icon="carbon:star-filled"></span>
                  </span>
                  <span class="font-medium">{{ review.rating }}</span>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="text-sm">
                  {{ formatDate(review.createdAt) }}
                </div>
              </td>
              <td class="py-4 px-6">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClasses[review.status]"
                >
                  {{ statusText[review.status] }}
                </span>
              </td>
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  class="px-4 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200 flex items-center justify-center mx-auto"
                  @click="openReviewDetail(review)"
                >
                  <span class="iconify inline-block mr-1" data-icon="carbon:view" style="vertical-align: middle;"></span>
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 评论审核列表表格 -->
      <div v-if="activeTab === 'comments'" class="overflow-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">关联评价</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">评论内容</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">提交时间</th>
              <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">状态</th>
              <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="isLoadingComments">
              <td colspan="5" class="py-8 text-center text-gray-500">
                <span
                  class="iconify inline-block text-2xl animate-spin"
                  data-icon="mdi:loading"
                ></span>
                <span class="ml-2">加载中...</span>
              </td>
            </tr>
            <tr v-else-if="comments.length === 0">
              <td colspan="5" class="py-8 text-center text-gray-500">暂无待审核评论</td>
            </tr>
            <tr
              v-else
              v-for="comment in comments"
              :key="comment.id"
              class="hover:bg-gray-50"
            >
              <td class="py-4 px-6">
                <div>
                  <div class="font-medium">{{ comment.dishName }}</div>
                  <div class="text-sm text-gray-500">
                    {{ comment.reviewContent ? (comment.reviewContent.length > 30 ? comment.reviewContent.substring(0, 30) + '...' : comment.reviewContent) : '无内容' }}
                  </div>
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="text-sm">
                  {{ comment.content ? (comment.content.length > 50 ? comment.content.substring(0, 50) + '...' : comment.content) : '无内容' }}
                </div>
              </td>
              <td class="py-4 px-6">
                <div class="text-sm">
                  {{ formatDate(comment.createdAt) }}
                </div>
              </td>
              <td class="py-4 px-6">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="statusClasses[comment.status]"
                >
                  {{ statusText[comment.status] }}
                </span>
              </td>
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  class="px-4 py-1 bg-tsinghua-purple text-white rounded text-sm hover:bg-tsinghua-dark transition duration-200 flex items-center justify-center mx-auto"
                  @click="openCommentDetail(comment)"
                >
                  <span class="iconify inline-block mr-1" data-icon="carbon:view" style="vertical-align: middle;"></span>
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <Pagination
        v-if="activeTab === 'reviews'"
        :current-page="currentPageReviews"
        :page-size="pageSize"
        :total="totalReviews"
        @page-change="handlePageChangeReviews"
      />
      <Pagination
        v-if="activeTab === 'comments'"
        :current-page="currentPageComments"
        :page-size="pageSize"
        :total="totalComments"
        @page-change="handlePageChangeComments"
      />
    </div>

    <!-- 评价详情对话框 -->
    <div
      v-if="selectedReview"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeReviewDetail"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <!-- 对话框头部 -->
        <div class="px-8 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
          <h3 class="text-xl font-semibold text-gray-900 flex items-center">
            <span class="iconify inline-block mr-3 text-tsinghua-purple" data-icon="carbon:star" style="font-size: 24px;"></span>
            评价详情
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition"
            @click="closeReviewDetail"
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
                  <div class="text-xs text-gray-400 uppercase tracking-wide">菜品名称</div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ selectedReview.dishName }}
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs text-gray-400 uppercase tracking-wide">评分</div>
                  <div class="flex items-center">
                    <span class="text-yellow-500 mr-1">
                      <span class="iconify" data-icon="carbon:star-filled"></span>
                    </span>
                    <span class="text-sm font-medium text-gray-900">{{ selectedReview.rating }}</span>
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs text-gray-400 uppercase tracking-wide">提交时间</div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ formatDate(selectedReview.createdAt) }}
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs text-gray-400 uppercase tracking-wide">审核状态</div>
                  <span
                    class="inline-block px-3 py-1 rounded-full text-xs font-medium"
                    :class="statusClasses[selectedReview.status]"
                  >
                    {{ statusText[selectedReview.status] }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 评价内容 -->
            <div class="bg-white rounded-xl shadow-md p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">评价内容</h4>
              <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300 mb-4">
                <div class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {{ selectedReview.content || '（无内容）' }}
                </div>
              </div>
              <!-- 评价图片 -->
              <div 
                v-if="selectedReview.images && selectedReview.images.length > 0"
                class="mt-4"
              >
                <div class="text-xs text-gray-400 uppercase tracking-wide mb-2">评价图片</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div
                    v-for="(image, index) in selectedReview.images"
                    :key="index"
                    class="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer hover:border-tsinghua-purple transition"
                    @click="openImagePreview(selectedReview.images, index)"
                  >
                    <img
                      :src="image"
                      :alt="`评价图片 ${index + 1}`"
                      class="w-full h-full object-cover"
                    />
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                      <span class="iconify text-white text-2xl opacity-0 group-hover:opacity-100 transition" data-icon="carbon:zoom-in"></span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 评分详情 -->
              <div 
                v-if="selectedReview.ratingDetails"
                class="mt-4 grid grid-cols-2 gap-4"
              >
                <div class="text-xs text-gray-400 uppercase tracking-wide mb-2 col-span-2">评分详情</div>
                <div v-if="selectedReview.ratingDetails.spicyLevel !== null && selectedReview.ratingDetails.spicyLevel !== undefined" class="text-sm">
                  <span class="text-gray-500">辣度：</span>
                  <span class="font-medium text-gray-900">{{ selectedReview.ratingDetails.spicyLevel }}</span>
                </div>
                <div v-if="selectedReview.ratingDetails.sweetness !== null && selectedReview.ratingDetails.sweetness !== undefined" class="text-sm">
                  <span class="text-gray-500">甜度：</span>
                  <span class="font-medium text-gray-900">{{ selectedReview.ratingDetails.sweetness }}</span>
                </div>
                <div v-if="selectedReview.ratingDetails.saltiness !== null && selectedReview.ratingDetails.saltiness !== undefined" class="text-sm">
                  <span class="text-gray-500">咸度：</span>
                  <span class="font-medium text-gray-900">{{ selectedReview.ratingDetails.saltiness }}</span>
                </div>
                <div v-if="selectedReview.ratingDetails.oiliness !== null && selectedReview.ratingDetails.oiliness !== undefined" class="text-sm">
                  <span class="text-gray-500">油度：</span>
                  <span class="font-medium text-gray-900">{{ selectedReview.ratingDetails.oiliness }}</span>
                </div>
              </div>
              <!-- 拒绝原因 -->
              <div v-if="selectedReview.rejectReason" class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-xs text-gray-400 uppercase tracking-wide mb-2">拒绝原因</div>
                <div class="text-sm text-red-600">
                  {{ selectedReview.rejectReason }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 对话框底部操作按钮 -->
        <div class="px-6 py-4 border-t bg-white">
          <div v-if="selectedReview.status === 'pending'" class="flex items-center justify-end space-x-3">
            <button
              class="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition duration-200 flex items-center"
              @click="openRejectReviewModal"
              :disabled="!authStore.hasPermission('review:approve') || isSubmitting"
              :title="!authStore.hasPermission('review:approve') ? '无权限审核评价' : '拒绝评价'"
            >
              <span class="iconify inline-block mr-1.5" data-icon="carbon:close" style="font-size: 16px;"></span>
              拒绝
            </button>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition duration-200 flex items-center"
              @click="handleApproveReview"
              :disabled="!authStore.hasPermission('review:approve') || isSubmitting"
              :title="!authStore.hasPermission('review:approve') ? '无权限审核评价' : '通过评价'"
            >
              <span
                v-if="isSubmitting"
                class="iconify inline-block mr-1.5 animate-spin"
                data-icon="mdi:loading"
                style="font-size: 16px;"
              ></span>
              <span v-else class="iconify inline-block mr-1.5" data-icon="carbon:checkmark" style="font-size: 16px;"></span>
              通过
            </button>
          </div>
          <div v-else class="text-sm text-gray-500 text-center py-2">
            <span class="iconify inline-block mr-1" data-icon="carbon:checkmark-filled" style="color: #10b981;"></span>
            该评价已{{ selectedReview.status === 'approved' ? '通过' : '拒绝' }}审核
          </div>
        </div>
      </div>
    </div>

    <!-- 评论详情对话框 -->
    <div
      v-if="selectedComment"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeCommentDetail"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <!-- 对话框头部 -->
        <div class="px-8 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
          <h3 class="text-xl font-semibold text-gray-900 flex items-center">
            <span class="iconify inline-block mr-3 text-tsinghua-purple" data-icon="carbon:chat" style="font-size: 24px;"></span>
            评论详情
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition"
            @click="closeCommentDetail"
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
                  <div class="text-xs text-gray-400 uppercase tracking-wide">关联菜品</div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ selectedComment.dishName }}
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs text-gray-400 uppercase tracking-wide">提交时间</div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ formatDate(selectedComment.createdAt) }}
                  </div>
                </div>
                <div class="space-y-1 col-span-2">
                  <div class="text-xs text-gray-400 uppercase tracking-wide">审核状态</div>
                  <span
                    class="inline-block px-3 py-1 rounded-full text-xs font-medium"
                    :class="statusClasses[selectedComment.status]"
                  >
                    {{ statusText[selectedComment.status] }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 关联评价 -->
            <div class="bg-white rounded-xl shadow-md p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">关联评价</h4>
              <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300">
                <div class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {{ selectedComment.reviewContent || '（无内容）' }}
                </div>
              </div>
            </div>

            <!-- 评论内容 -->
            <div class="bg-white rounded-xl shadow-md p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">评论内容</h4>
              <div class="py-4 px-5 bg-gray-50 rounded-lg border border-gray-300">
                <div class="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {{ selectedComment.content || '（无内容）' }}
                </div>
              </div>
              <!-- 拒绝原因 -->
              <div v-if="selectedComment.rejectReason" class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-xs text-gray-400 uppercase tracking-wide mb-2">拒绝原因</div>
                <div class="text-sm text-red-600">
                  {{ selectedComment.rejectReason }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 对话框底部操作按钮 -->
        <div class="px-6 py-4 border-t bg-white">
          <div v-if="selectedComment.status === 'pending'" class="flex items-center justify-end space-x-3">
            <button
              class="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition duration-200 flex items-center"
              @click="openRejectCommentModal"
              :disabled="!authStore.hasPermission('comment:approve') || isSubmitting"
              :title="!authStore.hasPermission('comment:approve') ? '无权限审核评论' : '拒绝评论'"
            >
              <span class="iconify inline-block mr-1.5" data-icon="carbon:close" style="font-size: 16px;"></span>
              拒绝
            </button>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition duration-200 flex items-center"
              @click="handleApproveComment"
              :disabled="!authStore.hasPermission('comment:approve') || isSubmitting"
              :title="!authStore.hasPermission('comment:approve') ? '无权限审核评论' : '通过评论'"
            >
              <span
                v-if="isSubmitting"
                class="iconify inline-block mr-1.5 animate-spin"
                data-icon="mdi:loading"
                style="font-size: 16px;"
              ></span>
              <span v-else class="iconify inline-block mr-1.5" data-icon="carbon:checkmark" style="font-size: 16px;"></span>
              通过
            </button>
          </div>
          <div v-else class="text-sm text-gray-500 text-center py-2">
            <span class="iconify inline-block mr-1" data-icon="carbon:checkmark-filled" style="color: #10b981;"></span>
            该评论已{{ selectedComment.status === 'approved' ? '通过' : '拒绝' }}审核
          </div>
        </div>
      </div>
    </div>

    <!-- 拒绝评价弹窗 -->
    <div
      v-if="isRejectReviewModalOpen"
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
      @click.self="closeRejectReviewModal"
    >
      <div class="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden animate-fade-in-up">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900">拒绝评价</h3>
          <button
            @click="closeRejectReviewModal"
            class="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <span class="iconify text-xl" data-icon="carbon:close"></span>
          </button>
        </div>

        <div class="p-6">
          <p class="text-gray-600 mb-4">
            确定要拒绝这条评价吗？
          </p>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">拒绝原因</label>
            <textarea
              v-model="rejectReviewReason"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow resize-none"
              placeholder="请输入拒绝原因（建议填写，以便用户了解）..."
            ></textarea>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            @click="closeRejectReviewModal"
            class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
          >
            取消
          </button>
          <button
            @click="handleRejectReview"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center"
            :disabled="isSubmitting || !rejectReviewReason.trim()"
          >
            <span
              v-if="isSubmitting"
              class="iconify animate-spin mr-2"
              data-icon="mdi:loading"
            ></span>
            确认拒绝
          </button>
        </div>
      </div>
    </div>

    <!-- 拒绝评论弹窗 -->
    <div
      v-if="isRejectCommentModalOpen"
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
      @click.self="closeRejectCommentModal"
    >
      <div class="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden animate-fade-in-up">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900">拒绝评论</h3>
          <button
            @click="closeRejectCommentModal"
            class="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <span class="iconify text-xl" data-icon="carbon:close"></span>
          </button>
        </div>

        <div class="p-6">
          <p class="text-gray-600 mb-4">
            确定要拒绝这条评论吗？
          </p>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">拒绝原因</label>
            <textarea
              v-model="rejectCommentReason"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow resize-none"
              placeholder="请输入拒绝原因（建议填写，以便用户了解）..."
            ></textarea>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            @click="closeRejectCommentModal"
            class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
          >
            取消
          </button>
          <button
            @click="handleRejectComment"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center"
            :disabled="isSubmitting || !rejectCommentReason.trim()"
          >
            <span
              v-if="isSubmitting"
              class="iconify animate-spin mr-2"
              data-icon="mdi:loading"
            ></span>
            确认拒绝
          </button>
        </div>
      </div>
    </div>

    <!-- 图片预览对话框 -->
    <div
      v-if="imagePreview.show"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]"
      @click.self="closeImagePreview"
    >
      <div class="relative max-w-7xl max-h-[90vh] mx-4">
        <!-- 关闭按钮 -->
        <button
          aria-label="关闭图片预览"
          class="absolute top-4 right-4 z-10 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
          @click="closeImagePreview"
        >
          <span class="iconify text-2xl" data-icon="carbon:close"></span>
        </button>
        
        <!-- 图片 -->
        <img
          :src="imagePreview.images[imagePreview.currentIndex]"
          :alt="`评价图片 ${imagePreview.currentIndex + 1}`"
          class="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
        
        <!-- 导航按钮 -->
        <button
          v-if="imagePreview.images.length > 1"
          aria-label="上一张图片"
          :aria-disabled="imagePreview.currentIndex === 0"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition disabled:opacity-50 disabled:cursor-not-allowed"
          @click.stop="previousImage"
          :disabled="imagePreview.currentIndex === 0"
        >
          <span class="iconify text-2xl" data-icon="carbon:chevron-left"></span>
        </button>
        <button
          v-if="imagePreview.images.length > 1"
          aria-label="下一张图片"
          :aria-disabled="imagePreview.currentIndex === imagePreview.images.length - 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition disabled:opacity-50 disabled:cursor-not-allowed"
          @click.stop="nextImage"
          :disabled="imagePreview.currentIndex === imagePreview.images.length - 1"
        >
          <span class="iconify text-2xl" data-icon="carbon:chevron-right"></span>
        </button>
        
        <!-- 图片计数 -->
        <div
          v-if="imagePreview.images.length > 1"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-50 rounded-full px-4 py-2 text-sm"
        >
          {{ imagePreview.currentIndex + 1 }} / {{ imagePreview.images.length }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, onActivated, onUnmounted, defineComponent } from 'vue'
import { reviewApi } from '@/api/modules/review'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import Pagination from '@/components/Common/Pagination.vue'
import type { PendingReview, PendingComment } from '@/types/api'

export default defineComponent({
  name: 'ReviewManage',
  components: {
    Header,
    Pagination,
  },
  setup() {
    const authStore = useAuthStore()
    const activeTab = ref<'reviews' | 'comments'>('reviews')
    
    // 评价相关
    const reviews = ref<PendingReview[]>([])
    const isLoadingReviews = ref(false)
    const currentPageReviews = ref(1)
    const totalReviews = ref(0)
    const selectedReview = ref<PendingReview | null>(null)
    const isRejectReviewModalOpen = ref(false)
    const rejectReviewReason = ref('')
    
    // 评论相关
    const comments = ref<PendingComment[]>([])
    const isLoadingComments = ref(false)
    const currentPageComments = ref(1)
    const totalComments = ref(0)
    const selectedComment = ref<PendingComment | null>(null)
    const isRejectCommentModalOpen = ref(false)
    const rejectCommentReason = ref('')
    
    // 通用
    const pageSize = ref(20)
    const isSubmitting = ref(false)
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

    const switchTab = (tab: 'reviews' | 'comments') => {
      activeTab.value = tab
      if (tab === 'reviews') {
        loadReviews()
      } else {
        loadComments()
      }
    }

    // 加载评价列表
    const loadReviews = async () => {
      isLoadingReviews.value = true
      try {
        const response = await reviewApi.getPendingReviews({
          page: currentPageReviews.value,
          pageSize: pageSize.value,
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
        alert('加载评价列表失败，请刷新重试')
        reviews.value = []
        totalReviews.value = 0
      } finally {
        isLoadingReviews.value = false
      }
    }

    // 加载评论列表
    const loadComments = async () => {
      isLoadingComments.value = true
      try {
        const response = await reviewApi.getPendingComments({
          page: currentPageComments.value,
          pageSize: pageSize.value,
        })

        if (response.code === 200 && response.data) {
          comments.value = response.data.items || []
          totalComments.value = response.data.meta?.total || 0
        } else {
          comments.value = []
          totalComments.value = 0
        }
      } catch (error) {
        console.error('加载评论列表失败:', error)
        alert('加载评论列表失败，请刷新重试')
        comments.value = []
        totalComments.value = 0
      } finally {
        isLoadingComments.value = false
      }
    }

    const handlePageChangeReviews = (page: number) => {
      currentPageReviews.value = page
      loadReviews()
    }

    const handlePageChangeComments = (page: number) => {
      currentPageComments.value = page
      loadComments()
    }

    // 评价相关操作
    const openReviewDetail = (review: PendingReview) => {
      selectedReview.value = review
    }

    const closeReviewDetail = () => {
      selectedReview.value = null
    }

    const openRejectReviewModal = () => {
      isRejectReviewModalOpen.value = true
      rejectReviewReason.value = ''
    }

    const closeRejectReviewModal = () => {
      isRejectReviewModalOpen.value = false
      rejectReviewReason.value = ''
    }

    const handleApproveReview = async () => {
      if (!authStore.hasPermission('review:approve')) {
        alert('您没有权限审核评价')
        return
      }

      if (!selectedReview.value) return

      isSubmitting.value = true
      try {
        const response = await reviewApi.approveReview(selectedReview.value.id)
        if (response.code === 200) {
          alert('审核通过')
          await loadReviews()
          closeReviewDetail()
        } else {
          alert(response.message || '审核失败')
        }
      } catch (error) {
        console.error('审核评价失败:', error)
        alert('审核评价失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    const handleRejectReview = async () => {
      if (!authStore.hasPermission('review:approve')) {
        alert('您没有权限审核评价')
        return
      }

      if (!selectedReview.value || !rejectReviewReason.value.trim()) {
        alert('请填写拒绝原因')
        return
      }

      isSubmitting.value = true
      try {
        const response = await reviewApi.rejectReview(selectedReview.value.id, rejectReviewReason.value)
        if (response.code === 200) {
          alert('已拒绝')
          await loadReviews()
          closeRejectReviewModal()
          closeReviewDetail()
        } else {
          alert(response.message || '拒绝失败')
        }
      } catch (error) {
        console.error('拒绝评价失败:', error)
        alert('拒绝评价失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    // 评论相关操作
    const openCommentDetail = (comment: PendingComment) => {
      selectedComment.value = comment
    }

    const closeCommentDetail = () => {
      selectedComment.value = null
    }

    const openRejectCommentModal = () => {
      isRejectCommentModalOpen.value = true
      rejectCommentReason.value = ''
    }

    const closeRejectCommentModal = () => {
      isRejectCommentModalOpen.value = false
      rejectCommentReason.value = ''
    }

    const handleApproveComment = async () => {
      if (!authStore.hasPermission('comment:approve')) {
        alert('您没有权限审核评论')
        return
      }

      if (!selectedComment.value) return

      isSubmitting.value = true
      try {
        const response = await reviewApi.approveComment(selectedComment.value.id)
        if (response.code === 200) {
          alert('审核通过')
          await loadComments()
          closeCommentDetail()
        } else {
          alert(response.message || '审核失败')
        }
      } catch (error) {
        console.error('审核评论失败:', error)
        alert('审核评论失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    const handleRejectComment = async () => {
      if (!authStore.hasPermission('comment:approve')) {
        alert('您没有权限审核评论')
        return
      }

      if (!selectedComment.value || !rejectCommentReason.value.trim()) {
        alert('请填写拒绝原因')
        return
      }

      isSubmitting.value = true
      try {
        const response = await reviewApi.rejectComment(selectedComment.value.id, rejectCommentReason.value)
        if (response.code === 200) {
          alert('已拒绝')
          await loadComments()
          closeRejectCommentModal()
          closeCommentDetail()
        } else {
          alert(response.message || '拒绝失败')
        }
      } catch (error) {
        console.error('拒绝评论失败:', error)
        alert('拒绝评论失败，请重试')
      } finally {
        isSubmitting.value = false
      }
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!imagePreview.value.show) return
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        previousImage()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextImage()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closeImagePreview()
      }
    }

    onMounted(() => {
      loadReviews()
      window.addEventListener('keydown', handleKeyDown)
    })

    onActivated(() => {
      if (activeTab.value === 'reviews') {
        loadReviews()
      } else {
        loadComments()
      }
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
    })

    return {
      activeTab,
      reviews,
      isLoadingReviews,
      currentPageReviews,
      totalReviews,
      comments,
      isLoadingComments,
      currentPageComments,
      totalComments,
      pageSize,
      selectedReview,
      selectedComment,
      statusClasses,
      statusText,
      formatDate,
      switchTab,
      handlePageChangeReviews,
      handlePageChangeComments,
      openReviewDetail,
      closeReviewDetail,
      openRejectReviewModal,
      closeRejectReviewModal,
      handleApproveReview,
      handleRejectReview,
      openCommentDetail,
      closeCommentDetail,
      openRejectCommentModal,
      closeRejectCommentModal,
      handleApproveComment,
      handleRejectComment,
      isRejectReviewModalOpen,
      rejectReviewReason,
      isRejectCommentModalOpen,
      rejectCommentReason,
      isSubmitting,
      imagePreview,
      openImagePreview,
      closeImagePreview,
      previousImage,
      nextImage,
      authStore,
    }
  },
})
</script>

