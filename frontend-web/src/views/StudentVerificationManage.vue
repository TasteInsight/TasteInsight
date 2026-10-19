<template>
  <div class="admin-page admin-moderation">
    <div class="admin-panel">
      <Header
        title="学生身份审核"
        description="核验校园身份申请，管理学生贡献权限的有效期与撤销。"
        header-icon="carbon:user-certification"
      />
      <div class="moderation-body">
        <p v-if="!canReview" class="admin-state" role="status">
          学生认证仅限拥有审核权限的全局管理员处理。
        </p>
        <template v-else>
          <div class="admin-toolbar moderation-toolbar">
            <label class="admin-label"
              >认证状态
              <select class="admin-input"
                v-model="status"
                aria-label="认证状态"
                :disabled="loading || submitting"
                @change="loadList(1)"
              >
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
            校园邮箱验证只确认邮箱归属。审核通过前须核验在校学生身份，并设置不超过 366 天的有效期。
          </p>
          <p v-if="notice" role="status" class="moderation-help">{{ notice }}</p>

          <section
            v-if="selected"
            ref="detailPanel"
            class="moderation-detail admin-focus-target"
            aria-labelledby="student-detail-title"
            tabindex="-1"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 id="student-detail-title" class="text-lg font-semibold">
                {{ selected.user.nickname }} · 认证详情
              </h3>
              <button class="admin-button admin-button-secondary" :disabled="submitting" @click="selected = null">
                关闭详情
              </button>
            </div>
            <dl class="moderation-metadata">
              <div>
                <dt>用户 ID</dt>
                <dd>{{ selected.userId }}</dd>
              </div>
              <div>
                <dt>学校</dt>
                <dd>{{ schoolLabel(selected.schoolCode) }}</dd>
              </div>
              <div>
                <dt>认证方式</dt>
                <dd>{{ methodLabel(selected.method) }}</dd>
              </div>
              <div>
                <dt>校园邮箱</dt>
                <dd>{{ selected.email || '未提供' }}</dd>
              </div>
              <div>
                <dt>邮箱验证时间</dt>
                <dd>{{ formatDate(selected.emailVerifiedAt) }}</dd>
              </div>
              <div>
                <dt>申请更新时间</dt>
                <dd>{{ formatDate(selected.updatedAt) }}</dd>
              </div>
              <div>
                <dt>认证状态</dt>
                <dd>{{ statusLabels[selected.status] }}</dd>
              </div>
              <div>
                <dt>有效期至</dt>
                <dd>{{ formatDate(selected.expiresAt) }}</dd>
              </div>
              <div>
                <dt>最近审核时间</dt>
                <dd>{{ formatDate(selected.reviewedAt) }}</dd>
              </div>
              <div>
                <dt>审核依据</dt>
                <dd>{{ selected.reason || '尚未审核' }}</dd>
              </div>
            </dl>
            <form
              v-if="selected.status === 'PENDING' || selected.status === 'VERIFIED'"
              @submit.prevent="submitDecision"
            >
              <fieldset :disabled="submitting" class="space-y-4">
                <label class="admin-label"
                  >处理结果
                  <select class="admin-input" v-model="decision" aria-label="处理结果">
                    <template v-if="selected.status === 'PENDING'">
                      <option value="APPROVE">通过认证</option>
                      <option value="REJECT">拒绝申请</option>
                    </template>
                    <option v-else value="REVOKE">撤销认证</option>
                  </select>
                </label>
                <label class="admin-label" v-if="decision === 'APPROVE'"
                  >有效期至
                  <input class="admin-input" v-model="expiresAt" aria-label="有效期至" type="datetime-local" required />
                  <span class="moderation-help">须晚于当前时间，且不超过 366 天。</span>
                </label>
                <label class="admin-label"
                  >审核依据
                  <textarea class="admin-textarea"
                    v-model="reason"
                    aria-label="审核依据"
                    rows="3"
                    maxlength="500"
                    required
                    placeholder="填写核验依据或处理原因"
                  />
                </label>
                <p v-if="decisionError" role="alert" class="admin-error">
                  {{ decisionError }}
                </p>
                <div class="admin-actions">
                  <button
                    v-if="needsRefresh"
                    type="button"
                    class="admin-button admin-button-secondary"
                    @click="loadList(currentPage)"
                  >
                    重新读取申请
                  </button>
                  <button
                    v-else
                    class="admin-button"
                    :class="decision === 'APPROVE' ? 'admin-button-primary' : 'admin-button-danger'"
                    type="submit"
                  >
                    {{ submitting ? '正在处理…' : decisionLabels[decision] }}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>

          <div :aria-busy="loading">
            <p v-if="loading" class="admin-state" role="status">正在读取认证申请…</p>
            <div v-else-if="loadError" class="admin-state admin-state-error" role="alert">
              <p class="admin-error">{{ loadError }}</p>
              <button class="mt-3 admin-button admin-button-secondary" @click="loadList(currentPage)">重试</button>
            </div>
            <p v-else-if="items.length === 0" class="admin-state">
              暂无{{ statusLabels[status] }}的认证申请，可切换状态查看其他记录。
            </p>
            <div v-else class="admin-table-scroll">
              <table class="admin-table admin-table-top">
                <caption class="sr-only">
                  学生认证申请列表
                </caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col">申请人</th>
                    <th scope="col">校园邮箱</th>
                    <th scope="col">认证状态</th>
                    <th scope="col">更新时间</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="item in items" :key="item.id">
                    <td>
                      {{ item.user.nickname }}
                      <div class="text-gray-500 mt-1">{{ schoolLabel(item.schoolCode) }}</div>
                    </td>
                    <td class="break-all">{{ item.email || '未提供' }}</td>
                    <td>
                      <span class="moderation-status">{{ statusLabels[item.status] }}</span>
                      <p v-if="isExpired(item)" class="mt-2 text-gray-500">有效期已结束</p>
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
                        {{ item.status === 'PENDING' ? '核验申请' : '查看详情' }}
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
import Pagination from '@/components/Common/Pagination.vue'
import { studentVerificationApi } from '@/api/modules/student-verification'
import { showConfirm, showConfirmDanger } from '@/composables/useModal'
import { hasGlobalPermission } from '@/router/access'
import { useAuthStore } from '@/store/modules/use-auth-store'
import type {
  StudentDecision,
  StudentVerification,
  StudentVerificationStatus,
} from '@/types/student-verification'

const authStore = useAuthStore()
const canReview = computed(() => hasGlobalPermission(authStore, 'student:review'))
const statusLabels: Record<StudentVerificationStatus, string> = {
  PENDING: '待审核',
  VERIFIED: '已认证',
  REJECTED: '已拒绝',
  REVOKED: '已撤销',
}
const decisionLabels: Record<StudentDecision['decision'], string> = {
  APPROVE: '通过认证',
  REJECT: '拒绝申请',
  REVOKE: '撤销认证',
}
const status = ref<StudentVerificationStatus>('PENDING')
const items = ref<StudentVerification[]>([])
const currentPage = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const notice = ref('')
const selected = ref<StudentVerification | null>(null)
const decision = ref<StudentDecision['decision']>('APPROVE')
const reason = ref('')
const expiresAt = ref('')
const detailPanel = ref<HTMLElement | null>(null)
const decisionError = ref('')
const needsRefresh = ref(false)
let requestController: AbortController | undefined
let active = true

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleString('zh-CN') : '未设置'
const schoolLabel = (school: string) => (school === 'tsinghua' ? '清华大学' : school)
const methodLabel = (method: string) =>
  method === 'MANUAL_REVIEW'
    ? '校园邮箱 · 人工核验'
    : method === 'SCHOOL_ASSERTION'
      ? '校园 OAuth'
      : method
const isExpired = (item: StudentVerification) =>
  item.status === 'VERIFIED' && !!item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()

async function loadList(page = 1) {
  if (loading.value || submitting.value || !canReview.value || !active) return
  loading.value = true
  loadError.value = ''
  selected.value = null
  currentPage.value = page
  const controller = new AbortController()
  requestController = controller
  try {
    let response = await studentVerificationApi.list(
      { page, pageSize, status: status.value },
      controller.signal,
    )
    if (response.code !== 200) throw new Error(response.message || '认证申请读取失败')
    if (page > 1 && page > response.data.meta.totalPages) {
      page = Math.max(1, response.data.meta.totalPages)
      response = await studentVerificationApi.list(
        { page, pageSize, status: status.value },
        controller.signal,
      )
      if (response.code !== 200) throw new Error(response.message || '认证申请读取失败')
    }
    if (controller.signal.aborted || !canReview.value) return
    items.value = response.data.items
    total.value = response.data.meta.total
    currentPage.value = page
  } catch (error) {
    if (!controller.signal.aborted)
      loadError.value = error instanceof Error ? error.message : '认证申请读取失败，请重试'
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

async function selectItem(item: StudentVerification) {
  selected.value = item
  decision.value = item.status === 'VERIFIED' ? 'REVOKE' : 'APPROVE'
  reason.value = ''
  expiresAt.value = ''
  decisionError.value = ''
  needsRefresh.value = false
  notice.value = ''
  await nextTick()
  detailPanel.value?.focus()
}

async function submitDecision() {
  const item = selected.value
  if (!item || submitting.value || needsRefresh.value || !canReview.value) return
  const trimmedReason = reason.value.trim()
  decisionError.value = ''
  if (!trimmedReason) {
    decisionError.value = '请填写审核依据'
    return
  }
  const payload: StudentDecision = {
    decision: decision.value,
    reason: trimmedReason,
    expectedUpdatedAt: item.updatedAt,
  }
  if (decision.value === 'APPROVE') {
    const expiry = new Date(expiresAt.value).getTime()
    const now = Date.now()
    if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 366 * 86400000) {
      decisionError.value = '请选择不超过 366 天的未来有效期'
      return
    }
    payload.expiresAt = new Date(expiry).toISOString()
  }
  submitting.value = true
  try {
    const confirm = payload.decision === 'APPROVE' ? showConfirm : showConfirmDanger
    const message =
      payload.decision === 'APPROVE'
        ? `确认通过 ${item.user.nickname} 的学生认证？有效期至 ${formatDate(payload.expiresAt!)}。`
        : payload.decision === 'REVOKE'
          ? `确认撤销 ${item.user.nickname} 的学生认证？其学生贡献权限将失效。`
          : `确认拒绝 ${item.user.nickname} 的认证申请？`
    if (
      !(await confirm(message, decisionLabels[payload.decision], decisionLabels[payload.decision]))
    )
      return
    if (!active || !canReview.value) return
    const response = await studentVerificationApi.decide(item.userId, payload)
    if (response.code !== 200) throw new Error(response.message || '审核保存失败')
    if (!active || !canReview.value) return
    notice.value = '审核已保存。'
    selected.value = null
  } catch (error) {
    if (!active || !canReview.value) return
    decisionError.value = `${error instanceof Error ? error.message : '审核保存失败'}。请重新读取申请后核验。`
    needsRefresh.value = true
  } finally {
    submitting.value = false
  }
  if (!selected.value) await loadList(currentPage.value)
}

watch(
  canReview,
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
