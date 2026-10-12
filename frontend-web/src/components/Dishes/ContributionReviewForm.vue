<template>
  <form data-testid="contribution-edit" class="space-y-6" @submit.prevent="submit">
    <fieldset :disabled="busy || uploading" class="space-y-6">
      <div class="admin-form-grid">
        <div class="space-y-4">
          <div>
            <label for="upload-name" class="block text-sm font-medium mb-1">菜品名称</label>
            <input id="upload-name" v-model="draft.name" required class="review-input" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="upload-price" class="block text-sm font-medium mb-1">价格</label>
              <input id="upload-price" v-model.number="draft.price" type="number" min="0" step="0.01" required class="review-input" />
            </div>
            <div>
              <label for="upload-price-unit" class="block text-sm font-medium mb-1">价格单位</label>
              <input id="upload-price-unit" v-model="draft.priceUnit" class="review-input" placeholder="例如：元/份" />
            </div>
          </div>
          <div>
            <label for="upload-window" class="block text-sm font-medium mb-1">{{ upload.canteenName }} · 窗口</label>
            <select id="upload-window" v-model="draft.windowId" class="review-input" :disabled="windowsLoading || !!windowsError">
              <option :value="upload.windowId || null">{{ upload.windowName || '未填写窗口' }}（当前）</option>
              <option v-for="window in otherWindows" :key="window.id" :value="window.id">
                {{ window.floor?.name || window.floor?.level || '' }} · {{ window.name }}
              </option>
            </select>
            <p v-if="windowsError" role="alert" class="text-sm text-red-700 mt-1">
              {{ windowsError }} <button type="button" class="underline" @click="loadWindows">重试窗口列表</button>
            </p>
            <p v-else class="text-sm text-gray-600 mt-1">{{ selectedWindow?.floor?.name || floorLabel(upload) || '未填写楼层' }} · 编号 {{ selectedWindow?.number || upload.windowNumber || '未填写' }}</p>
          </div>
          <div>
            <label for="upload-description" class="block text-sm font-medium mb-1">菜品描述</label>
            <textarea id="upload-description" v-model="draft.description" rows="4" class="review-input" />
          </div>
          <div>
            <span class="block text-sm font-medium mb-2">菜品图片</span>
            <p v-if="upload.kind === 'update'" class="text-sm text-gray-600 mb-2">图片将追加到原菜品，移除仅影响本次提交。</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div v-for="(image, index) in draft.images" :key="image" class="min-w-0">
                <AdminImage :src="image" :alt="`菜品图片 ${index + 1}`" image-class="w-full aspect-square rounded-lg object-cover" />
                <div class="flex justify-between gap-2 text-sm mt-1">
                  <button v-if="index > 0" type="button" class="text-tsinghua-purple hover:underline" @click="moveCover(index)">设为首图</button>
                  <span v-else class="text-gray-600">首图</span>
                  <button type="button" class="text-red-700 hover:underline" :aria-label="`移除菜品图片 ${index + 1}`" @click="draft.images.splice(index, 1)">移除</button>
                </div>
              </div>
            </div>
            <label for="upload-images" class="block text-sm mt-3 mb-1">添加图片</label>
            <input id="upload-images" type="file" accept="image/*" multiple class="block w-full text-sm" @change="addImages" />
          </div>
        </div>
        <div class="space-y-5">
          <fieldset>
            <legend class="text-sm font-medium mb-2">口味</legend>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="taste in tasteFields" :key="taste.key">
                <label :for="`upload-${taste.key}`" class="block text-sm mb-1">{{ taste.label }}</label>
                <select :id="`upload-${taste.key}`" v-model="draft[taste.key]" class="review-input">
                  <option :value="draft[taste.key] === null ? null : 0">未提供</option>
                  <option v-for="value in [1, 2, 3, 4, 5]" :key="value" :value="value">{{ value }}</option>
                </select>
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend class="text-sm font-medium mb-2">供应时段</legend>
            <div class="flex flex-wrap gap-4">
              <label v-for="(label, value) in mealTimeLabels" :key="value" class="flex items-center gap-2 text-sm">
                <input v-model="draft.availableMealTime" type="checkbox" :value="value" class="accent-tsinghua-purple" />{{ label }}
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend class="text-sm font-medium mb-2">供应日期段</legend>
            <div v-for="(range, index) in draft.availableDates" :key="index" class="flex flex-wrap items-end gap-2 mb-3">
              <label class="min-w-0 flex-1 text-sm">开始日期<input v-model="range.startDate" type="date" required class="review-input mt-1" /></label>
              <label class="min-w-0 flex-1 text-sm">结束日期<input v-model="range.endDate" type="date" required class="review-input mt-1" /></label>
              <button type="button" class="p-2 text-red-700 hover:underline" :aria-label="`移除供应日期段 ${index + 1}`" @click="draft.availableDates.splice(index, 1)">移除</button>
            </div>
            <button type="button" class="text-sm text-tsinghua-purple hover:underline" @click="draft.availableDates.push({ startDate: '', endDate: '' })">添加日期段</button>
          </fieldset>
          <details class="border-t pt-4">
            <summary class="font-medium cursor-pointer text-sm">标签、原辅料与过敏原</summary>
            <div class="space-y-4 mt-4">
              <div v-for="field in listFields" :key="field.key">
                <label :for="`upload-${field.key}`" class="block text-sm mb-1">{{ field.label }}</label>
                <input :id="`upload-${field.key}`" v-model="lists[field.key]" class="review-input" placeholder="用顿号或逗号分隔" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <p v-if="uploading" role="status" class="text-sm text-gray-600">正在上传图片…</p>
    <div class="flex flex-wrap gap-3">
      <button type="submit" :disabled="busy || uploading" class="px-5 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark disabled:opacity-50">{{ busy ? '保存中…' : '保存修改' }}</button>
      <button type="button" :disabled="busy || uploading" class="px-5 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50" @click="$emit('cancel')">取消编辑</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { canteenApi } from '@/api/modules/canteen'
import { dishApi } from '@/api/modules/dish'
import AdminImage from '@/components/Common/AdminImage.vue'
import type { Window } from '@/types/api'
import type { ContributionFields, DishContribution } from '@/types/dish-contribution'
import { contributionFields, contributionTasteFields as tasteFields, floorLabel, mealTimeLabels } from './contribution-fields'

const props = defineProps<{ upload: DishContribution; busy: boolean }>()
const emit = defineEmits<{ save: [changes: Partial<ContributionFields>]; cancel: [] }>()
const listFields = [{ key: 'tags', label: '标签' }, { key: 'ingredients', label: '原辅料' }, { key: 'allergens', label: '过敏原' }] as const
const draft = reactive({
  name: props.upload.name, price: props.upload.price as number | '', priceUnit: props.upload.priceUnit || '',
  description: props.upload.description || '', windowId: props.upload.windowId || null,
  images: [...(props.upload.images || [])], availableMealTime: [...(props.upload.availableMealTime || [])],
  availableDates: (props.upload.availableDates || []).map(range => ({ startDate: range.startDate.slice(0, 10), endDate: range.endDate.slice(0, 10) })),
  spicyLevel: props.upload.spicyLevel ?? null, saltiness: props.upload.saltiness ?? null,
  sweetness: props.upload.sweetness ?? null, oiliness: props.upload.oiliness ?? null,
})
const lists = reactive({ tags: (props.upload.tags || []).join('、'), ingredients: (props.upload.ingredients || []).join('、'), allergens: (props.upload.allergens || []).join('、') })
const splitList = (value: string) => [...new Set(value.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean))]
const content = (): ContributionFields => ({
  ...draft, name: draft.name.trim(), price: Number(draft.price), priceUnit: draft.priceUnit.trim(), description: draft.description.trim(),
  images: [...draft.images], availableMealTime: [...draft.availableMealTime], availableDates: draft.availableDates.map(range => ({ ...range })),
  tags: splitList(lists.tags), ingredients: splitList(lists.ingredients), allergens: splitList(lists.allergens),
})
const baseline = content()
const error = ref('')
const uploading = ref(false)
const windowsLoading = ref(false)
const windowsError = ref('')
const windows = ref<Window[]>([])
const otherWindows = computed(() => windows.value.filter(window => window.id !== props.upload.windowId))
const selectedWindow = computed(() => windows.value.find(window => window.id === draft.windowId))

async function loadWindows() {
  windowsLoading.value = true
  windowsError.value = ''
  try {
    const response = await canteenApi.getWindows(props.upload.canteenId, { page: 1, pageSize: 100 })
    if (response.code !== 200 || !response.data) throw new Error(response.message || '窗口列表加载失败')
    windows.value = response.data.items
  } catch (failure) {
    windowsError.value = failure instanceof Error ? failure.message : '窗口列表加载失败'
  } finally { windowsLoading.value = false }
}

function moveCover(index: number) { draft.images.unshift(...draft.images.splice(index, 1)) }

async function addImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length || uploading.value || props.busy) return
  uploading.value = true
  error.value = ''
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
      const response = await dishApi.uploadImage(file)
      if (![200, 201].includes(response.code) || !response.data?.url) throw new Error(response.message || '图片上传失败，请重新选择失败的图片')
      if (!draft.images.includes(response.data.url)) draft.images.push(response.data.url)
    }
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '图片上传失败' }
  finally { uploading.value = false; input.value = '' }
}

function submit() {
  if (props.busy || uploading.value) return
  error.value = ''
  if (!draft.name.trim()) { error.value = '请填写菜品名称'; return }
  if (draft.price === '' || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) { error.value = '请填写有效价格，免费菜品可填写 0'; return }
  if (draft.availableDates.some(range => !range.startDate || !range.endDate || range.startDate > range.endDate)) { error.value = '请填写有效的供应日期段'; return }
  const next = content()
  const changes = Object.fromEntries(contributionFields.filter(({ key }) => JSON.stringify(next[key]) !== JSON.stringify(baseline[key])).map(({ key }) => [key, next[key]])) as Partial<ContributionFields>
  if (!Object.keys(changes).length) { emit('cancel'); return }
  emit('save', changes)
}

onMounted(loadWindows)
</script>

<style scoped>
.review-input { width: 100%; min-width: 0; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: white; }
.review-input:focus-visible { outline: 2px solid #660874; outline-offset: 2px; }
.review-input:disabled { background: #f9fafb; color: #6b7280; }
</style>
