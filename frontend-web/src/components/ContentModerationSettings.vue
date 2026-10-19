<template>
  <section
    class="settings-section"
    aria-labelledby="moderation-title"
    :aria-busy="loading || saving"
  >
    <div class="settings-section-heading">
      <h3 id="moderation-title" class="text-lg font-semibold text-gray-800">统一内容审核</h3>
      <span class="text-sm text-tsinghua-purple">所有食堂</span>
    </div>
    <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
      统一处理用户资料、评价与回复、社区内容和菜品投稿中的文字与图片。
    </p>
    <p v-if="loading" class="mt-5 text-sm text-gray-600" role="status">正在读取审核设置…</p>
    <div v-else-if="loadError" class="mt-5" role="alert">
      <p class="text-sm text-red-700">{{ loadError }}</p>
      <button type="button" class="mt-3 admin-button admin-button-secondary" @click="loadSettings">
        重新加载
      </button>
    </div>
    <form
      v-else-if="draft"
      class="settings-policy-form mt-6 space-y-4"
      @submit.prevent="saveSettings"
    >
      <fieldset :disabled="!canEdit || saving" class="min-w-0 space-y-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-800">启用统一内容审核</p>
            <p class="mt-1 text-sm leading-6 text-gray-600">关闭后，按下方人工审核规则处理。</p>
          </div>
          <label class="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              v-model="draft.enabled"
              type="checkbox"
              aria-label="启用统一内容审核"
              class="sr-only peer"
            />
            <span
              class="w-11 h-6 shrink-0 bg-gray-200 rounded-full admin-switch-track peer-checked:bg-tsinghua-purple peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-full"
            ></span>
          </label>
        </div>
        <div
          v-if="draft.enabled"
          class="grid gap-4"
          :class="draft.mode === 'manual' ? 'sm:max-w-sm' : 'sm:grid-cols-2'"
        >
          <label class="admin-label"
            >审核方式
            <select v-model="draft.mode" class="mt-1.5 w-full admin-input">
              <option value="manual">人工审核</option>
              <option value="machine">机器审核</option>
              <option value="machine_and_manual">机器审核后人工审核</option>
            </select>
          </label>
          <label v-if="draft.mode !== 'manual'" class="admin-label"
            >机器审核服务
            <select v-model="draft.provider" class="mt-1.5 w-full admin-input">
              <option value="aliyun">阿里云内容安全</option>
              <option value="wechat">微信内容安全</option>
            </select>
          </label>
        </div>
      </fieldset>
      <p v-if="draft.enabled" class="text-sm leading-6 text-gray-600">{{ modeDescription }}</p>
      <p
        v-if="draft.enabled && settings?.mediaConfigured === false"
        class="text-sm text-amber-800"
        role="status"
      >
        审核图片访问配置待完成，请联系部署管理员。
      </p>
      <p
        v-if="draft.enabled && draft.mode !== 'manual' && selectedProvider"
        class="text-sm"
        :class="selectedProvider.configured ? 'text-green-700' : 'text-amber-800'"
        role="status"
      >
        {{ selectedProvider.configured ? '服务凭证已配置' : '服务凭证待配置，请联系部署管理员' }}
      </p>
      <details
        v-if="draft.enabled && deploymentMissing.length"
        class="text-sm leading-6 text-gray-600"
      >
        <summary
          class="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-tsinghua-purple"
        >
          部署配置详情
        </summary>
        <p class="mt-2 break-words">缺少环境变量：{{ deploymentMissing.join('、') }}</p>
        <p class="mt-1">凭证与图片访问地址由服务器环境变量管理，请联系部署管理员完成配置。</p>
      </details>
      <p v-if="!canEdit" class="text-sm text-gray-600">当前权限可查看审核配置。</p>
      <p v-if="saveError" role="alert" class="text-sm text-red-700">{{ saveError }}</p>
      <div v-if="canEdit" class="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          class="admin-button admin-button-primary"
          :disabled="saving || !dirty || unavailableProvider"
        >
          {{ saving ? '保存中…' : '保存审核设置' }}
        </button>
        <button
          type="button"
          class="admin-button admin-button-secondary"
          :disabled="saving || !dirty"
          @click="resetDraft"
        >
          撤销修改
        </button>
        <span v-if="saved" role="status" class="text-sm text-green-700">审核设置已保存</span>
        <span v-else-if="dirty" class="text-sm text-gray-600">有未保存的修改</span>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  contentModerationApi,
  type ModerationPolicy,
  type ModerationSettings,
} from '@/api/modules/content-moderation'

const props = defineProps<{ canEdit: boolean }>()
const emit = defineEmits<{
  enabled: [value: boolean]
  busy: [value: boolean]
  state: [value: 'loading' | 'ready' | 'error']
  dirty: [value: boolean]
}>()
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saved = ref(false)
const settings = ref<ModerationSettings | null>(null)
const draft = ref<ModerationPolicy | null>(null)
const policy = (value: ModerationPolicy): ModerationPolicy => ({
  enabled: value.enabled,
  provider: value.provider,
  mode: value.mode,
})
const dirty = computed(
  () =>
    !!draft.value &&
    !!settings.value &&
    JSON.stringify(draft.value) !== JSON.stringify(policy(settings.value)),
)
const selectedProvider = computed(
  () => draft.value && settings.value?.providers[draft.value.provider],
)
const deploymentMissing = computed(() => [
  ...new Set([
    ...(settings.value?.mediaMissing || []),
    ...(draft.value?.mode !== 'manual' ? selectedProvider.value?.missing || [] : []),
  ]),
])
watch(dirty, (value) => {
  emit('dirty', value)
  if (value) saved.value = false
})
const unavailableProvider = computed(
  () =>
    draft.value?.enabled &&
    (settings.value?.mediaConfigured === false ||
      (draft.value.mode !== 'manual' && !selectedProvider.value?.configured)),
)
const modeDescription = computed(() =>
  draft.value?.mode === 'manual'
    ? '新提交或修改的内容经人工审核后公开。'
    : draft.value?.mode === 'machine'
      ? '机器审核通过后公开；菜品投稿仍需管理员确认后入库。审核服务异常时，内容保留待处理。'
      : '机器审核通过后进入人工审核，通过人工审核后公开。',
)
function resetDraft() {
  if (settings.value) draft.value = policy(settings.value)
  saveError.value = ''
  saved.value = false
}
async function loadSettings() {
  loading.value = true
  emit('state', 'loading')
  loadError.value = ''
  try {
    const response = await contentModerationApi.getSettings()
    if (response.code !== 200 || !response.data) throw new Error()
    settings.value = response.data
    resetDraft()
    emit('enabled', response.data.enabled)
    emit('state', 'ready')
  } catch {
    loadError.value = '审核设置读取失败，请重新加载。'
    emit('state', 'error')
  } finally {
    loading.value = false
  }
}
async function saveSettings() {
  if (!props.canEdit || !draft.value || !dirty.value || saving.value || unavailableProvider.value)
    return
  saving.value = true
  emit('busy', true)
  saveError.value = ''
  saved.value = false
  try {
    const response = await contentModerationApi.updateSettings(policy(draft.value))
    if (response.code !== 200 || !response.data) throw new Error()
    settings.value = response.data
    resetDraft()
    saved.value = true
    emit('enabled', response.data.enabled)
  } catch {
    saveError.value = '审核设置保存失败，修改已保留，请重试。'
  } finally {
    saving.value = false
    emit('busy', false)
  }
}
defineExpose({ resetDraft })
onMounted(loadSettings)
</script>
