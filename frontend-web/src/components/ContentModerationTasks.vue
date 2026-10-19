<template>
  <section ref="taskSection" class="settings-section" aria-labelledby="moderation-tasks-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3
        id="moderation-tasks-title"
        tabindex="-1"
        class="text-lg font-semibold text-gray-800 admin-focus-target"
      >
        内容审核待办
      </h3>
      <button
        type="button"
        class="admin-button admin-button-secondary"
        :disabled="loading || !!deciding"
        @click="loadTasks(true)"
      >
        刷新待办
      </button>
    </div>
    <div class="mt-4 flex flex-wrap items-end gap-4">
      <label class="admin-label"
        >处理状态
        <select
          v-model="status"
          class="mt-1.5 block admin-input"
          :disabled="loading || !!deciding"
          @change="changeStatus"
        >
          <option value="manual">待人工审核</option>
          <option value="failed">机器审核异常</option>
        </select>
      </label>
      <span v-if="meta" class="text-sm text-gray-600" role="status">共 {{ meta.total }} 条</span>
    </div>
    <p v-if="status === 'failed'" class="mt-3 text-sm text-gray-600">
      审核服务异常的内容继续保留待处理，可查看原文并作出人工审核决定。
    </p>
    <p v-if="loading" class="mt-5 text-sm text-gray-600" role="status">正在加载审核待办…</p>
    <div v-else-if="loadError" class="mt-5 text-sm text-red-700" role="alert">{{ loadError }}</div>
    <p v-else-if="!tasks.length" class="mt-5 text-sm text-gray-600">
      {{ status === 'manual' ? '当前没有待人工审核的内容' : '当前没有机器审核异常的内容' }}
    </p>
    <ul v-else class="mt-5 divide-y divide-gray-200">
      <li v-for="task in tasks" :key="task.id" class="py-5 first:pt-0">
        <div class="flex flex-wrap justify-between gap-2 text-sm">
          <h4 class="font-semibold text-gray-800">{{ targetLabel(task.targetType) }}</h4>
          <time class="text-gray-600" :datetime="task.createdAt">{{
            formatTime(task.createdAt)
          }}</time>
        </div>
        <p class="mt-1 text-xs text-gray-600 break-all">
          用户 {{ task.userId }} · 内容 {{ task.targetId }}
        </p>
        <p
          v-if="task.text"
          class="settings-task-copy mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800"
        >
          {{ task.text }}
        </p>
        <ul v-if="task.images.length" class="mt-3 flex flex-wrap gap-3" aria-label="待审核图片">
          <li v-for="(url, index) in task.images" :key="url">
            <a
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-tsinghua-purple"
            >
              <img
                :src="url"
                :alt="`待审核图片 ${index + 1}，点击查看原图`"
                class="h-28 w-28 rounded object-contain bg-gray-50"
                loading="lazy"
              />
            </a>
          </li>
        </ul>
        <p v-if="task.targetType === 'dishUpload'" class="mt-3 text-sm text-gray-600">
          内容审核通过后，菜品投稿继续由管理员确认入库。
        </p>
        <p v-if="task.reason" class="settings-task-copy mt-3 break-words text-sm text-amber-800">
          审核说明：{{ task.reason }}
        </p>
        <div v-if="canEdit" class="mt-4">
          <template v-if="selectedId !== task.id">
            <button
              type="button"
              class="admin-button admin-button-primary"
              :disabled="!!deciding"
              :data-task-action="task.id"
              @click="startDecision(task.id)"
            >
              审核此内容
            </button>
          </template>
          <form v-else class="space-y-3" @submit.prevent="decide(task, false)">
            <label class="block admin-label"
              >审核说明
              <textarea
                v-model="reason"
                rows="2"
                maxlength="500"
                class="mt-1.5 min-h-20 w-full resize-y admin-input"
                :disabled="!!deciding"
                placeholder="拒绝时请填写原因"
              />
            </label>
            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="admin-button admin-button-primary"
                :disabled="!!deciding"
                @click="decide(task, true)"
              >
                {{ deciding === task.id ? '处理中…' : '确认通过' }}
              </button>
              <button
                type="submit"
                class="admin-button admin-button-secondary text-red-700"
                :disabled="!!deciding || !reason.trim()"
              >
                确认拒绝
              </button>
              <button
                type="button"
                class="admin-button admin-button-secondary"
                :disabled="!!deciding"
                @click="cancelDecision"
              >
                取消
              </button>
            </div>
            <p v-if="decisionError" class="text-sm text-red-700" role="alert">
              {{ decisionError }}
            </p>
          </form>
        </div>
      </li>
    </ul>
    <p v-if="decisionSuccess" class="mt-4 text-sm text-green-700" role="status">
      {{ decisionSuccess }}
    </p>
    <nav
      v-if="meta && meta.totalPages > 1"
      aria-label="审核待办分页"
      class="mt-5 flex flex-wrap items-center gap-3"
    >
      <button
        type="button"
        class="admin-button admin-button-secondary"
        :disabled="loading || !!deciding || page <= 1"
        @click="goPage(page - 1)"
      >
        上一页
      </button>
      <span class="text-sm text-gray-600">第 {{ page }} / {{ meta.totalPages }} 页</span>
      <button
        type="button"
        class="admin-button admin-button-secondary"
        :disabled="loading || !!deciding || page >= meta.totalPages"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
  contentModerationApi,
  type ModerationTask,
  type ModerationTasks,
} from '@/api/modules/content-moderation'

const props = defineProps<{ canEdit: boolean }>()
const taskSection = ref<HTMLElement | null>(null)
const status = ref<'manual' | 'failed'>('manual')
const page = ref(1)
const tasks = ref<ModerationTask[]>([])
const meta = ref<ModerationTasks['meta'] | null>(null)
const loading = ref(false)
const loadError = ref('')
const selectedId = ref<string | null>(null)
const reason = ref('')
const deciding = ref<string | null>(null)
const decisionError = ref('')
const decisionSuccess = ref('')
const targetLabels: Record<string, string> = {
  profile: '用户资料',
  review: '菜品评价',
  comment: '评价回复',
  post: '社区帖子',
  postComment: '帖子回复',
  dishUpload: '菜品投稿',
}
const targetLabel = (type: string) => targetLabels[type] || type
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN')
function focusTask(id?: string) {
  const action = [
    ...(taskSection.value?.querySelectorAll<HTMLButtonElement>('[data-task-action]') || []),
  ].find((button) => button.dataset.taskAction === id)
  const target = action || taskSection.value?.querySelector<HTMLElement>('#moderation-tasks-title')
  target?.focus()
}
async function startDecision(id: string) {
  selectedId.value = id
  reason.value = ''
  decisionError.value = ''
  decisionSuccess.value = ''
  await nextTick()
  taskSection.value?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
}
async function cancelDecision() {
  const id = selectedId.value
  selectedId.value = null
  await nextTick()
  focusTask(id || undefined)
}
async function loadTasks(restoreFocus = false) {
  loading.value = true
  loadError.value = ''
  selectedId.value = null
  try {
    const response = await contentModerationApi.getTasks({
      status: status.value,
      page: page.value,
      pageSize: 20,
    })
    if (response.code !== 200 || !response.data) throw new Error()
    tasks.value = response.data.items
    meta.value = response.data.meta
  } catch {
    loadError.value = '审核待办加载失败，请点击“刷新待办”重试。'
  } finally {
    loading.value = false
    if (restoreFocus) {
      await nextTick()
      focusTask()
    }
  }
}
function changeStatus() {
  page.value = 1
  decisionSuccess.value = ''
  void loadTasks(true)
}
function goPage(value: number) {
  page.value = value
  void loadTasks(true)
}
async function decide(task: ModerationTask, approved: boolean) {
  if (!props.canEdit || deciding.value || (!approved && !reason.value.trim())) return
  deciding.value = task.id
  decisionError.value = ''
  let nextId: string | undefined
  let decisionSaved = false
  try {
    const response = await contentModerationApi.decide(task.id, {
      approved,
      ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
    })
    if (response.code !== 200) throw new Error()
    decisionSuccess.value = approved ? '已通过审核' : '已拒绝该内容'
    nextId = tasks.value[tasks.value.findIndex((item) => item.id === task.id) + 1]?.id
    if (tasks.value.length === 1 && page.value > 1) page.value -= 1
    await loadTasks()
    decisionSaved = true
  } catch {
    decisionError.value = '审核决定提交失败，请重试。'
  } finally {
    deciding.value = null
    if (decisionSaved) {
      await nextTick()
      focusTask(nextId || tasks.value[0]?.id)
    }
  }
}
onMounted(() => loadTasks())
</script>
