<template>
  <div class="admin-page">
    <div class="admin-panel">
      <Header title="新闻管理" :description="sourcesConfigured ? '管理校园新闻与公众号内容来源' : '管理校园新闻内容与发布状态'" header-icon="carbon:license-draft" />

      <div v-if="sourcesConfigured" class="admin-tabs news-workspace-navigation">
      <div class="admin-tab-list" role="tablist" aria-label="新闻管理视图">
        <button id="news-tab-content" type="button" class="admin-tab" role="tab" :aria-selected="activeSection === 'content'" :tabindex="activeSection === 'content' ? 0 : -1" aria-controls="news-content-panel" @click="changeNewsSection('content')" @keydown.right.prevent="changeNewsSection('sources', true)" @keydown.left.prevent="changeNewsSection('sources', true)" @keydown.home.prevent="changeNewsSection('content', true)" @keydown.end.prevent="changeNewsSection('sources', true)">
          <AppIcon icon="carbon:document" aria-hidden="true" />新闻内容
        </button>
        <button id="news-tab-sources" type="button" class="admin-tab" role="tab" :aria-selected="activeSection === 'sources'" :tabindex="activeSection === 'sources' ? 0 : -1" aria-controls="news-sources-panel" @click="changeNewsSection('sources')" @keydown.right.prevent="changeNewsSection('content', true)" @keydown.left.prevent="changeNewsSection('content', true)" @keydown.home.prevent="changeNewsSection('content', true)" @keydown.end.prevent="changeNewsSection('sources', true)">
          <AppIcon icon="carbon:rss" aria-hidden="true" />公众号来源
        </button>
      </div>
        <a
          v-if="activeSection === 'sources' && werssAdminUrl && authStore.hasPermission('news:create')"
          class="news-service-link"
          :href="werssAdminUrl"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="打开 WeRSS 管理面板（新窗口）"
          title="管理公众号订阅与采集授权（新窗口）"
        >
          WeRSS 面板<AppIcon icon="carbon:launch" aria-hidden="true" />
        </a>
      </div>
      <section v-if="sourcesConfigured" id="news-sources-panel" v-show="activeSection === 'sources'" role="tabpanel" aria-labelledby="news-tab-sources">
        <NewsSources :active="activeSection === 'sources'" :canteens="canteenList" @imported="loadNews()" @panel-url="werssAdminUrl = $event" />
      </section>
      <section id="news-content-panel" v-show="activeSection === 'content'" :role="sourcesConfigured ? 'tabpanel' : undefined" :aria-labelledby="sourcesConfigured ? 'news-tab-content' : undefined">

      <!-- 创建新闻按钮和状态筛选 -->
      <div class="news-content-toolbar">
        <!-- 状态筛选 -->
        <div class="news-status-filter" aria-label="新闻发布状态">
          <button
            class="news-status-button"
            :aria-pressed="currentStatus === 'published'"
            :class="{ 'is-selected': currentStatus === 'published' }"
            @click="changeStatus('published')"
          >
            已发布
          </button>
          <button
            class="news-status-button"
            :aria-pressed="currentStatus === 'draft'"
            :class="{ 'is-selected': currentStatus === 'draft' }"
            @click="changeStatus('draft')"
          >
            草稿箱
          </button>
        </div>

        <!-- 创建新闻按钮 -->
        <button
          @click="openCreateModal"
          type="button"
          class="admin-button admin-button-primary news-create-button"
          :disabled="!authStore.hasPermission('news:create')"
          :title="!authStore.hasPermission('news:create') ? '无权限创建' : '创建新闻'"
        >
          <AppIcon class="iconify" icon="carbon:add"></AppIcon>
          <span>创建新闻</span>
        </button>
      </div>

      <!-- 新闻列表 -->
      <div class="mt-6">

        <!-- 搜索和筛选栏 -->
        <div class="admin-filters">
          <!-- 搜索栏 -->
          <div class="relative">
            <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="输入新闻标题进行搜索..."
              class="w-full pl-10 pr-10 admin-input"
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
              <span class="text-sm font-medium text-gray-600">发布食堂</span>
              <div class="relative">
                <select
                  v-model="canteenFilter"
                  class="bg-white min-w-[150px] transition-all cursor-pointer hover:border-gray-400 admin-input"
                >
                  <option value="">不限食堂</option>
                  <option v-if="!isCanteenScoped" value="all">全校公告</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">开始时间</span>
              <input
                type="datetime-local"
                v-model="startDate"
                class="bg-white transition-all hover:border-gray-400 admin-input"
              />
            </div>

            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">结束时间</span>
              <input
                type="datetime-local"
                v-model="endDate"
                class="bg-white transition-all hover:border-gray-400 admin-input"
              />
            </div>

            <div v-if="searchQuery || canteenFilter || startDate || endDate" class="ml-auto flex items-center">
              <button
                @click="resetFilters"
                class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 hover:bg-gray-200/50 transition-colors admin-button"
              >
                <AppIcon class="iconify" icon="carbon:reset"></AppIcon>
                重置筛选
              </button>
            </div>
          </div>
        </div>

        <BatchActionBar
          v-if="canDeleteNews"
          :count="newsSelection.selectedCount"
          resource="新闻"
          :busy="isBatchDeleting"
          :disabled="isLoading"
          @clear="newsSelection.clear"
          @delete="handleBatchDelete"
        />
        <div class="admin-table-scroll">
          <table class="admin-table news-table">
            <colgroup>
              <col v-if="canDeleteNews" class="news-col-selection" />
              <col />
              <col class="news-col-summary" />
              <col class="news-col-canteen" />
              <col class="news-col-time" />
              <col class="news-col-actions" />
            </colgroup>
            <thead class="bg-gray-50">
              <tr>
                <th v-if="canDeleteNews" scope="col" class="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="全选当前页新闻"
                    class="h-4 w-4 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                    :checked="newsSelection.allSelected"
                    :indeterminate="newsSelection.someSelected"
                    :disabled="isLoading || isBatchDeleting || filteredNewsList.length === 0"
                    @change="newsSelection.toggleAll"
                  />
                </th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">标题</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">摘要</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">食堂</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">
                  {{ currentStatus === 'published' ? '发布时间' : '创建时间' }}
                </th>
                <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody v-if="!isLoading" class="divide-y divide-gray-200">
              <tr v-for="news in filteredNewsList" :key="news.id" class="hover:bg-gray-50">
                <td v-if="canDeleteNews" class="px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    :aria-label="`选择新闻 ${news.title}`"
                    class="h-4 w-4 accent-tsinghua-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tsinghua-purple"
                    :checked="newsSelection.selectedIds.includes(news.id)"
                    :disabled="isBatchDeleting"
                    @change="newsSelection.toggle(news.id)"
                  />
                </td>
                <td class="py-4 px-6 news-title-cell">
                  <div class="font-medium text-gray-900">{{ news.title }}</div>
                </td>
                <td class="py-4 px-6">
                  <div class="text-gray-600 text-sm max-w-xs truncate">
                    {{ getSummary(news) }}
                  </div>
                </td>
                <td class="py-4 px-6 text-gray-600">{{ getCanteenName(news.canteenId) }}</td>
                <td class="py-4 px-6 text-gray-600 text-sm">
                  {{
                    formatDate(currentStatus === 'published' ? news.publishedAt : news.createdAt) ||
                    '未设置'
                  }}
                </td>
                <td class="py-4 px-6 text-center">
                  <div class="news-row-actions" role="group" :aria-label="`新闻 ${news.title} 的操作`">
                    <button
                      type="button"
                      @click="previewNews(news)"
                      class="admin-button admin-button-compact admin-button-secondary news-row-action"
                      title="预览新闻"
                    >
                      预览
                    </button>
                    <template v-if="currentStatus === 'draft'">
                      <button
                        type="button"
                        @click="editNews(news)"
                        class="admin-button admin-button-compact admin-button-secondary news-row-action"
                        :disabled="!authStore.hasPermission('news:edit') || isBatchDeleting"
                        :title="!authStore.hasPermission('news:edit') ? '无权限编辑' : '编辑新闻'"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        @click="publishNews(news.id)"
                        class="admin-button admin-button-compact news-row-action news-row-action-publish"
                        :disabled="!authStore.hasPermission('news:publish') || isBatchDeleting"
                        :title="!authStore.hasPermission('news:publish') ? '无权限发布' : '发布新闻'"
                      >
                        发布
                      </button>
                    </template>
                    <button
                      v-else
                      type="button"
                      @click="revokeNews(news.id)"
                      class="admin-button admin-button-compact admin-button-secondary news-row-action"
                      :disabled="!authStore.hasPermission('news:revoke') || isBatchDeleting"
                      :title="!authStore.hasPermission('news:revoke') ? '无权限撤回' : '如需编辑已发布新闻，请先撤回至草稿状态'"
                    >
                      撤回
                    </button>
                    <span class="news-row-danger-action">
                      <button
                        type="button"
                        @click="deleteNews(news.id)"
                        :disabled="!authStore.hasPermission('news:delete') || isBatchDeleting"
                        class="admin-button admin-button-compact news-row-action news-row-action-delete"
                        :title="!authStore.hasPermission('news:delete') ? '无权限删除' : '删除新闻'"
                      >
                        删除
                      </button>
                    </span>
                  </div>
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
        <div v-else-if="filteredNewsList.length === 0" class="admin-state">
          {{ searchQuery || canteenFilter || startDate || endDate ? '没有找到符合条件的新闻' : `暂无${currentStatus === 'published' ? '已发布' : '未发布'}新闻` }}
        </div>

        <!-- 分页 -->
        <div class="mt-6" v-if="pagination.totalPages > 1">
          <Pagination
            :current-page="pagination.page"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            @page-change="handlePageChange"
          />
        </div>
      </div>
      </section>
    </div>
  </div>

  <!-- 创建/编辑新闻模态框 -->
  <AdminDialog
    v-if="showCreateModal || showEditModal"
    :open="showCreateModal || showEditModal"
    :label="showEditModal ? '编辑新闻' : '创建新闻'"
    :close-on-escape="editorAuxiliaryPanels.length === 0"
    @close="closeModal"
    @keydown="handleEditorKeydown"
  >
    <div class="w-full max-w-5xl max-h-[95vh] overflow-y-auto m-4 admin-dialog-panel">
      <div class="flex items-center justify-between admin-dialog-header">
        <h3 class="text-xl font-semibold text-gray-800">
          {{ showEditModal ? '编辑新闻' : '创建新闻' }}
        </h3>
        <button @click="closeModal" aria-label="关闭新闻编辑" class="text-gray-400 hover:text-gray-600 transition admin-icon-button">
          <AppIcon class="iconify text-2xl" icon="carbon:close"></AppIcon>
        </button>
      </div>

      <div class="admin-dialog-body">
        <form @submit.prevent="submitForm" class="space-y-6">
          <!-- 发布人信息 -->
          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label">发布人</label>
            <input
              :value="currentAdmin?.username || currentAdmin?.id || '未知'"
              type="text"
              disabled
              class="w-full bg-gray-100 text-gray-500 cursor-not-allowed admin-input"
            />
            <p class="mt-1 text-sm text-gray-500">
              发布人ID: {{ currentAdmin?.id || '未知' }} (自动填充)
            </p>
          </div>

          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label"
              >标题 <span class="text-red-500">*</span></label
            >
            <input
              v-model="newsForm.title"
              :disabled="isSubmitting"
              @input="errors.title = ''"
              type="text"
              required
              class="w-full admin-input"
              :class="{
                'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.title,
              }"
              placeholder="请输入新闻标题"
            />
            <p v-if="errors.title" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
              <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
              {{ errors.title }}
            </p>
          </div>

          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label"
              >摘要 <span class="text-red-500">*</span></label
            >
            <input
              v-model="newsForm.summary"
              :disabled="isSubmitting"
              @input="errors.summary = ''"
              type="text"
              required
              class="w-full admin-input"
              :class="{
                'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.summary,
              }"
              placeholder="请输入新闻摘要"
            />
            <p v-if="errors.summary" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
              <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
              {{ errors.summary }}
            </p>
          </div>

          <!-- ================= 富文本编辑器区域 START ================= -->
          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label"
              >内容 <span class="text-red-500">*</span></label
            >
            <div
              style="border: 1px solid #ccc; z-index: 100"
              class="rounded-lg overflow-hidden"
              :class="{
                'border-red-400': errors.content,
              }"
            >
              <div v-if="preserveImportedContent" class="p-4">
                <p class="mb-3 text-sm text-gray-600">已保留公众号原文排版。编辑正文后，编辑器会调整部分样式。</p>
                <button type="button" class="admin-button bg-gray-100 mb-4" @click="preserveImportedContent = false">编辑正文</button>
                <div class="news-preview-content" v-html="sanitizeRichHtml(newsForm.content, true)"></div>
              </div>
              <NewsEditor v-else
                :key="editorVersion"
                v-model="valueHtml"
                :editor="editorRef"
                :config="editorConfig"
                @created="handleCreated"
              />
            </div>
            <p v-if="errors.content" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
              <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
              {{ errors.content }}
            </p>
          </div>
          <!-- ================= 富文本编辑器区域 END ================= -->

        <div class="admin-form-grid">
            <div>
              <label class="block text-gray-700 font-medium mb-2 admin-label"
                >发布单位 <span class="text-red-500">*</span></label
              >
              <select
                v-model="newsForm.canteenId"
                :disabled="isSubmitting"
                class="w-full admin-input"
              >
                <option value="">{{ isCanteenScoped ? '请选择食堂' : '全校公告' }}</option>
                <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                  {{ canteen.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-gray-700 font-medium mb-2 admin-label"
                >发布时间 <span class="text-red-500">*</span></label
              >
              <input
                v-model="newsForm.publishedAt"
                :disabled="isSubmitting"
                type="datetime-local"
                required
                class="w-full admin-input"
              />
            </div>
          </div>

          <div class="flex pt-4 border-t border-gray-200 admin-actions">
            <!-- 创建模式：保存草稿 或 立即发布 -->
            <template v-if="!showEditModal">
              <button
                type="button"
                @click="submitForm('draft')"
                :disabled="!editorRef || isSubmitting || pendingImageUploads > 0"
                class="flex-1 transition duration-200 admin-button admin-button-secondary"
              >
                保存为草稿
              </button>
              <button
                type="button"
                @click="submitForm('published')"
                :disabled="!editorRef || isSubmitting || pendingImageUploads > 0"
                class="flex-1 transition duration-200 admin-button admin-button-primary"
              >
                立即发布
              </button>
            </template>

            <!-- 编辑模式：保存更新 -->
            <template v-else>
              <button
                type="button"
                @click="submitForm('draft')"
                :disabled="!editorRef || isSubmitting || pendingImageUploads > 0"
                class="flex-1 transition duration-200 admin-button admin-button-secondary"
              >
                保存为草稿
              </button>
              <button
                type="button"
                @click="submitForm('published')"
                :disabled="!editorRef || isSubmitting || pendingImageUploads > 0"
                class="flex-1 transition duration-200 admin-button admin-button-primary"
              >
                立即发布
              </button>
            </template>

            <button
              type="button"
              @click="closeModal"
              class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminDialog>

  <!-- 新闻预览模态框 -->
  <AdminDialog
    v-if="showPreviewModal"
    :open="showPreviewModal"
    labelledby="news-preview-title"
    @close="closePreviewModal"
  >
    <div class="w-full max-w-4xl max-h-[95vh] overflow-hidden m-4 flex flex-col admin-dialog-panel">
      <!-- 预览头部 -->
      <div class="flex items-center justify-between flex-shrink-0 admin-dialog-header">
        <h3 id="news-preview-title" class="text-xl font-semibold text-gray-800">新闻预览</h3>
        <button
          @click="closePreviewModal"
          aria-label="关闭新闻预览"
          class="text-gray-400 hover:text-gray-600 transition admin-icon-button"
        >
          <AppIcon class="iconify text-2xl" icon="carbon:close"></AppIcon>
        </button>
      </div>

      <!-- 预览内容区域（可滚动） -->
      <div class="flex-1 overflow-y-auto bg-gray-100">
        <div class="p-4 box-border w-full bg-white min-h-full">
          <div v-if="previewNewsData.id" class="pb-5">
            <!-- 标题 -->
            <div class="text-2xl font-bold mb-2.5 leading-relaxed">{{ previewNewsData.title }}</div>

            <!-- 发布信息 -->
            <div class="flex justify-between text-gray-500 text-sm mb-5 pb-2.5 border-b border-gray-200">
              <span>{{ previewNewsData.canteenName || '全校公告' }}</span>
              <span>{{ previewNewsData.publishedAt ? formatPreviewTime(previewNewsData.publishedAt) : (previewNewsData.createdAt ? formatPreviewTime(previewNewsData.createdAt) : '') }}</span>
            </div>

            <p v-if="previewNewsData.sourceUrl" class="mb-4 text-sm text-gray-600">来源：{{ previewNewsData.sourceName }} <a :href="previewNewsData.sourceUrl" target="_blank" rel="noopener noreferrer" class="underline text-tsinghua-purple">查看微信原文</a></p>
            <!-- 内容（富文本） -->
            <div
              class="text-base leading-relaxed text-gray-800 overflow-hidden break-words w-full news-preview-content"
              v-html="formattedPreviewContent"
            ></div>

            <!-- 发布人信息 -->
            <div class="mt-6 pt-2 border-t border-dashed border-gray-200 text-gray-500 text-xs text-right">
              <span>发布人：{{ previewNewsData.createdBy || '管理员' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminDialog>
</template>

<script>
import { nextTick, ref, reactive, onMounted, onActivated, onDeactivated, shallowRef, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import NewsEditor from '@/components/News/NewsEditor.vue'
import NewsSources from '@/components/News/NewsSources.vue'

import { newsApi } from '@/api/modules/news'
import { newsSourcesApi } from '@/api/modules/news-sources'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import request from '@/utils/request'
import Header from '@/components/Layout/Header.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import Pagination from '@/components/Common/Pagination.vue'
import BatchActionBar from '@/components/Common/BatchActionBar.vue'
import { useBatchSelection } from '@/composables/useBatchSelection'
import { savePageState, restorePageState } from '@/utils/page-state-cache'
import { showConfirm, showConfirmDanger } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'
import { sanitizeRichHtml } from '@/utils/sanitize-rich-html'
import { authSessionVersion, getAuthSessionVersion } from '@/utils/auth-session'

const PAGE_STATE_KEY = 'news-manage'

export default {
  name: 'NewsManage',
  components: {
    Header,
    AdminDialog,
    Pagination,
    BatchActionBar,
    NewsEditor,
    NewsSources,
  },
  setup() {
    const notify = useNotification()
    const route = useRoute()
    const activeSection = ref('content')
    const sourcesConfigured = ref(false)
    const werssAdminUrl = ref(null)
    const changeNewsSection = (section, focus = false) => {
      if (section === 'sources' && !sourcesConfigured.value) return
      activeSection.value = section
      if (focus) void nextTick(() => document.getElementById(`news-tab-${section}`)?.focus())
    }
    const newsList = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const showPreviewModal = ref(false)
    const previewNewsData = ref({})
    const editingNewsId = ref(null)
    const preserveImportedContent = ref(false)
    const isLoading = ref(false)
    const canteenList = ref([])
    const authStore = useAuthStore()
    const isCanteenScoped = computed(() => authStore.user?.scope === 'CANTEENS')
    const viewSession = getAuthSessionVersion()
    let isViewActive = true
    let viewVersion = 0
    const ownsView = (version = viewVersion) => isViewActive &&
      viewSession === getAuthSessionVersion() && version === viewVersion
    const loadSourceCapabilities = async () => {
      if (!ownsView()) return
      const version = viewVersion
      try {
        const response = await newsSourcesApi.capabilities()
        if (!ownsView(version) || response.code !== 200) return
        sourcesConfigured.value = response.data.configured
        werssAdminUrl.value = response.data.adminUrl
        if (!sourcesConfigured.value) changeNewsSection('content')
      } catch {
        // Preserve known deployment capabilities during a temporary API failure.
      }
    }
    const editorVersion = ref(0)
    const isSubmitting = ref(false)
    const pendingImageUploads = ref(0)
    let activeSubmission = null
    const ownsEditor = (version) => ownsView() && version === editorVersion.value &&
      (showCreateModal.value || showEditModal.value)

    // 默认状态定义
    const defaultState = {
      currentStatus: 'published',
      searchQuery: '',
      canteenFilter: '',
      startDate: '',
      endDate: '',
      page: 1,
    }

    // 从缓存恢复状态
    const restoredState = restorePageState(PAGE_STATE_KEY, defaultState)
    const currentStatus = ref(restoredState.currentStatus) // 默认显示已发布
    const searchQuery = ref(restoredState.searchQuery)
    const canteenFilter = ref(restoredState.canteenFilter)
    const startDate = ref(restoredState.startDate)
    const endDate = ref(restoredState.endDate)

    // 保存页面状态
    const saveState = () => {
      savePageState(PAGE_STATE_KEY, {
        currentStatus: currentStatus.value,
        searchQuery: searchQuery.value,
        canteenFilter: canteenFilter.value,
        startDate: startDate.value,
        endDate: endDate.value,
        page: pagination.page,
      })
    }

    // 获取当前登录管理员信息
    const currentAdmin = computed(() => authStore.user)

    // --- wangEditor 配置 START ---
    // 编辑器实例，必须用 shallowRef
    const editorRef = shallowRef()
    const editorAuxiliaryPanels = shallowRef([])
    let editorPanelEscapeTimer

    const clearEditorPanelEscape = () => {
      clearTimeout(editorPanelEscapeTimer)
      editorPanelEscapeTimer = undefined
    }

    // 内容 HTML，直接绑定到 Editor
    const valueHtml = ref('')

    const editorConfig = computed(() => {
      const version = editorVersion.value
      return {
        placeholder: '请输入新闻内容...',
        MENU_CONF: {
          uploadImage: {
            maxFileSize: 10 * 1024 * 1024,
            async customUpload(file, insertFn) {
              if (!ownsEditor(version) || isSubmitting.value) return
              if (file.size > 10 * 1024 * 1024) {
                notify.info('图片大小不能超过10MB')
                return
              }
              const body = new FormData()
              body.append('file', file)
              pendingImageUploads.value += 1
              try {
                const response = await request.post('/upload/image', body, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                })
                if (!ownsEditor(version)) return
                if (response.code !== 200 && response.code !== 201) {
                  throw new Error(response.message || '图片上传失败')
                }
                const { url, filename } = response.data
                insertFn(url, filename, url)
              } catch (error) {
                if (!ownsEditor(version)) return
                console.error('上传错误:', error)
                notify.error('图片上传出错: ' + (error instanceof Error ? error.message : '未知错误'))
              } finally {
                if (ownsEditor(version)) pendingImageUploads.value -= 1
              }
            },
          },
        },
      }
    })

    const destroyEditor = () => {
      clearEditorPanelEscape()
      const editor = editorRef.value
      editorRef.value = undefined
      editorAuxiliaryPanels.value = []
      editor?.destroy()
    }

    const handleCreated = computed(() => {
      const version = editorVersion.value
      return (editor) => {
        if (!ownsEditor(version)) {
          editor.destroy()
          return
        }
        clearEditorPanelEscape()
        editorAuxiliaryPanels.value = []
        editorRef.value = editor
        const isCurrentEditor = () => ownsEditor(version) && editorRef.value === editor
        editor.on('modalOrPanelShow', panel => {
          if (isCurrentEditor()) {
            clearEditorPanelEscape()
            editorAuxiliaryPanels.value = [
              ...editorAuxiliaryPanels.value.filter(current => current.isShow && current !== panel),
              panel,
            ]
          }
        })
        editor.on('modalOrPanelHide', () => {
          if (isCurrentEditor()) {
            // The SDK hide event has no panel identity; other panels may still be visible.
            editorAuxiliaryPanels.value = editorAuxiliaryPanels.value.filter(panel => panel.isShow)
          }
        })
        editor.on('destroyed', () => {
          if (editorRef.value === editor) {
            clearEditorPanelEscape()
            editorAuxiliaryPanels.value = []
            editorRef.value = undefined
          }
        })
        if (isSubmitting.value) editor.disable()
      }
    })
    const handleEditorKeydown = event => {
      if (event.key !== 'Escape') return
      const panel = editorAuxiliaryPanels.value[editorAuxiliaryPanels.value.length - 1]
      if (!panel) return
      event.preventDefault()
      event.stopPropagation()
      clearEditorPanelEscape()
      const editor = editorRef.value
      const version = editorVersion.value
      const hidePanel = () => {
        if (!ownsEditor(version) || editorRef.value !== editor ||
            !editorAuxiliaryPanels.value.includes(panel)) return
        panel.hide()
        if (!panel.isShow) editor.restoreSelection()
      }
      hidePanel()
      if (panel.isShow) {
        // wangEditor ignores hide() during a panel's first 200 ms.
        editorPanelEscapeTimer = setTimeout(() => {
          editorPanelEscapeTimer = undefined
          hidePanel()
        }, 200)
      }
    }
    // --- wangEditor 配置 END ---

    const pagination = reactive({
      page: restoredState.page || 1, // 恢复分页状态
      pageSize: 10,
      total: 0,
      totalPages: 0,
    })
    const listContext = computed(() => [currentStatus.value, searchQuery.value, canteenFilter.value,
      startDate.value, endDate.value, pagination.page, pagination.pageSize])

    // 表单错误状态
    const errors = reactive({
      title: '',
      summary: '',
      content: '',
    })

    const newsForm = reactive({
      title: '',
      content: '',
      summary: '',
      canteenId: (authStore.user?.canteenIds.length === 1 ? authStore.user.canteenIds[0] : ''),
      publishedAt: '',
      status: 'draft',
    })

    let newsRequestId = 0
    // 加载新闻列表
    const loadNews = async (clampPage = false) => {
      if (!ownsView()) return
      const requestId = ++newsRequestId
      const version = viewVersion
      const context = listContext.value
      const ownsRequest = () => ownsView(version) && requestId === newsRequestId &&
        context === listContext.value
      isLoading.value = true
      try {
        const response = await newsApi.getNews({
          page: pagination.page,
          pageSize: pagination.pageSize,
          status: currentStatus.value,
          ...(searchQuery.value.trim() ? { keyword: searchQuery.value.trim() } : {}),
          ...(canteenFilter.value ? { canteenId: canteenFilter.value } : {}),
          ...(startDate.value ? { startDate: new Date(startDate.value).toISOString() } : {}),
          ...(endDate.value ? { endDate: new Date(endDate.value).toISOString() } : {}),
        })
        if (!ownsRequest()) return

        if (response.code === 200 && response.data) {
          if (response.data.items) {
            const lastPage = Math.max(1, Math.ceil((response.data.meta?.total || 0) / pagination.pageSize))
            if (clampPage && pagination.page > lastPage) {
              pagination.page = lastPage
              saveState()
              return loadNews(true)
            }
            newsList.value = response.data.items
            if (response.data.meta) {
              pagination.total = response.data.meta.total
              pagination.totalPages =
                response.data.meta.totalPages ||
                Math.ceil(response.data.meta.total / pagination.pageSize)
            }
          } else if (Array.isArray(response.data)) {
            newsList.value = response.data
          }
        } else {
          // 清空列表
          newsList.value = []
          pagination.total = 0
        }
      } catch (error) {
        if (!ownsRequest()) return
        newsList.value = []
        pagination.total = 0
        pagination.totalPages = 0
        console.error('加载新闻列表失败:', error)
        notify.error(error instanceof Error ? error.message : '加载新闻列表失败，请重试')
      } finally {
        if (ownsRequest()) isLoading.value = false
      }
    }

    watch([searchQuery, canteenFilter, startDate, endDate], () => {
      pagination.page = 1
      saveState()
      loadNews()
    })

    // 切换状态筛选
    const changeStatus = (status) => {
      currentStatus.value = status
      pagination.page = 1
      saveState() // 保存状态
      loadNews()
    }

    const formatDate = (dateString) => {
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

    const getSummary = (news) => {
      // 简单处理：如果是富文本，可能包含HTML标签，这里简单截取
      // 实际项目中建议后端返回纯文本摘要，或者前端用正则去掉HTML标签
      let text = news.summary || news.content || '无摘要'
      // 移除HTML标签仅用于列表展示（简单的正则）
      text = text.replace(/<[^>]+>/g, '')
      return text.length > 50 ? text.substring(0, 50) + '...' : text
    }

    const getCanteenName = (canteenId) => {
      if (!canteenId) return '全校公告'
      const canteen = canteenList.value.find((c) => c.id === canteenId)
      return canteen ? canteen.name : '未知食堂'
    }

    const filteredNewsList = computed(() => newsList.value)

    const canDeleteNews = computed(() => authStore.hasPermission('news:delete'))
    const isBatchDeleting = ref(false)
    const newsSelection = useBatchSelection({
      ids: () => filteredNewsList.value.map(news => news.id),
      context: () => [listContext.value, route.fullPath, authSessionVersion.value],
      enabled: () => canDeleteNews.value,
    })

    const handleBatchDelete = async () => {
      if (isBatchDeleting.value || isLoading.value || !ownsView() ||
          !authStore.hasPermission('news:delete')) return
      const ids = [...newsSelection.selectedIds.value]
      if (ids.length === 0 || ids.length > 100) return
      const context = newsSelection.contextVersion.value
      const version = viewVersion
      const ownsOperation = () => ownsView(version) && context === newsSelection.contextVersion.value &&
        authStore.hasPermission('news:delete')
      isBatchDeleting.value = true
      try {
        const confirmed = await showConfirmDanger(
          `确定删除选中的 ${ids.length} 条新闻吗？此操作不可恢复。任一项无法删除时整批不会删除。`,
          '批量删除新闻', '删除所选新闻',
        )
        if (!confirmed || !ownsOperation() ||
            !ids.every(id => newsSelection.selectedIds.value.includes(id))) return
        const response = await newsApi.batchDeleteNews(ids)
        if (!ownsOperation()) return
        if (response.code !== 200) throw new Error(response.message || '批量删除失败')
        newsSelection.clear()
        notify.success(`已删除 ${response.data.deletedCount} 条新闻`)
        await loadNews(true)
      } catch (error) {
        if (ownsOperation()) notify.error(error instanceof Error ? error.message : '批量删除失败，请重试')
      } finally {
        isBatchDeleting.value = false
      }
    }

    // 重置筛选
    const resetFilters = () => {
      searchQuery.value = ''
      canteenFilter.value = ''
      startDate.value = ''
      endDate.value = ''
      pagination.page = 1 // 重置分页到第一页
      saveState() // 保存状态
      loadNews() // 重新加载新闻列表以应用重置后的筛选条件
    }

    const loadCanteens = async () => {
      if (!ownsView()) return
      const version = viewVersion
      if (isCanteenScoped.value) {
        canteenList.value = authStore.user?.canteens || []
        return
      }
      try {
        const response = await canteenApi.getCanteenOptions()
        if (!ownsView(version)) return
        if (response.code === 200 && response.data) {
          if (response.data.items) {
            canteenList.value = response.data.items
          } else if (Array.isArray(response.data)) {
            canteenList.value = response.data
          }
        }
      } catch (error) {
        if (!ownsView(version)) return
        console.error('加载食堂列表失败:', error)
      }
    }

    // 重置表单
    const resetForm = () => {
      editorVersion.value += 1
      destroyEditor()
      activeSubmission = null
      isSubmitting.value = false
      pendingImageUploads.value = 0
      preserveImportedContent.value = false
      newsForm.title = ''
      newsForm.content = ''
      newsForm.summary = ''
      newsForm.canteenId = (authStore.user?.canteenIds.length === 1 ? authStore.user.canteenIds[0] : '')
      newsForm.publishedAt = ''
      newsForm.status = 'draft'
      editingNewsId.value = null
      valueHtml.value = ''
      Object.keys(errors).forEach((key) => { errors[key] = '' })
    }

    // 打开创建模态框
    const openCreateModal = () => {
      if (!ownsView()) return
      if (!authStore.hasPermission('news:create')) {
        notify.error('您没有权限创建新闻')
        return
      }
      resetForm()
      showEditModal.value = false
      showCreateModal.value = true
    }

    // 关闭模态框
    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      resetForm()
    }

    // 编辑新闻
    const editNews = (news) => {
      if (!ownsView()) return
      if (!authStore.hasPermission('news:edit')) {
        notify.error('您没有权限编辑新闻')
        return
      }
      resetForm()
      editingNewsId.value = news.id
      preserveImportedContent.value = Boolean(news.sourceUrl)
      newsForm.title = news.title || ''
      newsForm.content = news.sourceUrl ? news.content || '' : sanitizeRichHtml(news.content || '')
      newsForm.summary = news.summary || ''
      newsForm.canteenId = news.canteenId || ''
      newsForm.status = news.status || 'draft'

      valueHtml.value = sanitizeRichHtml(newsForm.content, Boolean(news.sourceUrl))

      if (news.publishedAt) {
        const date = new Date(news.publishedAt)
        // 格式化为 datetime-local 所需格式 YYYY-MM-DDThh:mm
        const pad = (n) => String(n).padStart(2, '0')
        const year = date.getFullYear()
        const month = pad(date.getMonth() + 1)
        const day = pad(date.getDate())
        const hours = pad(date.getHours())
        const minutes = pad(date.getMinutes())
        newsForm.publishedAt = `${year}-${month}-${day}T${hours}:${minutes}`
      } else {
        newsForm.publishedAt = ''
      }

      showCreateModal.value = false
      showEditModal.value = true
    }

    // 提交表单
    const submitForm = async (targetStatus) => {
      if (!ownsView() || (!editorRef.value && !preserveImportedContent.value) || isSubmitting.value) return
      if (pendingImageUploads.value > 0) {
        notify.info('图片正在上传，请稍后保存')
        return
      }
      // 清除之前的错误
      errors.title = ''
      errors.summary = ''
      errors.content = ''

      // 表单验证
      let hasError = false

      if (!newsForm.title || !newsForm.title.trim()) {
        errors.title = '请输入标题'
        hasError = true
      }

      if (!newsForm.summary || !newsForm.summary.trim()) {
        errors.summary = '请输入摘要'
        hasError = true
      }

      if (!valueHtml.value || !valueHtml.value.trim()) {
        errors.content = '请输入内容'
        hasError = true
      }

      if (hasError) {
        return
      }

      const operation = {
        version: editorVersion.value,
        editor: editorRef.value,
        id: showEditModal.value ? editingNewsId.value : null,
      }
      if (!ownsEditor(operation.version)) return
      const requestData = {
        title: newsForm.title,
        content: preserveImportedContent.value ? newsForm.content : sanitizeRichHtml(valueHtml.value),
        summary: newsForm.summary,
        canteenId: newsForm.canteenId || null,
      }
      activeSubmission = operation
      isSubmitting.value = true
      operation.editor?.disable()

      try {
        const response = operation.id
          ? await newsApi.updateNews(operation.id, requestData)
          : await newsApi.createNews(requestData)
        if (!ownsEditor(operation.version)) return
        if (response.code !== 200 && response.code !== 201) {
          throw new Error(response.message || '保存失败')
        }

        let publicationError = ''
        let message = operation.id ? '新闻更新成功！' : '新闻草稿创建成功！'
        if (targetStatus === 'published') {
          try {
            const published = await newsApi.publishNews(operation.id || response.data.id)
            if (!ownsEditor(operation.version)) return
            if (published.code !== 200 && published.code !== 201) {
              throw new Error(published.message || '发布失败')
            }
            message = operation.id ? '新闻更新并发布成功！' : '新闻创建并发布成功！'
          } catch (publishError) {
            if (!ownsEditor(operation.version)) return
            console.error('发布失败:', publishError)
            publicationError = '新闻已保存，发布失败，请在列表中重试发布'
          }
        }

        if (publicationError) notify.error(publicationError)
        else notify.success(message)
        if (!operation.id && targetStatus === 'draft') {
          currentStatus.value = 'draft'
          pagination.page = 1
          saveState()
        }
        closeModal()
        loadNews()
      } catch (error) {
        if (!ownsEditor(operation.version)) return
        console.error('提交失败:', error)
        notify.error(error instanceof Error ? error.message : '操作失败，请重试')
      } finally {
        if (activeSubmission === operation) {
          activeSubmission = null
          isSubmitting.value = false
          operation.editor?.enable()
        }
      }
    }

    // 发布新闻
    const publishNews = async (id) => {
      const version = viewVersion
      if (!ownsView(version)) return
      if (!authStore.hasPermission('news:publish')) {
        notify.error('您没有权限发布新闻')
        return
      }
      const confirmed = await showConfirm('确定要发布这条新闻吗？')
      if (!confirmed || !ownsView(version)) return
      try {
        const response = await newsApi.publishNews(id)
        if (!ownsView(version)) return
        if (response.code === 200) {
          notify.success('发布成功')
          loadNews()
        } else {
          throw new Error(response.message || '发布失败')
        }
      } catch (error) {
        if (!ownsView(version)) return
        console.error('发布失败:', error)
        notify.error(error instanceof Error ? error.message : '发布失败，请重试')
      }
    }

    // 撤回新闻
    const revokeNews = async (id) => {
      const version = viewVersion
      if (!ownsView(version)) return
      if (!authStore.hasPermission('news:revoke')) {
        notify.error('您没有权限撤回新闻')
        return
      }
      const confirmed = await showConfirm('确定要撤回这条新闻吗？撤回后将变为草稿状态。')
      if (!confirmed || !ownsView(version)) return
      try {
        const response = await newsApi.revokeNews(id)
        if (!ownsView(version)) return
        if (response.code === 200) {
          notify.success('撤回成功，已移至草稿箱')
          loadNews()
        } else {
          throw new Error(response.message || '撤回失败')
        }
      } catch (error) {
        if (!ownsView(version)) return
        console.error('撤回失败:', error)
        notify.error(error instanceof Error ? error.message : '撤回失败，请重试')
      }
    }

    const deleteNews = async (newsId) => {
      if (isBatchDeleting.value) return
      const version = viewVersion
      if (!ownsView(version)) return
      if (!authStore.hasPermission('news:delete')) {
        notify.error('您没有权限删除新闻')
        return
      }
      const confirmed = await showConfirm('确定要删除这条新闻吗？')
      if (!confirmed || !ownsView(version)) return
      try {
        const response = await newsApi.deleteNews(newsId)
        if (!ownsView(version)) return
        if (response.code === 200 || response.code === 201) {
          notify.success('新闻删除成功！')
          loadNews()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        if (!ownsView(version)) return
        console.error('删除失败:', error)
        notify.error(error instanceof Error ? error.message : '删除失败，请重试')
      }
    }

    // 预览新闻
    const previewNews = (news) => {
      previewNewsData.value = { ...news }
      showPreviewModal.value = true
    }

    // 关闭预览模态框
    const closePreviewModal = () => {
      showPreviewModal.value = false
      previewNewsData.value = {}
    }

    // 格式化预览时间
    const formatPreviewTime = (time) => {
      if (!time) return ''
      const date = new Date(time)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    }

    const formattedPreviewContent = computed(() =>
      sanitizeRichHtml(previewNewsData.value.content || '', Boolean(previewNewsData.value.sourceUrl)),
    )

    const handlePageChange = (page) => {
      pagination.page = page
      saveState() // 保存状态
      loadNews()
    }

    const retireView = () => {
      isViewActive = false
      viewVersion += 1
      newsRequestId += 1
      isLoading.value = false
      newsSelection.clear()
      closeModal()
      closePreviewModal()
    }

    watch(authSessionVersion, () => {
      retireView()
      newsList.value = []
      sourcesConfigured.value = false
      werssAdminUrl.value = null
      activeSection.value = 'content'
      pagination.total = 0
      pagination.totalPages = 0
    }, { flush: 'sync' })
    onBeforeUnmount(retireView)
    onDeactivated(retireView)

    onMounted(() => {
      // 状态已在setup()中恢复，这里只需加载数据
      loadCanteens()
      loadNews()
      loadSourceCapabilities()
    })

    onActivated(() => {
      const wasInactive = !isViewActive
      isViewActive = true
      if (wasInactive) loadSourceCapabilities()
      // 组件重新激活时仅重新加载数据，避免重复恢复状态覆盖用户修改
      loadCanteens()
      loadNews()
    })

    return {
      activeSection,
      sourcesConfigured,
      werssAdminUrl,
      changeNewsSection,
      loadNews,
      preserveImportedContent,
      sanitizeRichHtml,
      newsList,
      filteredNewsList,
      showCreateModal,
      showEditModal,
      showPreviewModal,
      previewNewsData,
      newsForm,
      errors,
      canteenList,
      pagination,
      currentAdmin,
      currentStatus,
      isLoading,
      isSubmitting,
      pendingImageUploads,
      searchQuery,
      canteenFilter,
      startDate,
      endDate,
      changeStatus,
      publishNews,
      revokeNews,
      resetFilters,
      // 导出编辑器相关变量
      editorRef,
      editorAuxiliaryPanels,
      handleEditorKeydown,
      editorVersion,
      valueHtml,
      editorConfig,
      handleCreated,
      // 导出其他方法
      formatDate,
      getSummary,
      getCanteenName,
      closeModal,
      openCreateModal,
      editNews,
      submitForm,
      deleteNews,
      handlePageChange,
      // 预览相关
      previewNews,
      closePreviewModal,
      formatPreviewTime,
      formattedPreviewContent,
      authStore,
      isCanteenScoped,
      canDeleteNews,
      newsSelection: reactive(newsSelection),
      isBatchDeleting,
      handleBatchDelete,
    }
  },
}
</script>

<style scoped>
.news-workspace-navigation { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
.news-service-link { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 0; color: #667085; font-size: 13px; white-space: nowrap; text-decoration: none; }
.news-service-link svg { width: 14px; height: 14px; }
.news-service-link:hover { color: #660874; text-decoration: underline; text-underline-offset: 4px; }
.news-service-link:focus-visible { outline: 2px solid #660874; outline-offset: 4px; border-radius: 4px; }
.news-status-button:focus-visible { outline: 2px solid #660874; outline-offset: 4px; border-radius: 4px; }
.news-content-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 24px; }
.news-status-filter { display: flex; align-items: center; gap: 4px; padding: 4px; background: #f3f4f6; border-radius: 8px; }
.news-status-button { min-height: 34px; padding: 6px 16px; border: 1px solid transparent; border-radius: 6px; color: #4b5563; font-size: 13px; line-height: 20px; font-weight: 500; }
.news-status-button:hover { color: #660874; }
.news-status-button.is-selected { color: #660874; background: white; border-color: #e5e7eb; }
@media (max-width: 600px) { .news-workspace-navigation { gap: 12px; } .news-content-toolbar { gap: 12px; } .news-status-button { padding-inline: 12px; } }

/* Keep article text and row actions readable inside the horizontally scrolling table. */
.news-table { table-layout: fixed; min-width: 984px; }
.news-col-selection { width: 48px; }
.news-col-summary { width: 216px; }
.news-col-canteen { width: 88px; }
.news-col-time { width: 128px; }
.news-col-actions { width: 328px; }
.news-title-cell { overflow-wrap: anywhere; }

.news-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: max-content;
  margin-inline: auto;
}

.news-row-action {
  min-width: 60px;
  border-width: 1px;
}

.news-row-action.admin-button-secondary {
  border-color: #e5e7eb;
}

.news-row-action-publish {
  color: #660874;
  background: #f5edf7;
  border-color: #e7d6eb;
}

.news-row-action-publish:not(:disabled):hover {
  background: #ecdfef;
  border-color: #cba7d2;
}

.news-row-action:not(:disabled):active {
  background: #f3f4f6;
}

.news-row-action-publish:not(:disabled):active {
  background: #e7d6eb;
}

.news-row-danger-action {
  display: inline-flex;
  margin-left: 4px;
  padding-left: 10px;
  border-left: 1px solid #e5e7eb;
}

.news-row-action-delete {
  color: #b91c1c;
  background: transparent;
  border-color: transparent;
}

.news-row-action-delete:not(:disabled):hover,
.news-row-action-delete:not(:disabled):active {
  background: #fef2f2;
}

.news-row-action:focus-visible,
.news-create-button:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}

@media (pointer: coarse) {
  .news-row-action { min-height: 44px; }
}

/* 新闻预览内容样式，与小程序保持一致 */
.news-preview-content {
  word-wrap: break-word;
  word-break: break-word;
}

.news-preview-content :deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 10px auto;
}

.news-preview-content :deep(table) {
  max-width: 100% !important;
  box-sizing: border-box;
}

.news-preview-content :deep(pre) {
  max-width: 100% !important;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.news-preview-content :deep(p) {
  margin: 0.5em 0;
}

.news-preview-content :deep(h1),
.news-preview-content :deep(h2),
.news-preview-content :deep(h3),
.news-preview-content :deep(h4),
.news-preview-content :deep(h5),
.news-preview-content :deep(h6) {
  margin: 0.8em 0 0.5em 0;
  font-weight: bold;
}

.news-preview-content :deep(ul),
.news-preview-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 2em;
}

.news-preview-content :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 1em;
  border-left: 3px solid #ddd;
  color: #666;
}

.news-preview-content :deep(a) {
  color: #007aff;
  text-decoration: underline;
}
</style>
