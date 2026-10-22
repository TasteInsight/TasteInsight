<template>
  <div class="admin-page">
    <section class="admin-panel">
      <div class="admin-heading-row">
        <Header
          title="过敏原词表"
          description="维护过敏原的中英文名称与别名"
          header-icon="carbon:catalog"
        />
        <div class="admin-actions">
          <router-link
            v-if="auth.hasPermission('dish:view')"
            to="/modify-dish"
            class="admin-button admin-button-secondary"
          >
            <AppIcon icon="carbon:arrow-left" aria-hidden="true" />返回菜品管理
          </router-link>
          <button
            v-if="canEdit"
            type="button"
            class="admin-button admin-button-primary"
            :disabled="saving"
            @click="select()"
          >
            <AppIcon icon="carbon:add" aria-hidden="true" />新增过敏原
          </button>
        </div>
      </div>
      <div class="allergen-layout" :class="{ 'admin-form-grid': canEdit }">
        <section
          :class="{ 'allergen-list--editable': canEdit }"
          aria-labelledby="allergen-list-title"
        >
          <h3 id="allergen-list-title" class="mb-4 text-base font-semibold text-gray-800">
            已收录过敏原
          </h3>
          <div v-if="error" role="alert" class="admin-feedback admin-feedback-error">
            <AppIcon icon="carbon:warning" aria-hidden="true" />
            <span>{{ error }}</span
            ><button type="button" :disabled="saving" @click="load">重试</button>
          </div>
          <p v-else-if="loading" role="status" class="admin-state">正在加载…</p>
          <p v-else-if="!entries.length" class="admin-state">暂无过敏原</p>
          <ul v-else class="allergen-list divide-y divide-gray-200">
            <li v-for="entry in entries" :key="entry.value">
              <button
                type="button"
                class="allergen-row hover:bg-gray-50 disabled:cursor-wait"
                :class="
                  selected === entry.value
                    ? 'bg-tsinghua-purple/5 text-tsinghua-purple'
                    : 'text-gray-800'
                "
                :aria-pressed="selected === entry.value"
                :disabled="saving"
                @click="select(entry)"
              >
                <span class="font-medium">{{ entry.nameZh }}</span>
                <span class="text-gray-600">{{ entry.nameEn || '未填写英文名称' }}</span>
                <AppIcon icon="carbon:chevron-right" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
        <form v-if="canEdit" class="allergen-editor space-y-6" @submit.prevent="save">
          <h3 class="text-base font-semibold text-gray-800">
            {{ selected ? '编辑过敏原' : '新增过敏原' }}
          </h3>
          <label class="admin-label"
            >中文名称<input
              v-model="form.nameZh"
              class="w-full admin-input mt-1"
              required
              maxlength="100"
              :disabled="saving"
          /></label>
          <TranslationFields
            v-model:name-en="form.nameEn"
            kind="allergen"
            :name="form.nameZh"
            :busy="saving"
          />
          <div class="space-y-2">
            <p
              v-if="selectedAliases.length"
              class="allergen-aliases text-sm leading-6 text-gray-600"
            >
              已有别名：{{ selectedAliases.join('、') }}
            </p>
            <label class="admin-label"
              >补充别名<input
                v-model="form.aliases"
                class="w-full admin-input mt-1"
                placeholder="多个别名用逗号分隔"
                :disabled="saving"
            /></label>
          </div>
          <p v-if="saveError" role="alert" class="admin-field-error">{{ saveError }}</p>
          <div class="admin-actions">
            <button
              class="admin-button admin-button-primary"
              type="submit"
              :disabled="saving || !form.nameZh.trim()"
            >
              <AppIcon icon="carbon:save" aria-hidden="true" />{{ saving ? '正在保存…' : '保存' }}
            </button>
            <p v-if="saved" role="status" class="admin-field-success">已保存</p>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { parseAllergenList, normalizeAllergenText } from '@/utils/allergen-values'
import Header from '@/components/Layout/Header.vue'
import AppIcon from '@/components/Common/AppIcon.vue'
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
        nameZh: normalizeAllergenText(form.nameZh),
        nameEn: normalizeAllergenText(form.nameEn) || null,
        aliases: parseAllergenList(form.aliases),
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
.allergen-list--editable {
  border-right: 1px solid #e5e7eb;
  padding-right: 24px;
}
.allergen-list {
  max-height: 560px;
  overflow-y: auto;
}
.allergen-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 16px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  text-align: left;
  font-size: 14px;
  line-height: 22px;
}
.allergen-row:focus-visible {
  outline-offset: -3px;
}
.allergen-row > span,
.allergen-aliases {
  min-width: 0;
  overflow-wrap: anywhere;
}
.allergen-row > svg {
  width: 16px;
  height: 16px;
}
@media (max-width: 900px) {
  .allergen-list--editable {
    border-right: 0;
    padding-right: 0;
    padding-bottom: 24px;
    border-bottom: 1px solid #e5e7eb;
  }
  .allergen-list {
    max-height: 240px;
  }
}
</style>
