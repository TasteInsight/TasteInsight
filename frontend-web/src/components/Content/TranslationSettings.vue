<template>
  <section
    class="settings-section"
    aria-labelledby="translation-settings-title"
    :aria-busy="loading || saving"
  >
    <div class="settings-section-heading">
      <h3 id="translation-settings-title" class="text-lg font-semibold text-gray-800">
        英文辅助翻译
      </h3>
      <span class="text-sm text-tsinghua-purple">所有食堂</span>
    </div>
    <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
      为菜品和过敏原生成英文建议，采用后进入原有保存流程。手工填写英文始终可用。
    </p>
    <p class="mt-1 text-sm leading-6 text-gray-600">翻译服务与用户端 AI 对话分别配置。</p>
    <p v-if="loading" class="mt-5 text-sm text-gray-600" role="status">正在读取翻译设置…</p>
    <div v-else-if="loadError" class="mt-5" role="alert">
      <p class="admin-field-error">{{ loadError }}</p>
      <button type="button" class="mt-3 admin-button admin-button-secondary" @click="loadSettings">
        重新加载
      </button>
    </div>
    <form
      v-else-if="draft && settings"
      class="settings-policy-form mt-6 space-y-5"
      @submit.prevent="saveSettings"
    >
      <fieldset :disabled="!canEdit || saving" class="min-w-0 space-y-5">
        <label class="flex min-h-11 items-center gap-3 text-sm font-medium text-gray-800">
          <input
            v-model="draft.enabled"
            type="checkbox"
            class="admin-permission-checkbox"
            :disabled="settings.managedByEnv.enabled"
          />
          启用辅助翻译
          <span v-if="settings.managedByEnv.enabled" class="text-xs font-normal text-gray-500"
            >由部署环境管理</span
          >
        </label>
        <label class="admin-label block"
          >模型名称
          <input
            v-model="draft.model"
            class="mt-1.5 w-full admin-input"
            maxlength="200"
            placeholder="填写服务商提供的模型标识"
            :disabled="settings.managedByEnv.model"
          />
          <span
            v-if="settings.managedByEnv.model"
            class="mt-1 block text-xs font-normal text-gray-500"
            >由部署环境管理</span
          >
        </label>
        <label class="admin-label block"
          >服务地址
          <input
            v-model="draft.baseUrl"
            type="url"
            class="mt-1.5 w-full admin-input"
            maxlength="2000"
            placeholder="https://api.openai.com/v1"
            :disabled="settings.managedByEnv.baseUrl"
          />
          <span class="mt-1 block text-xs font-normal leading-5 text-gray-500">{{
            settings.managedByEnv.baseUrl
              ? '由部署环境管理'
              : '兼容 OpenAI 的接口地址，留空使用默认地址。'
          }}</span>
        </label>
        <div class="space-y-2">
          <label class="admin-label block"
            >API Key
            <input
              v-model="apiKey"
              type="password"
              autocomplete="new-password"
              class="mt-1.5 w-full admin-input"
              maxlength="4000"
              :placeholder="
                settings.apiKeyConfigured ? '已配置，留空保留现有密钥' : '填写翻译服务密钥'
              "
              :disabled="settings.managedByEnv.apiKey || clearApiKey"
            />
          </label>
          <p class="text-xs leading-5 text-gray-500">
            {{
              settings.managedByEnv.apiKey
                ? '密钥由部署环境管理。'
                : settings.apiKeyConfigured
                  ? '现有密钥已保存，可填写新密钥替换。'
                  : '由全局配置管理员维护，菜品管理员直接使用已启用的服务。'
            }}
          </p>
          <label
            v-if="settings.apiKeyConfigured && !settings.managedByEnv.apiKey"
            class="flex min-h-11 items-center gap-2 text-sm text-gray-600"
          >
            <input
              v-model="clearApiKey"
              type="checkbox"
              class="admin-permission-checkbox"
            />清除已保存的密钥
          </label>
        </div>
      </fieldset>
      <p v-if="settings.invalidFields.length" role="alert" class="admin-field-error">
        {{
          settings.invalidFields
            .map((field) => (field === 'baseUrl' ? '服务地址' : '启用状态'))
            .join('、')
        }}配置无效，请{{
          settings.invalidFields.some((field) => settings?.managedByEnv[field])
            ? '联系部署管理员修正环境配置。'
            : '修正后保存。'
        }}
      </p>
      <p v-if="draft.enabled && missingCredentials" class="text-sm text-amber-800" role="status">
        启用前请填写模型名称和 API Key。
      </p>
      <p v-else-if="!dirty" class="text-sm text-gray-600" role="status">
        {{
          settings.available
            ? '辅助翻译已启用，菜品管理员可直接使用。'
            : settings.enabled
              ? '翻译配置待完成，当前可手工填写英文。'
              : '辅助翻译已关闭，当前可手工填写英文。'
        }}
      </p>
      <p v-if="!canEdit" class="text-sm text-gray-600">当前权限可查看翻译配置。</p>
      <p v-if="saveError" role="alert" class="admin-field-error">{{ saveError }}</p>
      <div v-if="canEdit" class="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          class="admin-button admin-button-primary"
          :disabled="saving || !dirty || (draft.enabled && missingCredentials)"
        >
          {{ saving ? '保存中…' : '保存翻译设置' }}
        </button>
        <button
          type="button"
          class="admin-button admin-button-secondary"
          :disabled="saving || !dirty"
          @click="resetDraft"
        >
          撤销修改
        </button>
        <span v-if="saved" role="status" class="text-sm text-green-700">翻译设置已保存</span>
        <span v-else-if="dirty" class="text-sm text-gray-600">有未保存的修改</span>
      </div>
    </form>
  </section>
</template>
<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onScopeDispose, ref, watch } from 'vue'
import {
  contentLocalizationApi,
  type TranslationSettings,
  type TranslationSettingsUpdate,
} from '@/api/modules/content-localization'
import { authSessionVersion } from '@/utils/auth-session'
import { useAuthStore } from '@/store/modules/use-auth-store'
const props = defineProps<{ canEdit: boolean }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const loadError = ref('')
const saveError = ref('')
const settings = ref<TranslationSettings | null>(null)
const draft = ref<{ enabled: boolean; model: string; baseUrl: string } | null>(null)
const apiKey = ref('')
const clearApiKey = ref(false)
let active: AbortController | null = null
const editableValues = (value: TranslationSettings) => ({
  enabled: value.enabled,
  model: value.model,
  baseUrl: value.baseUrl,
})
const dirty = computed(
  () =>
    !!settings.value &&
    !!draft.value &&
    (JSON.stringify(draft.value) !== JSON.stringify(editableValues(settings.value)) ||
      !!apiKey.value ||
      clearApiKey.value),
)
const missingCredentials = computed(
  () =>
    !draft.value?.model.trim() ||
    !(apiKey.value.trim() || (settings.value?.apiKeyConfigured && !clearApiKey.value)),
)
watch(dirty, (value) => {
  emit('dirty', value)
  if (value) saved.value = false
})
function resetDraft() {
  draft.value = settings.value ? editableValues(settings.value) : null
  apiKey.value = ''
  clearApiKey.value = false
  saveError.value = ''
  saved.value = false
}
function cancelRequests() {
  active?.abort()
  active = null
  saving.value = false
  loading.value = false
  resetDraft()
}
async function loadSettings() {
  if (saving.value) return
  active?.abort()
  const controller = new AbortController()
  active = controller
  loading.value = true
  loadError.value = ''
  try {
    const response = await contentLocalizationApi.translationSettings(controller.signal)
    if (active !== controller) return
    settings.value = response.data
    resetDraft()
  } catch {
    if (active === controller) loadError.value = '翻译设置读取失败，请重新加载。'
  } finally {
    if (active === controller) {
      active = null
      loading.value = false
    }
  }
}
async function saveSettings() {
  if (
    !props.canEdit ||
    saving.value ||
    !dirty.value ||
    !draft.value ||
    !settings.value ||
    (draft.value.enabled && missingCredentials.value)
  )
    return
  const payload: TranslationSettingsUpdate = {}
  const managed = settings.value.managedByEnv
  if (!managed.enabled) payload.enabled = draft.value.enabled
  if (!managed.model) payload.model = draft.value.model.trim()
  if (!managed.baseUrl) payload.baseUrl = draft.value.baseUrl.trim()
  if (!managed.apiKey) {
    if (clearApiKey.value) payload.apiKey = null
    else if (apiKey.value.trim()) payload.apiKey = apiKey.value.trim()
  }
  const controller = new AbortController()
  active = controller
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    const response = await contentLocalizationApi.updateTranslationSettings(
      payload,
      controller.signal,
    )
    if (active !== controller) return
    settings.value = response.data
    resetDraft()
    saved.value = true
  } catch {
    if (active === controller) saveError.value = '翻译设置保存失败，修改已保留，请重试。'
  } finally {
    if (active === controller) {
      active = null
      saving.value = false
    }
  }
}
watch(
  authSessionVersion,
  () => {
    cancelRequests()
    settings.value = null
    draft.value = null
    if (auth.user?.scope === 'GLOBAL' && auth.hasPermission('config:view')) loadSettings()
  },
  { flush: 'sync' },
)
onMounted(loadSettings)
onActivated(() => {
  if (!loading.value && !saving.value) loadSettings()
})
onDeactivated(cancelRequests)
onScopeDispose(cancelRequests)
defineExpose({ resetDraft })
</script>
