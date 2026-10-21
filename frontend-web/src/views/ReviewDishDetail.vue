<template>
  <div class="admin-page">
    <div class="admin-panel">
      <div class="admin-heading-row">
        <Header title="菜品审核详情" description="查看提交资料，处理菜品审核" header-icon="carbon:task-approved" />
        <button type="button" class="border hover:bg-gray-50 admin-button" @click="goBack">返回列表</button>
      </div>

      <div v-if="isLoading" role="status" class="space-y-4 py-6 text-gray-600" aria-live="polite">
        <p>正在加载提交资料…</p>
        <div class="h-8 bg-gray-100 rounded w-1/2"></div>
        <div class="h-24 bg-gray-100 rounded"></div>
      </div>
      <div v-else-if="loadError" role="alert" class="admin-state admin-state-error">
        <p class="text-red-700 mb-4">{{ loadError }}</p>
        <button type="button" class="border hover:bg-gray-50 admin-button" @click="loadDishData">重试</button>
      </div>

      <div v-else-if="dishData" class="space-y-6">
        <div v-if="notice" role="status" class="p-4 bg-purple-50 rounded-lg text-sm text-tsinghua-purple">{{ notice }}</div>
        <div v-if="actionError" role="alert" class="p-4 bg-red-50 rounded-lg text-sm text-red-700">{{ actionError }}</div>
        <div class="flex flex-wrap justify-between items-start gap-4">
          <div class="min-w-0">
            <h3 class="text-xl font-semibold break-words">{{ dishData.name }}</h3>
            <p class="text-gray-600 mt-1">{{ contributionLocation(dishData) || '未填写位置' }}</p>
            <p class="text-lg font-medium mt-2">{{ formatContributionPrice(dishData.price, dishData.priceUnit) }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-gray-700">{{ contributionKind }}</span>
            <span class="px-2 py-1 rounded-full text-xs font-medium" :class="statusClasses[dishData.status]">{{ statusText[dishData.status] }}</span>
          </div>
        </div>

        <dl class="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-600">
          <div><dt class="inline">提交人：</dt><dd class="inline text-gray-800">{{ dishData.uploaderName || '未知' }}</dd></div>
          <div><dt class="inline">提交时间：</dt><dd class="inline text-gray-800">{{ formatDate(dishData.createdAt) }}</dd></div>
          <div v-if="dishData.parentDishName"><dt class="inline">所属菜品：</dt><dd class="inline text-gray-800">{{ dishData.parentDishName }}</dd></div>
        </dl>
        <p v-if="dishData.rejectReason" class="p-4 bg-red-50 rounded-lg text-sm text-red-700">拒绝原因：{{ dishData.rejectReason }}</p>
        <button v-if="dishData.approvedDishId" type="button" class="text-tsinghua-purple hover:underline admin-button" @click="router.push(`/view-dish/${dishData.approvedDishId}`)">查看已采纳菜品</button>

        <section v-if="providedNutritionFields.length && !editing" aria-labelledby="upload-nutrition-title" class="border-t pt-5">
          <h3 id="upload-nutrition-title" class="font-medium text-lg mb-3">每份营养信息</h3>
          <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div v-for="field in providedNutritionFields" :key="field.key" :data-nutrition-field="field.key" class="flex items-baseline gap-3">
              <dt class="shrink-0 text-gray-600">{{ field.label }}</dt>
              <dd class="min-w-0 break-words tabular-nums">{{ field.value }}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="contribution-content-title">
          <div class="flex flex-wrap justify-between items-center gap-3 border-t pt-5 mb-4">
            <h3 id="contribution-content-title" class="font-medium text-lg">提交资料</h3>
            <button v-if="dishData.status === 'pending' && !editing" type="button" :disabled="!canModerate || isSubmitting" class="border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed admin-button" @click="startEditing">编辑资料</button>
          </div>
          <ContributionReviewForm v-if="editing" :key="`${dishData.id}:${dishData.revision}`" :upload="dishData" :busy="isSubmitting" @save="saveChanges" @cancel="editing = false" />
          <div v-else class="flex flex-col md:flex-row items-start gap-6">
            <div class="w-40 sm:w-48 md:w-56 shrink-0">
              <AdminImage :src="selectedImage || dishData.images?.[0]" alt="菜品图片" variant="preview" previewable image-class="w-full aspect-square rounded-lg object-cover" @preview="previewImage" />
              <div v-if="dishData.images && dishData.images.length > 1" class="flex flex-wrap gap-2 mt-3">
                <button v-for="(image, index) in dishData.images" :key="image" type="button" :aria-label="`查看菜品图片 ${index + 1}`" :aria-pressed="(selectedImage || dishData.images[0]) === image" class="border-2 admin-icon-button" :class="(selectedImage || dishData.images[0]) === image ? 'border-tsinghua-purple' : 'border-transparent'" @click="selectedImage = image">
                  <AdminImage :src="image" :alt="`菜品图片 ${index + 1}`" image-class="w-12 h-12 rounded object-cover" />
                </button>
              </div>
            </div>
            <div class="min-w-0 flex-1 w-full space-y-4">
              <dl class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div v-for="field in providedDetailFields" :key="field.key" :data-field="field.key" class="flex items-baseline gap-3" :class="{ 'lg:col-span-2': field.key === 'description' || field.key === 'availableDates' }">
                  <dt class="w-20 shrink-0 text-gray-600">{{ field.label }}</dt>
                  <dd class="min-w-0 break-words whitespace-pre-wrap">{{ formatContributionField(dishData, field.key) }}</dd>
                </div>
              </dl>
              <div role="group" aria-label="口味" class="flex flex-wrap items-baseline gap-3 text-sm">
                <span class="w-20 shrink-0 text-gray-600">口味</span>
                <dl v-if="providedTasteFields.length" class="flex flex-wrap gap-x-5 gap-y-2">
                  <div v-for="field in providedTasteFields" :key="field.key" :data-field="field.key" class="flex gap-2">
                    <dt class="text-gray-600">{{ field.label }}</dt>
                    <dd>{{ formatContributionField(dishData, field.key) }}</dd>
                  </div>
                </dl>
                <span v-else>未提供</span>
              </div>
              <p v-if="missingDetailFields.length" data-testid="missing-contribution-fields" class="text-sm text-gray-500">未提供：{{ missingDetailFields.map(field => field.label).join('、') }}</p>
            </div>
          </div>
        </section>

        <section v-if="duplicateCandidates.length && !dishData.targetDishId && dishData.status === 'pending'" aria-labelledby="merge-title" class="border-t pt-5">
          <h3 id="merge-title" class="text-lg font-medium mb-3">相似菜品</h3>
          <label for="merge-dish" class="block font-medium mb-1 admin-label">新建或归并</label>
          <select id="merge-dish" v-model="mergeDishId" :disabled="isSubmitting || editing || !canModerate" class="w-full disabled:bg-gray-50 admin-input">
            <option value="">新建菜品</option>
            <option v-for="candidate in duplicateCandidates" :key="candidate.id" :value="candidate.id">归并至 {{ candidate.name }} · {{ contributionLocation(candidate) }} · {{ formatContributionPrice(candidate.price, candidate.priceUnit) }}{{ candidate.status === 'offline' ? '（已下架）' : '' }}</option>
          </select>
        </section>

        <section v-if="comparisonDish" aria-labelledby="comparison-title" class="border-t pt-5">
          <h3 id="comparison-title" class="text-lg font-medium mb-2">{{ mergeDishId ? '归并字段对比' : '资料变更对比' }}</h3>
          <p v-if="mergeDishId" class="text-sm text-gray-600 mb-3">勾选要采纳的字段。</p>
          <p v-if="hasImageChanges" class="text-sm text-gray-600 mb-3">图片将追加到原菜品，不替换已有图片。</p>
          <div class="admin-table-scroll">
            <table class="admin-table contribution-comparison text-sm" style="min-width: 0; table-layout: fixed">
              <colgroup>
                <col v-if="mergeDishId" style="width: 4rem" />
                <col style="width: 20%" />
                <col />
                <col />
              </colgroup>
              <thead><tr><th v-if="mergeDishId" class="p-3 text-left">采纳</th><th class="p-3 text-left">字段</th><th class="p-3 text-left">原菜品资料</th><th class="p-3 text-left">本次提交</th></tr></thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="field in comparisonFields" :key="field.key" :data-comparison="field.key">
                  <td v-if="mergeDishId" class="p-3 align-top"><input v-model="mergeFields" type="checkbox" :value="field.key" :aria-label="`采纳${field.label}`" :disabled="isSubmitting || editing || !canModerate" class="accent-tsinghua-purple" /></td>
                  <th scope="row" class="p-3 text-left align-top font-medium">{{ field.label }}</th>
                  <td class="p-3 align-top whitespace-pre-wrap break-words">
                    <div v-if="field.key === 'images'" class="flex flex-wrap gap-2"><AdminImage v-for="(image, index) in comparisonDish.images" :key="image" :src="image" :alt="`原菜品图片 ${index + 1}`" image-class="w-16 h-16 object-cover rounded" /><span v-if="!comparisonDish.images?.length">未填写</span></div>
                    <span v-else>{{ formatContributionField(comparisonDish, field.key) }}</span>
                  </td>
                  <td class="p-3 align-top whitespace-pre-wrap break-words">
                    <div v-if="field.key === 'images'" class="flex flex-wrap gap-2"><AdminImage v-for="(image, index) in dishData.images" :key="image" :src="image" :alt="`追加菜品图片 ${index + 1}`" image-class="w-16 h-16 object-cover rounded" /><span v-if="!dishData.images?.length">未填写</span></div>
                    <span v-else>{{ formatContributionField(dishData, field.key) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="needsBaselineConfirmation && dishData.status === 'pending'" class="mt-4 space-y-2">
            <p class="text-sm text-gray-600">核对最新原菜品资料后，可将其设为本次审核基线。该操作只更新审核版本，仍需单独批准。</p>
            <button type="button" :disabled="!canAct" class="border text-tsinghua-purple hover:bg-purple-50 disabled:opacity-50 admin-button" @click="confirmCurrentTarget">确认当前资料并重审</button>
          </div>
        </section>

        <p v-if="!canModerate" class="text-sm text-gray-600">您没有权限审核菜品。</p>
        <div class="flex flex-wrap gap-3 pt-5 border-t border-gray-200">
          <template v-if="dishData.status === 'pending'">
            <button type="button" :disabled="!canAct" class="disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-primary" @click="approveDish">{{ mergeDishId ? '通过并归并' : '通过审核' }}</button>
            <button type="button" :disabled="!canAct" class="border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed admin-button" @click="openRejectModal">拒绝审核</button>
          </template>
          <button v-else-if="dishData.status !== 'withdrawn'" type="button" :disabled="!canAct" class="border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed admin-button" @click="revokeApproval">撤销审核结果</button>
          <span v-if="isSubmitting" role="status" class="self-center text-sm text-gray-600">正在处理…</span>
          <span v-if="editing" class="self-center text-sm text-gray-600">保存或取消修改后继续审核。</span>
        </div>
      </div>
    </div>

    <AdminDialog :open="isRejectModalOpen" label="拒绝审核" :close-on-backdrop="false" :close-on-escape="!isSubmitting" @close="closeRejectModal">
      <form class="w-full max-w-lg overflow-hidden admin-dialog-panel" @submit.prevent="confirmReject">
        <div class="admin-dialog-header"><h3 class="text-lg font-medium">拒绝审核</h3></div>
        <div class="admin-dialog-body">
          <label for="reject-reason" class="block font-medium mb-2 admin-label">拒绝原因</label>
          <textarea id="reject-reason" v-model="rejectReason" :disabled="isSubmitting" :aria-invalid="!!rejectError" :aria-describedby="rejectError ? 'reject-error' : 'reject-help'" rows="4" class="w-full admin-textarea" />
          <p id="reject-help" class="text-sm text-gray-600 mt-2">请说明需要核实或补充的内容，提交人可修改后重新提交。</p>
          <p v-if="rejectError" id="reject-error" role="alert" class="text-sm text-red-700 mt-2 admin-field-error">{{ rejectError }}</p>
        </div>
        <div class="admin-dialog-footer">
          <button type="button" :disabled="isSubmitting" class="border hover:bg-gray-100 disabled:opacity-50 admin-button" @click="closeRejectModal">取消</button>
          <button type="submit" :disabled="isSubmitting" class="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 admin-button">{{ isSubmitting ? '提交中…' : '确认拒绝' }}</button>
        </div>
      </form>
    </AdminDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { reviewApi } from '@/api/modules/review'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { showConfirm, showConfirmDanger } from '@/composables/useModal'
import Header from '@/components/Layout/Header.vue'
import AdminImage from '@/components/Common/AdminImage.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import ContributionReviewForm from '@/components/Dishes/ContributionReviewForm.vue'
import { contributionFields, contributionTasteFields, contributionLocation, formatContributionField, formatContributionPrice } from '@/components/Dishes/contribution-fields'
import { nutritionFields } from '@/utils/nutrition'
import type { ApiResponse } from '@/types/api'
import type { ContributionApprovalRequest, ContributionField, ContributionFields, ContributionStatus, DishContribution } from '@/types/dish-contribution'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const dishData = ref<DishContribution | null>(null)
const isLoading = ref(true)
const loadError = ref('')
const actionError = ref('')
const notice = ref('')
const selectedImage = ref('')
const editing = ref(false)
const isSubmitting = ref(false)
const isRejectModalOpen = ref(false)
const rejectReason = ref('')
const rejectError = ref('')
const mergeDishId = ref('')
const mergeFields = ref<ContributionField[]>([])
const needsBaselineConfirmation = ref(false)
const canModerate = computed(() => authStore.hasPermission('upload:approve'))
const canAct = computed(() => canModerate.value && !isSubmitting.value && !editing.value)
const duplicateCandidates = computed(() => (dishData.value?.duplicateCandidates || []).filter(candidate => candidate.canteenId === dishData.value?.canteenId))
const selectedCandidate = computed(() => duplicateCandidates.value.find(candidate => candidate.id === mergeDishId.value))
const comparisonDish = computed(() => {
  const upload = dishData.value
  if (upload?.status === 'approved' && upload.targetDishId) return upload.baseSnapshot
  return selectedCandidate.value || upload?.targetDish
})
const comparisonFields = computed(() => mergeDishId.value ? contributionFields : contributionFields.filter(field => dishData.value?.changedFields?.includes(field.key)))
const hasImageChanges = computed(() => (mergeDishId.value ? mergeFields.value : dishData.value?.changedFields || []).includes('images'))
const contributionKind = computed(() => dishData.value?.kind === 'update' ? '补充资料' : dishData.value?.targetDishId ? '归并菜品' : '新增菜品')
const detailFields = contributionFields.filter(field => !['name', 'price', 'priceUnit', 'images', ...contributionTasteFields.map(taste => taste.key), ...nutritionFields.map(field => field.key)].includes(field.key))
const providedNutritionFields = computed(() => nutritionFields
  .map(field => ({ ...field, value: dishData.value?.[field.key] }))
  .filter(field => field.value !== null && field.value !== undefined))
const providedDetailFields = computed(() => detailFields.filter(field => hasFieldContent(field.key)))
const missingDetailFields = computed(() => detailFields.filter(field => !hasFieldContent(field.key)))
const providedTasteFields = computed(() => contributionTasteFields.filter(field => (dishData.value?.[field.key] ?? 0) > 0))
const statusText: Record<ContributionStatus, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', withdrawn: '已撤回' }
const statusClasses: Record<ContributionStatus, string> = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', withdrawn: 'bg-gray-100 text-gray-700' }
const formatDate = (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '未记录'
const previewImage = (url: string) => window.open(url, '_blank')
const goBack = () => router.push('/review-dish')
let requestId = 0

function hasFieldContent(key: ContributionField): boolean {
  const dish = dishData.value
  if (!dish) return false
  if (key === 'windowId') return !!(dish.windowName || dish.windowNumber || dish.floorName || dish.floorLevel)
  const value = dish[key]
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? !!value.trim() : value !== null && value !== undefined
}

function assertSuccess<T>(response: ApiResponse<T>): void {
  if (response.code !== 200 && response.code !== 201) throw Object.assign(new Error(response.message || '操作失败，请重试'), { status: response.code })
}

async function loadDishData(): Promise<boolean> {
  const current = ++requestId
  isLoading.value = true
  loadError.value = ''
  dishData.value = null
  editing.value = false
  isRejectModalOpen.value = false
  mergeDishId.value = ''
  mergeFields.value = []
  try {
    const response = await reviewApi.getPendingUploadById(String(route.params.id))
    if (current !== requestId) return false
    assertSuccess(response)
    if (!response.data) throw new Error('未找到该上传记录')
    dishData.value = response.data
    selectedImage.value = ''
    return true
  } catch (failure) {
    if (current === requestId) {
      dishData.value = null
      loadError.value = failure instanceof Error ? failure.message : '提交资料加载失败，请重试'
    }
    return false
  } finally { if (current === requestId) isLoading.value = false }
}

async function handleFailure(failure: unknown) {
  const message = failure instanceof Error ? failure.message : '操作失败，请重试'
  const conflict = typeof failure === 'object' && failure !== null && 'status' in failure && failure.status === 409
  if (conflict) {
    const refreshed = await loadDishData()
    needsBaselineConfirmation.value = refreshed && !!dishData.value?.targetDish
    actionError.value = ''
    notice.value = refreshed ? `${message}。已刷新最新资料，请重新核对后操作。` : `${message}。请重试加载最新资料后再审核。`
  } else {
    actionError.value = message
    if (isRejectModalOpen.value) rejectError.value = message
  }
}

async function confirmCurrentTarget() {
  const current = dishData.value
  if (!current?.targetDish || !canAct.value || current.status !== 'pending') return
  const targetUpdatedAt = current.targetDish.updatedAt
  isSubmitting.value = true
  actionError.value = ''
  try {
    if (!await showConfirm('将当前原菜品资料设为审核基线？通过后会采纳本次提交的字段，请先核对上方对比。', '确认审核基线', '确认并重审')) return
    if (dishData.value !== current || !canModerate.value) return
    const response = await reviewApi.updateUpload(current.id, { revision: current.revision, targetDishUpdatedAt: targetUpdatedAt })
    assertSuccess(response)
    if (dishData.value !== current) return
    dishData.value = response.data
    needsBaselineConfirmation.value = false
    notice.value = '审核基线已更新，请核对后继续审核。'
  } catch (failure) { if (dishData.value === current) await handleFailure(failure) }
  finally { isSubmitting.value = false }
}

function startEditing() {
  if (!canAct.value || dishData.value?.status !== 'pending') return
  actionError.value = ''
  editing.value = true
}

async function saveChanges(changes: Partial<ContributionFields>) {
  const current = dishData.value
  if (!current || !canModerate.value || isSubmitting.value || current.status !== 'pending') return
  isSubmitting.value = true
  actionError.value = ''
  try {
    const response = await reviewApi.updateUpload(current.id, { ...changes, revision: current.revision })
    if (dishData.value !== current) return
    assertSuccess(response)
    dishData.value = response.data
    editing.value = false
    selectedImage.value = ''
    mergeDishId.value = ''
    notice.value = '资料已保存，请核对后继续审核。'
  } catch (failure) { if (dishData.value === current) await handleFailure(failure) }
  finally { isSubmitting.value = false }
}

async function approveDish() {
  const current = dishData.value
  if (!current || !canAct.value || current.status !== 'pending') return
  actionError.value = ''
  if (mergeDishId.value && (!selectedCandidate.value || !mergeFields.value.length)) { actionError.value = '请选择需要归并的字段'; return }
  const payload: ContributionApprovalRequest = { revision: current.revision }
  if (selectedCandidate.value) Object.assign(payload, { mergeDishId: selectedCandidate.value.id, mergeDishUpdatedAt: selectedCandidate.value.updatedAt, mergeFields: [...mergeFields.value] })
  const destination = selectedCandidate.value ? `归并至“${selectedCandidate.value.name}”，仅采纳所选 ${mergeFields.value.length} 个字段` : current.targetDishId ? '的本次修改应用到原菜品' : '发布为新菜品'
  isSubmitting.value = true
  try {
    if (!await showConfirm(`确定将“${current.name}”${destination}？`, '通过审核', '通过审核')) return
    if (dishData.value !== current || !canModerate.value) return
    const response = await reviewApi.approveUpload(current.id, payload)
    assertSuccess(response)
    if (dishData.value === current) await router.replace({ name: 'ReviewDish' })
  } catch (failure) { if (dishData.value === current) await handleFailure(failure) }
  finally { isSubmitting.value = false }
}

function openRejectModal() {
  if (!canAct.value || dishData.value?.status !== 'pending') return
  rejectReason.value = ''
  rejectError.value = ''
  isRejectModalOpen.value = true
}
function closeRejectModal() { if (!isSubmitting.value) isRejectModalOpen.value = false }

async function confirmReject() {
  const current = dishData.value
  if (!current || !canAct.value || current.status !== 'pending') return
  const reason = rejectReason.value.trim()
  if (!reason) { rejectError.value = '请填写拒绝原因'; return }
  isSubmitting.value = true
  rejectError.value = ''
  actionError.value = ''
  try {
    const response = await reviewApi.rejectUpload(current.id, { reason, revision: current.revision })
    assertSuccess(response)
    if (dishData.value === current) { isRejectModalOpen.value = false; await router.replace({ name: 'ReviewDish' }) }
  } catch (failure) { if (dishData.value === current) await handleFailure(failure) }
  finally { isSubmitting.value = false }
}

async function revokeApproval() {
  const current = dishData.value
  if (!current || !canAct.value || !['approved', 'rejected'].includes(current.status)) return
  const consequence = current.status === 'rejected' ? '撤销后恢复待审核。' : current.targetDishId || current.kind === 'update'
    ? '仅撤回本次修改的字段；如字段存在后续变更，系统会拒绝撤销以保护新资料。菜品 ID、评价、收藏和计划均保留。'
    : '新发布菜品将下架，菜品 ID、评价、收藏和计划均保留。重新批准时复用原菜品 ID。'
  isSubmitting.value = true
  actionError.value = ''
  try {
    if (!await showConfirmDanger(`确定撤销“${current.name}”的审核结果？${consequence}`, '撤销审核结果', '撤销')) return
    if (dishData.value !== current || !canModerate.value) return
    const response = await reviewApi.revokeUpload(current.id, { revision: current.revision })
    assertSuccess(response)
    if (dishData.value === current) await router.replace({ name: 'ReviewDish' })
  } catch (failure) { if (dishData.value === current) await handleFailure(failure) }
  finally { isSubmitting.value = false }
}

watch(mergeDishId, () => { mergeFields.value = []; actionError.value = '' })
watch(() => route.params.id, () => { notice.value = ''; actionError.value = ''; needsBaselineConfirmation.value = false; void loadDishData() }, { immediate: true })
</script>

<style scoped>
.contribution-comparison :is(th, td) {
  overflow-wrap: anywhere;
}

.contribution-comparison th {
  white-space: normal;
}
</style>
