<template>
  <div class="admin-page admin-moderation">
    <div class="admin-panel">
      <Header
        title="社区内容管理"
        description="查看社区帖子与回复，处理待审核内容及违规内容。"
        header-icon="carbon:chat"
      />
      <div class="moderation-body">
        <p v-if="!canView" class="admin-state" role="status">
          社区内容仅限拥有查看权限的全局管理员管理。
        </p>
        <template v-else>
          <div class="admin-toolbar moderation-toolbar">
            <label class="admin-label"
              >内容类型
              <select class="admin-input"
                v-model="contentType"
                aria-label="内容类型"
                :disabled="loading || submitting"
                @change="loadList(1)"
              >
                <option value="posts">帖子</option>
                <option value="post-comments">帖子回复</option>
              </select>
            </label>
            <label class="admin-label"
              >审核状态
              <select class="admin-input"
                v-model="status"
                aria-label="审核状态"
                :disabled="loading || submitting"
                @change="loadList(1)"
              >
                <option value="">全部状态</option>
                <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </label>
            <button
              class="admin-button admin-button-secondary"
              :disabled="loading || submitting"
              @click="loadList(currentPage)"
            >
              刷新列表
            </button>
          </div>
          <p class="moderation-help">
            待审核或已拒绝的内容不公开。帖子回复仅在所属帖子公开时展示；“已通过”表示该条内容已通过审核。
          </p>
          <p v-if="notice" role="status" class="moderation-help">{{ notice }}</p>

          <section
            v-if="selected"
            class="moderation-detail admin-focus-target"
            aria-labelledby="community-detail-title"
            tabindex="-1"
            ref="detailPanel"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 id="community-detail-title" class="text-lg font-semibold">{{ typeLabel }}原文</h3>
              <button class="admin-button admin-button-secondary" :disabled="submitting" @click="selected = null">
                关闭详情
              </button>
            </div>
            <dl class="moderation-metadata">
              <div>
                <dt>作者</dt>
                <dd>{{ selected.userNickname }}（{{ selected.userId }}）</dd>
              </div>
              <div>
                <dt>审核状态</dt>
                <dd>{{ statusLabels[selected.status] }}</dd>
              </div>
              <div>
                <dt>发布时间</dt>
                <dd>{{ formatDate(selected.createdAt) }}</dd>
              </div>
              <div>
                <dt>最后编辑时间</dt>
                <dd>{{ formatDate(selected.updatedAt) }}</dd>
              </div>
              <div v-if="selected.postId">
                <dt>所属帖子 ID</dt>
                <dd>{{ selected.postId }}</dd>
              </div>
              <div v-if="selected.parentCommentId">
                <dt>被回复的回复 ID</dt>
                <dd>{{ selected.parentCommentId }}</dd>
              </div>
            </dl>
            <p class="moderation-content">{{ selected.content }}</p>
            <div v-if="selected.images?.length" class="moderation-images">
              <AdminImage
                v-for="(url, index) in selected.images"
                :key="url"
                :src="url"
                :alt="`帖子图片 ${index + 1}`"
                variant="preview"
                previewable="link"
                loading="lazy"
                image-class="w-28 h-28 rounded-lg object-cover"
              />
            </div>
            <p v-if="selected.rejectReason" class="moderation-help">
              拒绝原因：{{ selected.rejectReason }}
            </p>
            <label class="admin-label" v-if="selected.status === 'pending' && canApprove"
              >拒绝原因（拒绝时必填）
              <textarea class="admin-textarea"
                v-model="rejectReason"
                aria-label="拒绝原因"
                rows="3"
                maxlength="500"
                :disabled="submitting"
                placeholder="说明未通过审核的原因"
              />
            </label>
            <p v-if="actionError" role="alert" class="admin-error admin-field-error">{{ actionError }}</p>
            <div class="admin-actions">
              <button
                v-if="needsRefresh"
                class="admin-button admin-button-secondary"
                :disabled="submitting"
                @click="loadList(currentPage)"
              >
                重新读取内容
              </button>
              <template v-else>
                <template v-if="selected.status === 'pending' && canApprove">
                  <button
                    class="admin-button admin-button-primary"
                    :disabled="submitting"
                    @click="moderate('approve')"
                  >
                    通过审核
                  </button>
                  <button
                    class="admin-button admin-button-danger"
                    :disabled="submitting"
                    @click="moderate('reject')"
                  >
                    拒绝内容
                  </button>
                </template>
                <button
                  v-if="canDelete"
                  class="admin-button admin-button-danger"
                  :disabled="submitting"
                  @click="moderate('delete')"
                >
                  删除{{ typeLabel }}
                </button>
              </template>
              <span v-if="submitting" role="status" class="moderation-help self-center"
                >正在处理…</span
              >
            </div>
          </section>

          <div :aria-busy="loading">
            <p v-if="loading" class="admin-state" role="status">正在读取{{ typeLabel }}…</p>
            <div v-else-if="loadError" class="admin-state admin-state-error" role="alert">
              <p class="admin-error">{{ loadError }}</p>
              <button class="mt-3 admin-button admin-button-secondary" @click="loadList(currentPage)">重试</button>
            </div>
            <p v-else-if="items.length === 0" class="admin-state">
              当前筛选条件下暂无{{ typeLabel }}，可切换状态或内容类型。
            </p>
            <div v-else class="admin-table-scroll">
              <table class="admin-table admin-table-top">
                <caption class="sr-only">
                  社区{{
                    typeLabel
                  }}列表
                </caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col">作者</th>
                    <th scope="col">内容</th>
                    <th scope="col">审核状态</th>
                    <th scope="col">最后编辑时间</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="item in items" :key="item.id">
                    <td>{{ item.userNickname }}</td>
                    <td class="max-w-sm">
                      <p class="line-clamp-2 break-words">{{ item.content }}</p>
                      <p v-if="item.images?.length" class="mt-1 text-gray-500">
                        {{ item.images.length }} 张图片
                      </p>
                    </td>
                    <td>
                      <span class="moderation-status">{{ statusLabels[item.status] }}</span>
                    </td>
                    <td>
                      <time :datetime="item.updatedAt">{{ formatDate(item.updatedAt) }}</time>
                    </td>
                    <td>
                      <button
                        class="admin-button admin-button-compact admin-button-secondary"
                        :disabled="submitting"
                        @click="selectItem(item)"
                      >
                        查看原文
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <fieldset v-if="!loading && !loadError && total > 0" :disabled="submitting">
              <Pagination
                :current-page="currentPage"
                :page-size="pageSize"
                :total="total"
                @page-change="loadList"
              />
            </fieldset>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Header from '@/components/Layout/Header.vue'
import AdminImage from '@/components/Common/AdminImage.vue'
import Pagination from '@/components/Common/Pagination.vue'
import { communityApi } from '@/api/modules/community'
import { showConfirm, showConfirmDanger } from '@/composables/useModal'
import { hasGlobalPermission } from '@/router/access'
import { useAuthStore } from '@/store/modules/use-auth-store'
import type { CommunityContent, CommunityContentType, CommunityStatus } from '@/types/community'

const authStore = useAuthStore()
const canView = computed(() => hasGlobalPermission(authStore, 'post:view'))
const canApprove = computed(() => canView.value && authStore.hasPermission('post:approve'))
const canDelete = computed(() => canView.value && authStore.hasPermission('post:delete'))
const contentType = ref<CommunityContentType>('posts')
const typeLabel = computed(() => (contentType.value === 'posts' ? '帖子' : '回复'))
const status = ref<CommunityStatus | ''>('pending')
const statusLabels: Record<CommunityStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}
const items = ref<CommunityContent[]>([])
const currentPage = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const notice = ref('')
const selected = ref<CommunityContent | null>(null)
const detailPanel = ref<HTMLElement | null>(null)
const rejectReason = ref('')
const actionError = ref('')
const needsRefresh = ref(false)
let requestController: AbortController | undefined
let active = true
const formatDate = (date: string) => new Date(date).toLocaleString('zh-CN')

async function loadList(page = 1) {
  if (loading.value || submitting.value || !canView.value || !active) return
  loading.value = true
  loadError.value = ''
  selected.value = null
  currentPage.value = page
  const controller = new AbortController()
  requestController = controller
  try {
    const query = () => ({ page, pageSize, ...(status.value ? { status: status.value } : {}) })
    let response = await communityApi.list(contentType.value, query(), controller.signal)
    if (response.code !== 200) throw new Error(response.message || '社区内容读取失败')
    if (page > 1 && page > response.data.meta.totalPages) {
      page = Math.max(1, response.data.meta.totalPages)
      response = await communityApi.list(contentType.value, query(), controller.signal)
      if (response.code !== 200) throw new Error(response.message || '社区内容读取失败')
    }
    if (controller.signal.aborted || !canView.value) return
    items.value = response.data.items
    total.value = response.data.meta.total
    currentPage.value = page
  } catch (error) {
    if (!controller.signal.aborted)
      loadError.value = error instanceof Error ? error.message : '社区内容读取失败，请重试'
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

async function selectItem(item: CommunityContent) {
  selected.value = item
  rejectReason.value = ''
  actionError.value = ''
  needsRefresh.value = false
  notice.value = ''
  await nextTick()
  detailPanel.value?.focus()
}

async function moderate(action: 'approve' | 'reject' | 'delete') {
  const item = selected.value
  const type = contentType.value
  if (!item || submitting.value || needsRefresh.value || !canView.value) return
  if (action === 'delete' ? !canDelete.value : !canApprove.value || item.status !== 'pending')
    return
  const reason = rejectReason.value.trim()
  actionError.value = ''
  if (action === 'reject' && !reason) {
    actionError.value = '请填写拒绝原因'
    return
  }
  submitting.value = true
  try {
    const confirm = action === 'approve' ? showConfirm : showConfirmDanger
    const title =
      action === 'approve'
        ? '通过审核'
        : action === 'reject'
          ? '拒绝内容'
          : `删除${typeLabel.value}`
    const message =
      action === 'delete'
        ? `确认删除此${typeLabel.value}？删除后内容将不再展示${type === 'posts' ? '，帖子下的回复也将不可见' : ''}。`
        : action === 'approve'
          ? `确认通过 ${item.userNickname} 发布的此条内容？`
          : `确认拒绝此条内容？拒绝原因：${reason}`
    if (!(await confirm(message, title, title))) return
    if (!active || !canView.value || (action === 'delete' ? !canDelete.value : !canApprove.value))
      return
    const version = { expectedUpdatedAt: item.updatedAt }
    const response =
      action === 'approve'
        ? await communityApi.approve(type, item.id, version)
        : action === 'reject'
          ? await communityApi.reject(type, item.id, { ...version, reason })
          : await communityApi.delete(type, item.id)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    if (!active || !canView.value) return
    notice.value = `${title}成功。`
    selected.value = null
  } catch (error) {
    if (!active || !canView.value) return
    actionError.value = `${error instanceof Error ? error.message : '操作失败'}。请重新读取内容后处理。`
    needsRefresh.value = true
  } finally {
    submitting.value = false
  }
  if (!selected.value) await loadList(currentPage.value)
}

watch(
  canView,
  (allowed) => {
    if (allowed) void loadList()
    else {
      requestController?.abort()
      loading.value = false
      items.value = []
      selected.value = null
      total.value = 0
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  active = false
  requestController?.abort()
})
</script>

<style src="@/assets/admin-moderation.css"></style>
