<template>
  <div class="translation-fields">
    <div class="translation-heading">
      <label
        >英文名称（选填）<input
          :value="nameEn || ''"
          :maxlength="kind === 'allergen' ? 100 : 200"
          :disabled="busy"
          @input="emit('update:nameEn', ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        type="button"
        class="translation-action"
        :disabled="busy || loading || !name.trim()"
        :aria-busy="loading"
        @click="suggest"
      >
        {{ loading ? '正在生成…' : '生成英文建议' }}
      </button>
    </div>
    <label v-if="kind !== 'allergen'"
      >英文描述（选填）<textarea
        :value="descriptionEn || ''"
        maxlength="4000"
        :disabled="busy"
        rows="3"
        @input="emit('update:descriptionEn', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <p v-if="error" class="translation-error" role="alert">{{ error }}</p>
    <div v-if="proposal" class="translation-proposal">
      <p>{{ proposal.nameEn }}</p>
      <p v-if="proposal.descriptionEn">{{ proposal.descriptionEn }}</p>
      <div class="translation-actions">
        <button type="button" class="translation-action" :disabled="busy" @click="apply">
          采用建议</button
        ><button type="button" class="translation-action" @click="proposal = null">取消</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onScopeDispose } from 'vue'
import { contentLocalizationApi, type TranslationDraft } from '@/api/modules/content-localization'
import { authSessionVersion } from '@/utils/auth-session'
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
onScopeDispose(invalidate)
async function suggest() {
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
    if (active === controller) error.value = '生成失败，请检查 AI 配置后重试'
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
.translation-fields {
  display: grid;
  gap: 12px;
  margin-block: 16px;
}
.translation-heading {
  display: flex;
  align-items: end;
  gap: 12px;
}
.translation-fields label {
  display: grid;
  gap: 6px;
  flex: 1;
  color: #374151;
  font-size: 14px;
}
.translation-fields input,
.translation-fields textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  font-size: 16px;
}
.translation-action {
  padding: 10px 12px;
  min-height: 44px;
  color: #660874;
  border-radius: 8px;
  white-space: nowrap;
}
.translation-action:hover:not(:disabled) {
  background: #f4f4f5;
}
.translation-action:disabled {
  opacity: 0.5;
  cursor: default;
}
.translation-fields :focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
.translation-proposal {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 10px;
  overflow-wrap: anywhere;
}
.translation-proposal p + p {
  margin-top: 8px;
}
.translation-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.translation-error {
  color: #b91c1c;
  font-size: 14px;
}
@media (max-width: 640px) {
  .translation-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .translation-heading button {
    align-self: start;
  }
}
</style>
