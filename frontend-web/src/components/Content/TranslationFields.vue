<template>
  <div class="translation-fields space-y-4">
    <div class="translation-heading">
      <label class="admin-label translation-name"
        >英文名称（选填）<input
          :value="nameEn || ''"
          class="w-full admin-input mt-1"
          :maxlength="kind === 'allergen' ? 100 : 200"
          :disabled="busy"
          @input="emit('update:nameEn', ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        type="button"
        class="admin-button admin-button-secondary"
        :disabled="busy || loading || statusLoading || !status?.available || !name.trim()"
        :aria-busy="loading"
        @click="suggest"
      >
        <AppIcon icon="carbon:translate" aria-hidden="true" />{{
          loading ? '正在生成…' : '生成英文建议'
        }}
      </button>
    </div>
    <label v-if="kind !== 'allergen'" class="admin-label"
      >英文描述（选填）<textarea
        :value="descriptionEn || ''"
        class="w-full admin-textarea mt-1"
        maxlength="4000"
        :disabled="busy"
        rows="3"
        @input="emit('update:descriptionEn', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <div
      v-if="statusError || (status && !status.available)"
      class="text-sm leading-6 text-gray-600"
    >
      <p>
        {{
          statusError ||
          (status?.enabled
            ? '辅助翻译暂不可用，可手工填写英文。'
            : '辅助翻译尚未启用，可手工填写英文。')
        }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          v-if="statusError"
          type="button"
          class="admin-text-link"
          :disabled="statusLoading"
          @click="loadStatus"
        >
          重新读取状态
        </button>
        <router-link
          v-if="canConfigure"
          class="admin-text-link"
          to="/config-manage?section=translation"
          >翻译服务配置</router-link
        >
        <span v-else-if="!statusError">需要辅助翻译时，请联系配置管理员。</span>
      </div>
    </div>
    <p v-if="error" class="admin-field-error" role="alert">{{ error }}</p>
    <section v-if="proposal" class="admin-feedback admin-feedback-info" aria-label="英文建议">
      <div class="translation-proposal space-y-3">
        <div class="space-y-1">
          <p class="font-medium">{{ proposal.nameEn }}</p>
          <p v-if="proposal.descriptionEn">{{ proposal.descriptionEn }}</p>
        </div>
        <div class="admin-actions">
          <button
            type="button"
            class="admin-button admin-button-primary admin-button-compact"
            :disabled="busy"
            @click="apply"
          >
            采用建议
          </button>
          <button
            type="button"
            class="admin-button admin-button-secondary admin-button-compact"
            @click="proposal = null"
          >
            取消
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import AppIcon from '@/components/Common/AppIcon.vue'
import { computed, ref, watch, onScopeDispose, onMounted, onActivated, onDeactivated } from 'vue'
import {
  contentLocalizationApi,
  type TranslationDraft,
  type TranslationStatus,
} from '@/api/modules/content-localization'
import { authSessionVersion } from '@/utils/auth-session'
import { useAuthStore } from '@/store/modules/use-auth-store'
const props = withDefaults(
  defineProps<{
    kind?: 'dish' | 'allergen'
    name: string
    description?: string | null
    nameEn?: string | null
    descriptionEn?: string | null
    busy?: boolean
  }>(),
  { kind: 'dish' },
)
const emit = defineEmits<{
  'update:nameEn': [value: string]
  'update:descriptionEn': [value: string]
}>()
const auth = useAuthStore()
const canConfigure = computed(
  () => auth.user?.scope === 'GLOBAL' && auth.hasPermission('config:view'),
)
const status = ref<TranslationStatus | null>(null)
const statusLoading = ref(false)
const statusError = ref('')
let statusRequest: AbortController | null = null
async function loadStatus() {
  statusRequest?.abort()
  const controller = new AbortController()
  statusRequest = controller
  statusLoading.value = true
  statusError.value = ''
  status.value = null
  try {
    const response = await contentLocalizationApi.translationStatus(controller.signal)
    if (statusRequest === controller) status.value = response.data
  } catch {
    if (statusRequest === controller) statusError.value = '辅助翻译状态读取失败，可手工填写英文。'
  } finally {
    if (statusRequest === controller) {
      statusRequest = null
      statusLoading.value = false
    }
  }
}
function cancelRequests() {
  invalidate()
  statusRequest?.abort()
  statusRequest = null
  statusLoading.value = false
  status.value = null
}
onMounted(loadStatus)
onActivated(() => {
  if (!statusLoading.value) loadStatus()
})
onDeactivated(cancelRequests)
watch(
  authSessionVersion,
  () => {
    cancelRequests()
    loadStatus()
  },
  { flush: 'sync' },
)
const loading = ref(false)
const error = ref('')
const proposal = ref<TranslationDraft | null>(null)
let active: AbortController | null = null
function invalidate() {
  active?.abort()
  active = null
  loading.value = false
  proposal.value = null
  error.value = ''
}
watch(
  () => [
    props.name,
    props.description,
    props.nameEn,
    props.descriptionEn,
    authSessionVersion.value,
  ],
  invalidate,
  { flush: 'sync' },
)
onScopeDispose(cancelRequests)
async function suggest() {
  if (props.busy || loading.value || !status.value?.available || !props.name.trim()) return
  invalidate()
  const controller = new AbortController()
  active = controller
  loading.value = true
  try {
    const response = await contentLocalizationApi.draft(
      { kind: props.kind, name: props.name.trim(), description: props.description || undefined },
      controller.signal,
    )
    if (active === controller) proposal.value = response.data
  } catch {
    if (active === controller) error.value = '英文建议生成失败，可重试或手工填写。'
  } finally {
    if (active === controller) {
      active = null
      loading.value = false
    }
  }
}
function apply() {
  if (!proposal.value) return
  const selected = proposal.value
  emit('update:nameEn', selected.nameEn)
  if (props.kind === 'dish') emit('update:descriptionEn', selected.descriptionEn)
  proposal.value = null
}
</script>
<style scoped>
.translation-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.translation-name {
  flex: 1;
  min-width: 160px;
}
.translation-proposal {
  min-width: 0;
  width: 100%;
}
@media (max-width: 639px) {
  .translation-heading {
    flex-direction: column;
    align-items: stretch;
  }
  .translation-heading > button {
    align-self: flex-start;
  }
}
</style>
