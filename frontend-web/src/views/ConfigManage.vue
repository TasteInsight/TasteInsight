<template>
  <div class="admin-page">
    <div class="admin-panel config-panel">
      <Header title="系统配置管理" :description="configDescription" header-icon="carbon:settings" />
      <nav class="admin-tabs" aria-label="系统配置分区">
        <button
          type="button"
          class="admin-tab"
          :aria-pressed="activeView === 'settings'"
          v-if="canViewConfig"
          @click="showModerationView('settings')"
        >
          审核设置
        </button>
        <button
          v-if="canManageGlobalModeration"
          type="button"
          class="admin-tab"
          :aria-pressed="activeView === 'tasks'"
          @click="showModerationView('tasks')"
        >
          审核待办
        </button>
        <button
          type="button"
          class="admin-tab"
          :aria-pressed="activeView === 'maintenance'"
          @click="showModerationView('maintenance')"
        >
          系统维护
        </button>
      </nav>
      <div v-if="canViewConfig" v-show="activeView === 'settings'">
        <ContentModerationSettings
          ref="moderationSettings"
          v-if="canManageGlobalModeration"
          :can-edit="authStore.hasPermission('config:edit')"
          @enabled="unifiedModerationEnabled = $event"
          @busy="moderationSaving = $event"
          @state="moderationPolicyState = $event"
          @dirty="moderationDirty = $event"
        />
        <details
          :open="!unifiedModerationEnabled || moderationPolicyError || loadError"
          class="settings-section settings-rules"
        >
          <summary class="settings-rule-summary">
            <span class="text-lg font-semibold text-gray-800">{{
              unifiedModerationEnabled ? '人工备用规则' : '人工审核规则'
            }}</span>
          </summary>
          <p
            v-if="moderationPolicyState === 'loading'"
            class="mt-2 text-sm leading-6 text-gray-600"
            role="status"
          >
            正在读取统一审核状态，人工审核规则暂时锁定。
          </p>
          <p
            v-else-if="moderationPolicyError"
            role="alert"
            class="mt-2 text-sm leading-6 text-red-700"
          >
            统一审核状态读取失败，请刷新页面重试。人工审核设置暂时锁定。
          </p>
          <p
            v-else-if="unifiedModerationEnabled"
            class="mt-2 text-sm leading-6 text-gray-600"
            role="status"
          >
            统一内容审核已启用，以下规则保留为备用，关闭统一审核后生效。
          </p>
          <p v-else class="mt-2 text-sm leading-6 text-gray-600">
            按内容类型设置人工审核。已提交的待审内容需单独处理。
          </p>
          <div class="settings-scope-row mt-5">
            <label for="config-scope" class="admin-label">规则适用范围</label>
            <select
              id="config-scope"
              v-model="configCanteenId"
              class="w-full sm:max-w-xs admin-input"
              :disabled="
                loading || reviewSaving || commentSaving || communitySaving || moderationSaving
              "
              @change="loadConfig"
            >
              <option v-if="isGlobalAdmin" value="">全局默认配置</option>
              <option v-for="canteen in configCanteens" :key="canteen.id" :value="canteen.id">
                {{ canteen.name }}
              </option>
            </select>
          </div>
          <p v-if="currentCanteenInfo" class="mt-2 text-sm leading-6 text-gray-600">
            {{ currentCanteenInfo }}
          </p>
          <div v-if="loading" class="py-8 text-sm text-gray-600" role="status">
            加载人工审核规则…
          </div>
          <div v-else class="mt-4 divide-y divide-gray-200">
            <!-- 评价审核配置 -->
            <div class="settings-rule">
              <div class="settings-rule-copy">
                <div class="flex-1">
                  <h3 class="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <AppIcon
                      class="iconify text-tsinghua-purple"
                      icon="carbon:star-review"
                    ></AppIcon>
                    评价人工审核
                  </h3>
                  <p class="text-sm text-gray-600">新提交或修改的评价，经人工审核后公开。</p>
                </div>
              </div>

              <div class="settings-rule-controls flex flex-wrap items-center gap-3">
                <label
                  class="relative inline-flex items-center cursor-pointer has-[:disabled]:cursor-not-allowed"
                >
                  <input
                    type="checkbox"
                    v-model="reviewRequiresApproval"
                    aria-label="评价人工审核"
                    :disabled="
                      !authStore.hasPermission('config:edit') ||
                      unifiedModerationEnabled ||
                      moderationPolicyState !== 'ready' ||
                      reviewSaving ||
                      loadError
                    "
                    @change="handleReviewAutoApproveChange"
                    class="sr-only peer"
                  />
                  <div :class="toggleSwitchClass"></div>
                  <span class="ml-3 text-sm font-medium text-gray-700">
                    {{ approvalStatus(reviewRequiresApproval) }}
                  </span>
                </label>

                <div v-if="reviewSaving" class="flex items-center gap-2 text-sm text-gray-500">
                  <AppIcon class="iconify animate-spin" icon="carbon:circle-dash"></AppIcon>
                  <span>保存中...</span>
                </div>
              </div>

              <div
                v-if="!authStore.hasPermission('config:edit')"
                class="settings-rule-permission text-sm text-gray-600"
              >
                <AppIcon class="iconify" icon="carbon:information"></AppIcon>
                您没有编辑配置的权限
              </div>
            </div>

            <!-- 回复审核配置 -->
            <div class="settings-rule">
              <div class="settings-rule-copy">
                <div class="flex-1">
                  <h3 class="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <AppIcon class="iconify text-tsinghua-purple" icon="carbon:chat"></AppIcon>
                    回复人工审核
                  </h3>
                  <p class="text-sm text-gray-600">新提交的评价回复，经人工审核后公开。</p>
                </div>
              </div>

              <div class="settings-rule-controls flex flex-wrap items-center gap-3">
                <label
                  class="relative inline-flex items-center cursor-pointer has-[:disabled]:cursor-not-allowed"
                >
                  <input
                    type="checkbox"
                    v-model="commentRequiresApproval"
                    aria-label="回复人工审核"
                    :disabled="
                      !authStore.hasPermission('config:edit') ||
                      unifiedModerationEnabled ||
                      moderationPolicyState !== 'ready' ||
                      commentSaving ||
                      loadError
                    "
                    @change="handleCommentAutoApproveChange"
                    class="sr-only peer"
                  />
                  <div :class="toggleSwitchClass"></div>
                  <span class="ml-3 text-sm font-medium text-gray-700">
                    {{ approvalStatus(commentRequiresApproval) }}
                  </span>
                </label>

                <div v-if="commentSaving" class="flex items-center gap-2 text-sm text-gray-500">
                  <AppIcon class="iconify animate-spin" icon="carbon:circle-dash"></AppIcon>
                  <span>保存中...</span>
                </div>
              </div>

              <div
                v-if="!authStore.hasPermission('config:edit')"
                class="settings-rule-permission text-sm text-gray-600"
              >
                <AppIcon class="iconify" icon="carbon:information"></AppIcon>
                您没有编辑配置的权限
              </div>
            </div>

            <template v-if="isGlobalAdmin && !currentCanteenId">
              <div v-for="item in communityConfigs" :key="item.key" class="settings-rule">
                <div class="settings-rule-copy">
                  <h3 class="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <AppIcon class="text-tsinghua-purple" :icon="item.icon" />{{ item.label }}
                  </h3>
                  <p class="text-sm leading-6 text-gray-600">{{ item.description }}</p>
                </div>
                <div class="settings-rule-controls flex flex-wrap items-center gap-3">
                  <label
                    class="relative inline-flex items-center cursor-pointer has-[:disabled]:cursor-not-allowed"
                  >
                    <input
                      v-model="item.requiresApproval"
                      type="checkbox"
                      :aria-label="item.label"
                      :disabled="
                        !authStore.hasPermission('config:edit') ||
                        unifiedModerationEnabled ||
                        moderationPolicyState !== 'ready' ||
                        communitySaving ||
                        loadError
                      "
                      class="sr-only peer"
                      @change="handleCommunityApprovalChange(item)"
                    />
                    <span :class="toggleSwitchClass"></span>
                    <span class="ml-3 text-sm font-medium text-gray-700">{{
                      approvalStatus(item.requiresApproval)
                    }}</span>
                  </label>
                  <span v-if="item.saving" class="text-sm text-gray-600" role="status"
                    >保存中…</span
                  >
                  <span v-else-if="item.saved" class="admin-field-success" role="status"
                    >保存成功</span
                  >
                </div>
                <p
                  v-if="!authStore.hasPermission('config:edit')"
                  class="settings-rule-permission text-sm text-gray-600"
                >
                  您没有编辑配置的权限
                </p>
              </div>
            </template>
            <p v-if="loadError" class="pt-4 text-sm text-red-700 admin-field-error" role="alert">
              配置加载失败，请刷新页面重试
            </p>
          </div>
        </details>
      </div>
      <ContentModerationTasks
        v-if="canManageGlobalModeration && tasksVisited"
        v-show="activeView === 'tasks'"
        :can-edit="authStore.hasPermission('config:edit')"
      />
      <section
        v-show="activeView === 'maintenance'"
        class="settings-section settings-maintenance"
        aria-labelledby="maintenance-title"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h3
              id="maintenance-title"
              class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2"
            >
              <AppIcon class="iconify text-tsinghua-purple" icon="carbon:ai-results"></AppIcon>
              菜品嵌入向量刷新
            </h3>
            <p class="text-sm text-gray-600">
              更新所选食堂的菜品推荐数据，批量任务可能需要较长时间。
            </p>
          </div>
        </div>

        <div class="mt-4 space-y-4">
          <!-- 维护目标独立于人工审核规则范围。 -->
          <div class="mb-4 max-w-sm">
            <label for="embedding-canteen" class="mb-2 admin-label"> 选择要刷新的食堂 </label>
            <select
              id="embedding-canteen"
              v-model="selectedCanteenId"
              class="w-full admin-input"
              :disabled="embeddingRefreshing || loadingCanteens"
            >
              <option value="" disabled>请选择食堂</option>
              <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                {{ canteen.name }}
              </option>
            </select>
            <p v-if="loadingCanteens" class="mt-1 text-xs text-gray-500">加载食堂列表中...</p>
          </div>

          <!-- 批量刷新按钮 -->
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              :key="'refresh-btn-' + embeddingRefreshing"
              :disabled="
                !authStore.hasPermission('dish:edit') || embeddingRefreshing || !selectedCanteenId
              "
              @click="handleRefreshCanteenEmbeddings"
              class="transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-primary"
            >
              <AppIcon
                v-if="embeddingRefreshing"
                key="icon-loading"
                class="iconify mr-1 animate-spin"
                icon="carbon:circle-dash"
              ></AppIcon>
              <AppIcon
                v-else
                key="icon-refresh"
                class="iconify mr-1"
                icon="carbon:refresh"
              ></AppIcon>
              {{ embeddingRefreshing ? '刷新中…' : '刷新推荐数据' }}
            </button>

            <div
              v-if="embeddingRefreshSuccess"
              class="flex items-center gap-2 text-sm text-green-600"
            >
              <AppIcon class="iconify" icon="carbon:checkmark-filled"></AppIcon>
              <span>刷新任务已提交</span>
            </div>
          </div>

          <!-- 任务状态显示 -->
          <div v-if="currentJobId" class="mt-6 border-t border-gray-200 pt-5">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700">任务状态</span>
                <span
                  v-if="jobStatus"
                  class="px-2 py-1 rounded text-xs font-medium"
                  :class="getJobStatusClass(jobStatus.status)"
                >
                  {{ getJobStatusText(jobStatus.status) }}
                </span>
              </div>
              <div
                v-if="
                  jobStatus &&
                  (jobStatus.status === 'pending' ||
                    jobStatus.status === 'waiting' ||
                    jobStatus.status === 'processing' ||
                    jobStatus.status === 'active')
                "
                class="flex items-center gap-2"
              >
                <button
                  type="button"
                  @click="handleCancelJob"
                  :disabled="cancelling"
                  class="text-red-500 hover:text-red-700 disabled:opacity-50 admin-button"
                  :title="
                    jobStatus.status === 'processing' || jobStatus.status === 'active'
                      ? '任务将在下一个检查点停止'
                      : ''
                  "
                >
                  {{ cancelling ? '取消中...' : '取消任务' }}
                </button>
              </div>
            </div>

            <!-- 进度条 -->
            <div v-if="jobStatus && (jobStatus.progress || jobStatus.returnValue)" class="mt-3">
              <!-- 如果 progress 是对象，包含 total, processed 等信息 -->
              <div v-if="typeof jobStatus.progress === 'object' && jobStatus.progress">
                <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span
                    >进度: {{ jobStatus.progress.processed || 0 }} /
                    {{ jobStatus.progress.total || 0 }}</span
                  >
                  <span
                    >{{
                      jobStatus.progress.total > 0
                        ? Math.round(
                            (jobStatus.progress.processed / jobStatus.progress.total) * 100,
                          )
                        : 0
                    }}%</span
                  >
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-tsinghua-purple h-2 rounded-full transition-all duration-300"
                    :style="{
                      width: `${jobStatus.progress.total > 0 ? (jobStatus.progress.processed / jobStatus.progress.total) * 100 : 0}%`,
                    }"
                  ></div>
                </div>
                <div v-if="jobStatus.progress.failed > 0" class="mt-2 text-xs text-red-600">
                  失败: {{ jobStatus.progress.failed }} 个
                </div>
              </div>
              <!-- 如果 progress 是数字 -->
              <div v-else-if="typeof jobStatus.progress === 'number'">
                <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>进度: {{ jobStatus.progress }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-tsinghua-purple h-2 rounded-full transition-all duration-300"
                    :style="{ width: `${jobStatus.progress}%` }"
                  ></div>
                </div>
              </div>
              <!-- 如果有 returnValue，显示完成信息 -->
              <div v-if="jobStatus.returnValue && typeof jobStatus.returnValue === 'object'">
                <div class="text-xs text-gray-600 mt-2">
                  <div v-if="jobStatus.returnValue.count !== undefined">
                    已处理: {{ jobStatus.returnValue.count }} 个菜品
                  </div>
                </div>
              </div>
            </div>

            <!-- 消息提示 -->
            <div v-if="jobStatus?.message" class="mt-2 text-xs text-gray-600">
              {{ jobStatus.message }}
            </div>
          </div>

          <div v-if="!authStore.hasPermission('dish:edit')" class="mt-2 text-xs text-gray-500">
            <AppIcon class="iconify" icon="carbon:information"></AppIcon>
            您没有刷新嵌入向量的权限
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { configApi } from '@/api/modules/config'
import { contentModerationApi } from '@/api/modules/content-moderation'
import { dishApi } from '@/api/modules/dish'
import { canteenApi } from '@/api/modules/canteen'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import ContentModerationSettings from '@/components/ContentModerationSettings.vue'
import ContentModerationTasks from '@/components/ContentModerationTasks.vue'
import { showConfirm } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'

export default {
  name: 'ConfigManage',
  components: {
    Header,
    ContentModerationSettings,
    ContentModerationTasks,
  },
  async beforeRouteLeave() {
    if (!this.moderationDirty) return true
    const leave = await showConfirm(
      '审核设置有未保存的修改，离开后将丢弃这些修改。',
      '离开审核设置',
      '丢弃并离开',
      '继续编辑',
    )
    if (leave) this.$refs.moderationSettings?.resetDraft()
    return leave
  },
  setup() {
    const notify = useNotification()
    const authStore = useAuthStore()
    const loading = ref(true)
    const unifiedModerationEnabled = ref(false)
    const moderationSaving = ref(false)
    const moderationPolicyState = ref('loading')
    const moderationPolicyError = computed(() => moderationPolicyState.value === 'error')
    const moderationDirty = ref(false)
    const canViewConfig = computed(() => authStore.hasPermission('config:view'))
    const activeView = ref(canViewConfig.value ? 'settings' : 'maintenance')
    const tasksVisited = ref(false)
    const showModerationView = (view) => {
      activeView.value = view
      if (view === 'tasks') tasksVisited.value = true
    }
    const reviewSaving = ref(false)
    const commentSaving = ref(false)
    const reviewAutoApprove = ref(true)
    const commentAutoApprove = ref(true)
    const communityConfigs = ref([
      {
        key: 'post.autoApprove',
        icon: 'carbon:chat',
        label: '社区帖子人工审核',
        description: '新提交或修改的社区帖子，经人工审核后公开。',
        requiresApproval: false,
        saving: false,
        saved: false,
      },
      {
        key: 'postComment.autoApprove',
        icon: 'carbon:reply',
        label: '帖子回复人工审核',
        description: '新提交的帖子回复，经人工审核后公开。',
        requiresApproval: false,
        saving: false,
        saved: false,
      },
    ])
    const communitySaving = computed(() => communityConfigs.value.some((item) => item.saving))
    const reviewRequiresApproval = computed({
      get: () => !reviewAutoApprove.value,
      set: (required) => {
        reviewAutoApprove.value = !required
      },
    })
    const commentRequiresApproval = computed({
      get: () => !commentAutoApprove.value,
      set: (required) => {
        commentAutoApprove.value = !required
      },
    })
    const configItems = ref([])
    const loadError = ref(false)

    // 菜品嵌入刷新相关状态
    const embeddingRefreshing = ref(false)
    const embeddingRefreshSuccess = ref(false)
    const currentJobId = ref(null)
    const jobStatus = ref(null)
    const pollingIntervalRef = ref(null)
    const isPollingActive = ref(false) // 标记轮询是否活跃，用于防止异步请求在停止后继续更新状态
    const cancelling = ref(false) // 正在取消任务

    // 食堂列表（用于全局管理员选择）
    const canteenList = ref([])
    const loadingCanteens = ref(false)
    const selectedCanteenId = ref(
      authStore.user?.scope === 'GLOBAL' ? '' : authStore.user?.canteenIds[0] || '',
    )

    const isGlobalAdmin = computed(() => authStore.user?.scope === 'GLOBAL')
    const canManageGlobalModeration = computed(
      () => isGlobalAdmin.value && authStore.hasPermission('config:view'),
    )
    const approvalStatus = (required) => {
      if (loadError.value || moderationPolicyError.value) return '暂不可读取'
      if (moderationPolicyState.value === 'loading') return '正在读取审核状态'
      if (unifiedModerationEnabled.value) return required ? '备用 · 人工审核' : '备用 · 直接发布'
      return required ? '已开启 · 人工审核' : '已关闭 · 直接发布'
    }
    const configCanteenId = ref(isGlobalAdmin.value ? '' : authStore.user?.canteenIds[0] || '')
    const configCanteens = computed(() =>
      isGlobalAdmin.value ? canteenList.value : authStore.user?.canteens || [],
    )
    const currentCanteenId = computed(() => configCanteenId.value || null)
    const currentCanteenName = computed(
      () =>
        configCanteens.value.find((canteen) => canteen.id === configCanteenId.value)?.name || null,
    )

    // Toggle switch 的类名（避免引号冲突）
    const toggleSwitchClass = computed(() => {
      return "w-11 h-6 bg-gray-200 admin-switch-track rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-tsinghua-purple peer-disabled:opacity-50"
    })

    const configDescription = computed(() =>
      isGlobalAdmin.value ? '管理审核策略、内容待办与系统维护' : '管理授权食堂的审核规则与系统维护',
    )

    const currentCanteenInfo = computed(() => {
      if (!isGlobalAdmin.value && !currentCanteenId.value)
        return '暂无授权食堂，请联系上级管理员调整范围'
      if (!currentCanteenId.value) return '食堂单独配置优先于全局默认配置。'
      return `当前规则适用于${currentCanteenName.value || currentCanteenId.value}。`
    })

    let viewActive = false
    let configRequest = 0

    // 加载当前范围的配置，仅接收最新请求的结果。
    const loadConfig = async () => {
      if (!viewActive) return
      const request = ++configRequest
      const canteenId = currentCanteenId.value
      loading.value = true
      if (!isGlobalAdmin.value) moderationPolicyState.value = 'loading'
      try {
        if (!isGlobalAdmin.value && !canteenId) throw new Error('暂无授权食堂')
        const configPromise = canteenId
          ? configApi.getEffectiveConfig(canteenId)
          : configApi.getGlobalConfig()
        const policyPromise = isGlobalAdmin.value
          ? Promise.resolve(null)
          : contentModerationApi.getPolicy().catch(() => null)
        const [response, policyResponse] = await Promise.all([configPromise, policyPromise])

        if (request !== configRequest) return
        if (!isGlobalAdmin.value) {
          moderationPolicyState.value =
            policyResponse?.code === 200 && policyResponse.data ? 'ready' : 'error'
          unifiedModerationEnabled.value = moderationPolicyError.value
            ? false
            : policyResponse.data.enabled
        }

        if (response.code === 200 && response.data) {
          const reviewAutoApproveKey = 'review.autoApprove'
          const commentAutoApproveKey = 'comment.autoApprove'

          if (canteenId) {
            // 食堂配置：从有效配置列表中查找
            const effectiveConfigData = response.data
            const effectiveItems = effectiveConfigData.items || []

            const reviewAutoApproveItem = effectiveItems.find(
              (item) => item.key === reviewAutoApproveKey,
            )
            const commentAutoApproveItem = effectiveItems.find(
              (item) => item.key === commentAutoApproveKey,
            )

            if (reviewAutoApproveItem) {
              reviewAutoApprove.value = reviewAutoApproveItem.value === 'true'
            } else {
              reviewAutoApprove.value = true
            }

            if (commentAutoApproveItem) {
              commentAutoApprove.value = commentAutoApproveItem.value === 'true'
            } else {
              commentAutoApprove.value = true
            }

            // 保存有效配置项用于显示
            configItems.value = effectiveItems
          } else {
            // 全局配置
            const globalConfigData = response.data
            const config = globalConfigData.config
            const templates = globalConfigData.templates
            communityConfigs.value.forEach((item) => {
              const value =
                config?.items?.find((configItem) => configItem.key === item.key)?.value ??
                templates?.find((template) => template.key === item.key)?.defaultValue ??
                'true'
              item.requiresApproval = value !== 'true'
            })

            const reviewAutoApproveItem = config?.items?.find(
              (item) => item.key === reviewAutoApproveKey,
            )
            const commentAutoApproveItem = config?.items?.find(
              (item) => item.key === commentAutoApproveKey,
            )

            if (reviewAutoApproveItem) {
              reviewAutoApprove.value = reviewAutoApproveItem.value === 'true'
            } else {
              // 如果配置项不存在，查找模板中的默认值
              const template = templates?.find((t) => t.key === reviewAutoApproveKey)
              if (template) {
                reviewAutoApprove.value = template.defaultValue === 'true'
              }
            }

            if (commentAutoApproveItem) {
              commentAutoApprove.value = commentAutoApproveItem.value === 'true'
            } else {
              // 如果配置项不存在，查找模板中的默认值
              const template = templates?.find((t) => t.key === commentAutoApproveKey)
              if (template) {
                commentAutoApprove.value = template.defaultValue === 'true'
              }
            }

            // 保存所有配置项用于显示
            configItems.value = config?.items || []
          }
          loadError.value = false
        } else {
          throw new Error(response.message || '获取配置失败')
        }
      } catch (error) {
        if (request !== configRequest) return
        console.error('加载配置失败:', error)
        loadError.value = true
        notify.error('加载配置失败，请刷新重试')
      } finally {
        if (request === configRequest) loading.value = false
      }
    }

    const handleCommunityApprovalChange = async (item) => {
      if (
        !isGlobalAdmin.value ||
        currentCanteenId.value ||
        !authStore.hasPermission('config:edit') ||
        moderationPolicyState.value !== 'ready' ||
        unifiedModerationEnabled.value ||
        loadError.value ||
        communitySaving.value
      ) {
        item.requiresApproval = !item.requiresApproval
        return
      }
      item.saving = true
      item.saved = false
      try {
        const response = await configApi.updateGlobalConfig({
          key: item.key,
          value: item.requiresApproval ? 'false' : 'true',
        })
        if (response.code !== 200) throw new Error(response.message || '保存配置失败')
        item.saved = true
        notify.success('审核规则已保存')
      } catch (error) {
        notify.error(error instanceof Error ? error.message : '保存配置失败，请重试')
        await loadConfig()
      } finally {
        item.saving = false
      }
    }

    // 处理评价自动审核配置变更
    const handleReviewAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        notify.error('您没有编辑配置的权限')
        reviewAutoApprove.value = !reviewAutoApprove.value // 恢复原值
        return
      }

      if (
        moderationPolicyState.value !== 'ready' ||
        unifiedModerationEnabled.value ||
        loadError.value ||
        reviewSaving.value
      ) {
        reviewAutoApprove.value = !reviewAutoApprove.value
        return
      }

      reviewSaving.value = true

      try {
        let response
        if (currentCanteenId.value) {
          // 有食堂ID，更新食堂配置
          response = await configApi.updateCanteenConfig(currentCanteenId.value, {
            key: 'review.autoApprove',
            value: reviewAutoApprove.value ? 'true' : 'false',
          })
        } else {
          // 没有食堂ID，更新全局配置
          response = await configApi.updateGlobalConfig({
            key: 'review.autoApprove',
            value: reviewAutoApprove.value ? 'true' : 'false',
          })
        }

        if (response.code === 200) {
          notify.success('审核规则已保存')
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        notify.error(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        reviewSaving.value = false
      }
    }

    // 处理评论自动审核配置变更
    const handleCommentAutoApproveChange = async () => {
      if (!authStore.hasPermission('config:edit')) {
        notify.error('您没有编辑配置的权限')
        commentAutoApprove.value = !commentAutoApprove.value // 恢复原值
        return
      }

      if (
        moderationPolicyState.value !== 'ready' ||
        unifiedModerationEnabled.value ||
        loadError.value ||
        commentSaving.value
      ) {
        commentAutoApprove.value = !commentAutoApprove.value
        return
      }

      commentSaving.value = true

      try {
        let response
        if (currentCanteenId.value) {
          // 有食堂ID，更新食堂配置
          response = await configApi.updateCanteenConfig(currentCanteenId.value, {
            key: 'comment.autoApprove',
            value: commentAutoApprove.value ? 'true' : 'false',
          })
        } else {
          // 没有食堂ID，更新全局配置
          response = await configApi.updateGlobalConfig({
            key: 'comment.autoApprove',
            value: commentAutoApprove.value ? 'true' : 'false',
          })
        }

        if (response.code === 200) {
          notify.success('审核规则已保存')
        } else {
          throw new Error(response.message || '保存配置失败')
        }
      } catch (error) {
        console.error('保存配置失败:', error)
        notify.error(error instanceof Error ? error.message : '保存配置失败，请重试')
        // 恢复原值
        await loadConfig()
      } finally {
        commentSaving.value = false
      }
    }

    // 加载食堂列表（仅全局管理员需要）
    const loadCanteenList = async () => {
      if (!isGlobalAdmin.value) {
        canteenList.value = authStore.user?.canteens || []
        return
      }

      loadingCanteens.value = true
      try {
        const response = await canteenApi.getCanteenOptions()
        if (response.code === 200 && response.data) {
          canteenList.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      } finally {
        loadingCanteens.value = false
      }
    }

    // 处理按食堂批量刷新菜品嵌入向量
    const handleRefreshCanteenEmbeddings = async () => {
      if (!authStore.hasPermission('dish:edit')) {
        notify.error('您没有刷新嵌入向量的权限')
        return
      }

      // 确定要刷新的食堂ID
      const canteenIdToRefresh = selectedCanteenId.value

      if (!canteenIdToRefresh) {
        notify.info('请选择要刷新的食堂')
        return
      }

      embeddingRefreshing.value = true
      embeddingRefreshSuccess.value = false
      currentJobId.value = null
      jobStatus.value = null

      try {
        const response = await dishApi.refreshDishesEmbeddingByCanteen(canteenIdToRefresh)

        console.log('刷新任务响应:', response)

        if (response && response.code === 200 && response.data) {
          embeddingRefreshSuccess.value = true
          const jobId = response.data.jobId

          console.log('获取到的jobId:', jobId)

          if (jobId) {
            // 有jobId，异步模式，开始轮询
            currentJobId.value = jobId
            console.log('开始轮询任务状态，jobId:', jobId)
            startPolling(jobId)
          } else {
            // 没有jobId，同步模式，直接完成
            console.log('同步模式，任务已完成')
            currentJobId.value = null
            embeddingRefreshing.value = false
            notify.success('刷新任务已提交（同步模式）')
            // 3秒后隐藏成功提示
            setTimeout(() => {
              embeddingRefreshSuccess.value = false
            }, 3000)
          }
        } else {
          throw new Error(response?.message || '提交刷新任务失败')
        }
      } catch (error) {
        console.error('刷新嵌入向量失败:', error)
        embeddingRefreshing.value = false
        currentJobId.value = null
        notify.error(error instanceof Error ? error.message : '刷新嵌入向量失败，请重试')
      }
    }

    // 开始轮询任务状态（使用递归 setTimeout 避免请求重叠）
    const startPolling = (jobId) => {
      // 清除之前的轮询
      if (pollingIntervalRef.value) {
        clearTimeout(pollingIntervalRef.value)
        pollingIntervalRef.value = null
      }

      // 标记轮询为活跃状态
      isPollingActive.value = true

      // 定义递归轮询函数
      const poll = async () => {
        // 如果轮询已停止，不再继续
        if (!isPollingActive.value) return

        await checkJobStatus(jobId)

        // 检查轮询状态，如果仍然活跃，安排下一次轮询
        if (isPollingActive.value) {
          pollingIntervalRef.value = setTimeout(poll, 2000)
        }
      }

      // 立即开始第一次轮询
      poll()
    }

    // 停止轮询（内部使用）
    const stopPolling = () => {
      // 标记轮询为非活跃状态，阻止正在进行的异步请求更新状态
      isPollingActive.value = false

      if (pollingIntervalRef.value) {
        clearTimeout(pollingIntervalRef.value)
        pollingIntervalRef.value = null
      }
      // 重置成功提示状态
      embeddingRefreshSuccess.value = false
      // 重置刷新中状态
      embeddingRefreshing.value = false
      // 清除任务ID和状态，让任务状态区域消失
      currentJobId.value = null
      jobStatus.value = null
    }

    // 直接获取并更新任务状态（不受轮询标志影响）
    const fetchAndUpdateJobStatus = async (jobId) => {
      if (!jobId) return
      try {
        const response = await dishApi.getEmbeddingJobStatus(jobId)
        if (response && response.code === 200 && response.data) {
          const statusData = response.data
          const taskStatus = statusData.state || statusData.status
          let mappedStatus = taskStatus
          if (taskStatus === 'waiting') {
            mappedStatus = 'pending'
          } else if (taskStatus === 'active') {
            mappedStatus = 'processing'
          }
          jobStatus.value = {
            ...statusData,
            status: mappedStatus,
            state: taskStatus,
          }
        }
      } catch (error) {
        console.error('获取任务状态失败:', error)
      }
    }

    // 取消任务
    const handleCancelJob = async () => {
      if (!currentJobId.value) return

      cancelling.value = true
      try {
        const response = await dishApi.cancelEmbeddingJob(currentJobId.value)
        if (response.code === 200 && response.data?.success) {
          notify.success('任务已取消')
          stopPolling()
        } else {
          // 检查是否是因为任务已完成或已失败
          const message = response.message || ''
          if (message.includes('已完成') || message.includes('已失败')) {
            notify.error(message.includes('已完成') ? '任务已完成，无需取消' : '任务已失败')
            // 停止轮询定时器，但保留进度显示
            if (pollingIntervalRef.value) {
              clearTimeout(pollingIntervalRef.value)
              pollingIntervalRef.value = null
            }
            isPollingActive.value = false
            embeddingRefreshing.value = false
            embeddingRefreshSuccess.value = false
            // 获取并显示最新完成状态
            await fetchAndUpdateJobStatus(currentJobId.value)
          } else {
            notify.error(message || '取消任务失败')
          }
        }
      } catch (error) {
        console.error('取消任务失败:', error)
        notify.error('取消任务失败，请重试')
      } finally {
        cancelling.value = false
      }
    }

    // 检查任务状态
    const checkJobStatus = async (jobId) => {
      if (!jobId) {
        console.warn('jobId为空，停止轮询')
        stopPolling()
        return
      }

      // 如果轮询已被停止，不再处理响应
      if (!isPollingActive.value) {
        return
      }

      try {
        const response = await dishApi.getEmbeddingJobStatus(jobId)

        // 再次检查轮询状态，因为在等待响应期间可能已被停止
        if (!isPollingActive.value) {
          return
        }

        console.log('任务状态响应:', response)

        // 确保正确获取响应数据
        let statusData = null
        if (response && response.code === 200) {
          // 标准响应格式：{ code: 200, data: {...} }
          statusData = response.data
        } else if (response && response.status) {
          // 如果响应直接包含status字段，说明data就是状态数据
          statusData = response
        }

        if (statusData) {
          // 更新任务状态
          // 后端返回的是 state 字段，不是 status
          // 为了兼容，我们统一使用 status
          const taskStatus = statusData.state || statusData.status
          const normalizedStatus = {
            ...statusData,
            status: taskStatus, // 统一使用 status 字段
            // 映射 BullMQ 的状态到我们的状态
            state: taskStatus,
          }

          // 将 BullMQ 的状态映射到我们的状态格式
          // BullMQ 状态: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
          let mappedStatus = taskStatus
          if (taskStatus === 'waiting') {
            mappedStatus = 'pending'
          } else if (taskStatus === 'active') {
            mappedStatus = 'processing'
          }

          normalizedStatus.status = mappedStatus
          jobStatus.value = normalizedStatus

          console.log('任务状态更新:', normalizedStatus, '原始状态:', taskStatus)

          // 如果任务完成或失败，停止轮询并重置UI状态
          if (mappedStatus === 'completed' || mappedStatus === 'failed') {
            // 先停止轮询，清除定时器
            isPollingActive.value = false
            if (pollingIntervalRef.value) {
              clearTimeout(pollingIntervalRef.value)
              pollingIntervalRef.value = null
            }
            // 重置UI状态
            embeddingRefreshing.value = false
            embeddingRefreshSuccess.value = false

            if (mappedStatus === 'completed') {
              notify.success('嵌入向量刷新完成')
            } else {
              notify.error(
                `嵌入向量刷新失败: ${normalizedStatus.failedReason || normalizedStatus.message || '未知错误'}`,
              )
            }
            return
          }

          // 如果状态是pending或processing，继续轮询
          if (mappedStatus === 'pending' || mappedStatus === 'processing') {
            // 继续轮询，不做任何操作
            return
          }
        } else if (response && response.code === 404) {
          // 任务不存在，停止轮询
          console.warn('任务不存在:', jobId)
          stopPolling()
          jobStatus.value = null
          notify.error('任务不存在或已过期')
        } else {
          // 其他错误情况
          console.warn('获取任务状态异常:', response)
        }
      } catch (error) {
        console.error('获取任务状态失败:', error)
        // 如果轮询已被手动停止，不再处理错误
        if (!isPollingActive.value) {
          return
        }
        // 如果连续失败，停止轮询
        stopPolling()
        notify.error('获取任务状态失败，请刷新页面查看')
      }
    }

    // 获取任务状态文本
    const getJobStatusText = (status) => {
      const statusMap = {
        pending: '等待中',
        waiting: '等待中', // BullMQ 状态
        processing: '处理中',
        active: '处理中', // BullMQ 状态
        completed: '已完成',
        failed: '失败',
      }
      return statusMap[status] || status
    }

    // 获取任务状态样式类
    const getJobStatusClass = (status) => {
      const classMap = {
        pending: 'bg-yellow-100 text-yellow-700',
        waiting: 'bg-yellow-100 text-yellow-700', // BullMQ 状态
        processing: 'bg-blue-100 text-blue-700',
        active: 'bg-blue-100 text-blue-700', // BullMQ 状态
        completed: 'bg-green-100 text-green-700',
        failed: 'bg-red-100 text-red-700',
      }
      return classMap[status] || 'bg-gray-100 text-gray-700'
    }

    const activateView = () => {
      if (viewActive) return
      viewActive = true
      if (canViewConfig.value) loadConfig()
      else loading.value = false
      loadCanteenList()
    }

    const deactivateView = () => {
      viewActive = false
      configRequest += 1
    }

    onMounted(activateView)
    onActivated(activateView)
    onDeactivated(deactivateView)
    onBeforeUnmount(() => {
      deactivateView()
      stopPolling()
    })

    return {
      canViewConfig,
      isGlobalAdmin,
      canManageGlobalModeration,
      activeView,
      tasksVisited,
      showModerationView,
      moderationDirty,
      moderationPolicyState,
      approvalStatus,
      configCanteenId,
      configCanteens,
      loadConfig,
      loading,
      loadError,
      reviewSaving,
      commentSaving,
      reviewAutoApprove,
      commentAutoApprove,
      reviewRequiresApproval,
      commentRequiresApproval,
      communityConfigs,
      communitySaving,
      handleCommunityApprovalChange,
      configItems,
      handleReviewAutoApproveChange,
      handleCommentAutoApproveChange,
      authStore,
      configDescription,
      unifiedModerationEnabled,
      moderationSaving,
      moderationPolicyError,
      currentCanteenInfo,
      toggleSwitchClass,
      // 菜品嵌入刷新相关
      embeddingRefreshing,
      embeddingRefreshSuccess,
      currentJobId,
      jobStatus,
      handleRefreshCanteenEmbeddings,
      getJobStatusText,
      getJobStatusClass,
      handleCancelJob,
      cancelling,
      // 食堂选择相关
      canteenList,
      loadingCanteens,
      selectedCanteenId,
      currentCanteenId,
    }
  },
}
</script>

<style scoped>
.config-panel :deep(.settings-section) {
  min-width: 0;
  padding-block: 28px;
}
.config-panel :deep(.settings-section + .settings-rules) {
  border-top: 1px solid #e5e7eb;
}
.config-panel :deep(.settings-section-heading) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 44rem;
}
.config-panel :deep(.settings-policy-form) {
  max-width: 44rem;
}
.settings-rule-summary {
  display: list-item;
  cursor: pointer;
}
.settings-rule-summary::marker {
  color: #660874;
}
.settings-scope-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.settings-rule {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding-block: 20px;
}
.settings-rule-copy {
  min-width: 0;
}
.settings-rule-copy p {
  max-width: 52ch;
  line-height: 1.7;
}
.settings-rule-permission {
  grid-column: 1 / -1;
}
.settings-maintenance {
  max-width: 44rem;
}
.config-panel :deep(.settings-task-copy) {
  max-width: 72ch;
  overflow-wrap: anywhere;
}
@media (max-width: 640px) {
  .config-panel :deep(.settings-section) {
    padding-block: 24px;
  }
  .settings-scope-row {
    display: grid;
    gap: 8px;
  }
  .settings-rule {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
