<template>
  <section class="allergen-page">
    <header class="allergen-header">
      <h1>过敏原词表</h1>
      <button v-if="canEdit" type="button" class="allergen-action" @click="select()">
        新增过敏原
      </button>
    </header>
    <p v-if="error" role="alert" class="allergen-error">
      {{ error }} <button type="button" :disabled="saving" @click="load">重试</button>
    </p>
    <p v-if="loading" role="status">正在加载…</p>
    <div class="allergen-layout">
      <div class="allergen-list">
        <button
          v-for="entry in entries"
          :key="entry.value"
          type="button"
          class="allergen-row"
          :aria-pressed="selected === entry.value"
          @click="select(entry)"
        >
          <span>{{ entry.nameZh }}</span
          ><span class="allergen-secondary">{{ entry.nameEn || '未填写英文名称' }}</span>
        </button>
      </div>
      <form v-if="canEdit" class="allergen-editor" @submit.prevent="save">
        <label
          >中文名称<input v-model="form.nameZh" required maxlength="100" :disabled="saving"
        /></label>
        <TranslationFields
          v-model:name-en="form.nameEn"
          kind="allergen"
          :name="form.nameZh"
          :busy="saving"
        />
        <p v-if="selectedAliases.length" class="allergen-secondary">
          已有别名：{{ selectedAliases.join('、') }}
        </p>
        <label
          >补充别名<input
            v-model="form.aliases"
            placeholder="多个别名用逗号分隔"
            :disabled="saving"
        /></label>
        <p v-if="saveError" role="alert" class="allergen-error">{{ saveError }}</p>
        <button class="allergen-primary" type="submit" :disabled="saving || !form.nameZh.trim()">
          {{ saving ? '正在保存…' : '保存' }}
        </button>
        <p v-if="saved" role="status">已保存</p>
      </form>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch, onScopeDispose } from 'vue'
import { contentLocalizationApi, type AllergenEntry } from '@/api/modules/content-localization'
import TranslationFields from '@/components/Content/TranslationFields.vue'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { authSessionVersion } from '@/utils/auth-session'
const auth = useAuthStore()
const canEdit = computed(() => auth.user?.scope === 'GLOBAL' && auth.hasPermission('config:edit'))
const entries = ref<AllergenEntry[]>([])
const loading = ref(false),
  saving = ref(false),
  error = ref(''),
  saveError = ref(''),
  saved = ref(false)
const selected = ref<string>()
const form = reactive({ nameZh: '', nameEn: '', aliases: '' })
const selectedAliases = computed(
  () => entries.value.find((e) => e.value === selected.value)?.aliases || [],
)
let version = 0
let readVersion = 0
function select(entry?: AllergenEntry) {
  if (saving.value) return
  selected.value = entry?.value
  Object.assign(form, { nameZh: entry?.nameZh || '', nameEn: entry?.nameEn || '', aliases: '' })
  saved.value = false
  saveError.value = ''
}
async function load() {
  if (saving.value) return
  const owner = version
  const read = ++readVersion
  const current = () => owner === version && read === readVersion
  loading.value = true
  error.value = ''
  try {
    const res = await contentLocalizationApi.catalog()
    if (current()) entries.value = res.data
  } catch {
    if (current()) error.value = '词表加载失败'
  } finally {
    if (current()) loading.value = false
  }
}
async function save() {
  if (saving.value || !canEdit.value) return
  const owner = version
  readVersion++
  loading.value = false
  error.value = ''
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    const response = await contentLocalizationApi.saveAllergen(
      {
        nameZh: form.nameZh.trim(),
        nameEn: form.nameEn.trim() || null,
        aliases: form.aliases
          .split(/[,，;；、\n]+/)
          .map((v) => v.trim())
          .filter(Boolean),
      },
      selected.value,
    )
    if (owner !== version) return
    entries.value = [
      ...entries.value.filter((e) => e.value !== response.data.value),
      response.data,
    ].sort((a, b) => a.nameZh.localeCompare(b.nameZh))
    selected.value = response.data.value
    form.aliases = ''
    saved.value = true
  } catch {
    if (owner === version) saveError.value = '保存失败，请检查名称或别名是否重复'
  } finally {
    if (owner === version) saving.value = false
  }
}
watch(authSessionVersion, () => {
  version++
  entries.value = []
  selected.value = undefined
  Object.assign(form, { nameZh: '', nameEn: '', aliases: '' })
  readVersion++
  loading.value = false
  saving.value = false
  saved.value = false
})
onScopeDispose(() => {
  version++
})
onMounted(load)
</script>
<style scoped>
.allergen-page {
  max-width: 1100px;
  margin: auto;
  padding: 24px;
}
.allergen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.allergen-header h1 {
  font-size: 24px;
  font-weight: 600;
}
.allergen-layout {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(280px, 1fr);
  gap: 32px;
}
.allergen-row {
  display: grid;
  width: 100%;
  text-align: left;
  gap: 4px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 8px;
}
.allergen-row:hover,
.allergen-row[aria-pressed='true'] {
  background: #f8f9fa;
}
.allergen-secondary {
  font-size: 14px;
  color: #4b5563;
  overflow-wrap: anywhere;
}
.allergen-editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.allergen-editor label {
  display: grid;
  gap: 6px;
  font-size: 14px;
  color: #374151;
}
.allergen-editor input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 16px;
  width: 100%;
  box-sizing: border-box;
}
.allergen-action,
.allergen-primary {
  padding: 10px 16px;
  min-height: 44px;
  border-radius: 8px;
}
.allergen-action {
  color: #660874;
}
.allergen-action:hover {
  background: #f4f4f5;
}
.allergen-primary {
  background: #660874;
  color: white;
  align-self: start;
}
.allergen-primary:disabled {
  opacity: 0.5;
}
.allergen-error {
  color: #b91c1c;
  margin-bottom: 12px;
}
.allergen-page :focus-visible {
  outline: 2px solid #660874;
  outline-offset: 2px;
}
@media (max-width: 720px) {
  .allergen-page {
    padding: 16px;
  }
  .allergen-layout {
    grid-template-columns: 1fr;
  }
  .allergen-list {
    max-height: 260px;
    overflow: auto;
  }
}
</style>
