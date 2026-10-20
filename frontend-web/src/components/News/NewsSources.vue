<template>
  <div class="news-sources">
    <template v-if="!showForm">
      <div class="sources-heading">
        <div>
          <h3 ref="listHeading" tabindex="-1">已连接的公众号</h3>
          <p>自动同步外部文章，按来源规则生成新闻。</p>
        </div>
        <div class="sources-heading-actions">
          <button
            type="button"
            class="admin-button admin-button-secondary"
            :disabled="loading || busy"
            aria-label="刷新来源"
            title="刷新来源"
            @click="load"
          >
            <AppIcon icon="carbon:renew" aria-hidden="true" />刷新
          </button>
          <button
            v-if="canCreate && configured && sources.length"
            type="button"
            class="admin-button admin-button-primary"
            :disabled="busy"
            @click="beginCreate"
          >
            <AppIcon icon="carbon:add" aria-hidden="true" />添加公众号
          </button>
        </div>
      </div>
    </template>
    <div v-else class="source-edit-heading">
      <button type="button" class="source-back" :disabled="busy" @click="closeForm">
        <AppIcon icon="carbon:arrow-left" aria-hidden="true" />返回来源列表
      </button>
      <h3 ref="formHeading" tabindex="-1">{{ editingId ? '编辑公众号来源' : '添加公众号' }}</h3>
      <p>{{ editingId ? editingName : '选择已订阅的公众号，设置文章同步与发布方式。' }}</p>
    </div>

    <div v-if="error || pollingError" class="admin-feedback admin-feedback-error" role="alert">
      <AppIcon icon="carbon:warning" aria-hidden="true" />
      <span>{{ error || pollingError }}</span>
      <button type="button" :disabled="loading || busy" @click="load">重新加载</button>
    </div>

    <template v-if="!showForm">
      <div v-if="loading && !sources.length" class="source-loading" role="status">
        <AppIcon icon="carbon:renew" aria-hidden="true" /><span>正在加载公众号来源…</span>
      </div>
      <div v-else-if="!configured && !error" class="source-empty">
        <AppIcon icon="carbon:connection-signal-off" class="source-empty-icon" aria-hidden="true" />
        <h4>尚未连接采集服务</h4>
        <p>请联系系统管理员配置 WeRSS 服务，连接后即可添加公众号来源。</p>
        <button
          type="button"
          class="admin-button admin-button-secondary"
          :disabled="loading"
          @click="load"
        >
          重新检查连接
        </button>
      </div>
      <template v-else-if="configured">
        <div v-if="sources.length" class="source-directory">
          <div class="source-directory-labels" aria-hidden="true">
            <span>公众号与范围</span><span>同步规则</span><span>最近同步</span
            ><span class="source-actions-label">操作</span>
          </div>
          <ul class="source-list" aria-label="公众号来源">
            <li v-for="source in sources" :key="source.id" class="source-row">
              <div class="source-identity">
                <div class="source-account-icon">
                  <AppIcon icon="carbon:rss" aria-hidden="true" />
                </div>
                <div class="source-account-copy">
                  <h4>{{ source.name }}</h4>
                  <p>{{ source.canteen?.name || '全校公告' }}</p>
                  <p v-if="source.keyword" class="source-keyword">
                    标题包含「{{ source.keyword }}」
                  </p>
                </div>
              </div>
              <div class="source-rule-summary">
                <span class="source-rule-primary">{{
                  source.enabled ? `每 ${source.intervalMinutes} 分钟同步` : '已暂停同步'
                }}</span>
                <span
                  class="source-publication"
                  :class="{ 'source-publication-direct': source.autoPublish }"
                >
                  <AppIcon
                    :icon="source.autoPublish ? 'carbon:send' : 'carbon:document'"
                    aria-hidden="true"
                  />
                  {{ source.autoPublish ? '直接发布' : '先存为草稿' }}
                </span>
              </div>
              <div class="source-sync-summary">
                <span
                  class="source-sync-state"
                  :class="{
                    'has-error': source.lastError && !isSyncing(source),
                    'is-syncing': isSyncing(source),
                    'is-complete': source.lastSyncAt && !source.lastError && !isSyncing(source),
                  }"
                >
                  <AppIcon
                    :icon="
                      isSyncing(source)
                        ? 'carbon:renew'
                        : source.lastError
                          ? 'carbon:warning'
                          : source.lastSyncAt
                            ? 'carbon:checkmark-outline'
                            : 'carbon:time'
                    "
                    aria-hidden="true"
                  />
                  {{
                    isSyncing(source)
                      ? '正在同步'
                      : source.lastError
                        ? '同步失败'
                        : source.lastSyncAt
                          ? '同步完成'
                          : '等待首次同步'
                  }}
                </span>
                <p v-if="source.lastError && !isSyncing(source)" class="source-error-detail">
                  {{ source.lastError }}
                </p>
                <p v-else-if="source.lastSyncAt">
                  <time
                    :datetime="source.lastSyncAt"
                    :title="new Date(source.lastSyncAt).toLocaleString()"
                    >{{ formatSyncTime(source.lastSyncAt) }}</time
                  ><span class="source-import-count">新增 {{ source.lastImportedCount }} 篇</span>
                </p>
                <p v-else>启用后将自动开始</p>
              </div>
              <div class="source-row-actions">
                <button
                  v-if="canCreate"
                  type="button"
                  class="admin-button admin-button-secondary admin-button-compact"
                  :disabled="
                    busy ||
                    !source.enabled ||
                    isSyncing(source) ||
                    (source.autoPublish && !canPublish)
                  "
                  :title="
                    source.autoPublish && !canPublish
                      ? '同步并发布需要新闻发布权限'
                      : !source.enabled
                        ? '启用来源后可同步'
                        : undefined
                  "
                  @click="sync(source)"
                >
                  <AppIcon icon="carbon:renew" aria-hidden="true" />{{
                    isSyncing(source) ? '同步中' : '立即同步'
                  }}
                </button>
                <button
                  v-if="canCreate"
                  type="button"
                  class="source-edit-button"
                  :aria-label="`编辑${source.name}来源`"
                  :disabled="busy || isSyncing(source)"
                  @click="edit(source)"
                >
                  编辑
                </button>
                <span v-if="!canCreate" class="source-readonly">仅查看</span>
              </div>
            </li>
          </ul>
          <p class="source-list-note">
            {{ sources.length }} 个来源。同步结果自动更新，已有新闻保留人工编辑与发布状态。
          </p>
        </div>
        <div v-else class="source-empty">
          <AppIcon icon="carbon:rss" class="source-empty-icon" aria-hidden="true" />
          <h4>让公众号文章自动进入新闻库</h4>
          <p>连接学校或食堂公众号后，系统将持续同步新文章，默认保存为草稿。</p>
          <button
            v-if="canCreate"
            type="button"
            class="admin-button admin-button-primary"
            @click="beginCreate"
          >
            <AppIcon icon="carbon:add" aria-hidden="true" />添加第一个公众号
          </button>
        </div>
        <details class="source-help">
          <summary>
            <AppIcon icon="carbon:help" aria-hidden="true" />如何添加公众号来源？<AppIcon
              class="source-help-chevron"
              icon="carbon:chevron-down"
              aria-hidden="true"
            />
          </summary>
          <p>
            使用 WeRSS
            账号登录面板，完成微信读书授权并订阅公众号后，返回此处添加来源。采集授权失效时，可在
            WeRSS 重新授权后继续同步。
          </p>
        </details>
      </template>
    </template>

    <form v-else class="source-form" @submit.prevent="save">
      <section class="source-form-section" aria-labelledby="source-account-title">
        <div class="source-section-heading">
          <h4 id="source-account-title">来源信息</h4>
          <p>选择公众号与新闻的展示范围。</p>
        </div>
        <div class="source-fields">
          <div class="source-field">
            <label class="admin-label" for="news-source-account">公众号</label>
            <select
              id="news-source-account"
              v-model="form.mpId"
              class="admin-input"
              required
              :disabled="Boolean(editingId) || busy"
            >
              <option value="">选择已订阅的公众号</option>
              <option v-for="feed in availableFeeds" :key="feed.id" :value="feed.id">
                {{ feed.name }}
              </option>
              <option v-if="editingId && !feeds.some((f) => f.id === form.mpId)" :value="form.mpId">
                {{ editingName }}
              </option>
            </select>
            <p v-if="!editingId">列表来自 WeRSS 中已订阅的公众号。</p>
          </div>
          <div class="source-field">
            <label class="admin-label" for="news-source-canteen">发布范围</label>
            <select
              id="news-source-canteen"
              v-model="form.canteenId"
              class="admin-input"
              :disabled="busy"
              :required="scoped"
            >
              <option v-if="!scoped" value="">全校公告</option>
              <option v-for="canteen in canteens" :key="canteen.id" :value="canteen.id">
                {{ canteen.name }}
              </option>
            </select>
            <p>同步的文章将归属此范围。</p>
          </div>
        </div>
      </section>
      <section class="source-form-section" aria-labelledby="source-sync-title">
        <div class="source-section-heading">
          <h4 id="source-sync-title">同步规则</h4>
          <p>控制采集频率和需要导入的内容。</p>
        </div>
        <label class="source-toggle-row">
          <span
            ><strong>自动同步</strong
            ><span class="source-toggle-description">{{
              form.enabled ? '按设定间隔检查并同步文章。' : '已暂停，已同步的新闻继续保留。'
            }}</span></span
          >
          <span class="source-toggle"
            ><input
              v-model="form.enabled"
              role="switch"
              aria-label="自动同步"
              type="checkbox"
              :disabled="busy" /><span aria-hidden="true"></span
          ></span>
        </label>
        <div class="source-fields">
          <div class="source-field">
            <label class="admin-label" for="news-source-interval">同步间隔</label>
            <div class="source-number-input">
              <input
                id="news-source-interval"
                v-model.number="form.intervalMinutes"
                class="admin-input"
                type="number"
                min="5"
                max="1440"
                required
                :disabled="busy"
                aria-describedby="news-source-interval-help"
              /><span>分钟</span>
            </div>
            <p id="news-source-interval-help">支持 5 至 1440 分钟。</p>
          </div>
          <div class="source-field">
            <label class="admin-label" for="news-source-keyword"
              >标题筛选<span class="source-optional">可选</span></label
            >
            <input
              id="news-source-keyword"
              v-model="form.keyword"
              class="admin-input"
              maxlength="200"
              placeholder="例如：上新"
              :disabled="busy"
              aria-describedby="news-source-keyword-help"
            />
            <p id="news-source-keyword-help">仅导入标题包含此关键词的文章，留空同步全部。</p>
          </div>
        </div>
      </section>
      <fieldset class="source-form-section source-publishing" :disabled="busy">
        <legend>新文章如何发布</legend>
        <p class="source-publishing-intro">仅影响新同步的文章，已有新闻保持当前状态。</p>
        <div class="source-publication-options">
          <label class="source-publication-option" :class="{ 'is-selected': !form.autoPublish }">
            <input
              v-model="form.autoPublish"
              type="radio"
              name="news-source-publication"
              :value="false"
            />
            <span><strong>先存为草稿</strong><span>由管理员审核后发布</span></span>
            <AppIcon icon="carbon:document" aria-hidden="true" />
          </label>
          <label
            class="source-publication-option"
            :class="{ 'is-selected': form.autoPublish, 'is-disabled': !canPublish }"
          >
            <input
              v-model="form.autoPublish"
              type="radio"
              name="news-source-publication"
              :value="true"
              :disabled="!canPublish"
            />
            <span
              ><strong>直接发布</strong
              ><span>{{ canPublish ? '新文章同步后展示给用户' : '需要新闻发布权限' }}</span></span
            >
            <AppIcon icon="carbon:send" aria-hidden="true" />
          </label>
        </div>
      </fieldset>
      <div class="source-form-footer">
        <p>
          {{
            form.enabled
              ? form.autoPublish
                ? '保存后，新同步文章将直接发布。'
                : '保存后，新同步文章将进入草稿箱。'
              : '保存后，来源保持暂停。'
          }}
        </p>
        <div>
          <button
            type="button"
            class="admin-button admin-button-secondary"
            :disabled="busy"
            @click="closeForm"
          >
            取消</button
          ><button
            type="submit"
            class="admin-button admin-button-primary"
            :disabled="busy || !form.mpId"
          >
            {{ busy ? '保存中…' : editingId ? '保存设置' : '添加来源' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useNotification } from '@/composables/useNotification'
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  reactive,
  ref,
  watch,
} from 'vue'
import AppIcon from '@/components/Common/AppIcon.vue'
import { useAuthStore } from '@/store/modules/use-auth-store'
import { getAuthSessionVersion } from '@/utils/auth-session'
import { newsSourcesApi, type NewsSource } from '@/api/modules/news-sources'
const notify = useNotification()
const props = withDefaults(
  defineProps<{ canteens: { id: string; name: string }[]; active?: boolean }>(),
  { active: true },
)
const emit = defineEmits<{ imported: []; panelUrl: [url: string | null] }>()
const auth = useAuthStore()
const session = getAuthSessionVersion()
const canCreate = computed(() => auth.hasPermission('news:create'))
const canPublish = computed(() => auth.hasPermission('news:publish'))
const scoped = computed(() => auth.user?.scope === 'CANTEENS')
const configured = ref(false),
  loading = ref(false),
  busy = ref(false),
  showForm = ref(false)
const pollingError = ref(''),
  error = ref(''),
  editingId = ref(''),
  editingName = ref('')
const listHeading = ref<HTMLElement | null>(null),
  formHeading = ref<HTMLElement | null>(null)
const sources = ref<NewsSource[]>([]),
  feeds = ref<{ id: string; name: string }[]>([])
const availableFeeds = computed(() =>
  feeds.value.filter((f) => f.id === form.mpId || !sources.value.some((s) => s.mpId === f.id)),
)
const form = reactive({
  mpId: '',
  canteenId: '',
  intervalMinutes: 30,
  keyword: '',
  enabled: true,
  autoPublish: false,
})
let timer: ReturnType<typeof setInterval> | undefined
let viewActive = true,
  generation = 0
const owns = (v: number) =>
  props.active && viewActive && v === generation && session === getAuthSessionVersion()
const isSyncing = (s: NewsSource) =>
  Boolean(s.syncLeaseUntil && new Date(s.syncLeaseUntil).getTime() > Date.now())
const formatSyncTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
function reset() {
  editingId.value = ''
  editingName.value = ''
  Object.assign(form, {
    mpId: '',
    canteenId: scoped.value ? auth.user?.canteenIds[0] || '' : '',
    intervalMinutes: 30,
    keyword: '',
    enabled: true,
    autoPublish: false,
  })
}
function focusForm() {
  void nextTick(() => formHeading.value?.focus())
}
function beginCreate() {
  reset()
  showForm.value = true
  error.value = ''
  focusForm()
}
function closeForm() {
  showForm.value = false
  reset()
  error.value = ''
  void nextTick(() => listHeading.value?.focus())
}
function edit(s: NewsSource) {
  editingId.value = s.id
  editingName.value = s.name
  Object.assign(form, {
    mpId: s.mpId,
    canteenId: s.canteenId || '',
    intervalMinutes: s.intervalMinutes,
    keyword: s.keyword,
    enabled: s.enabled,
    autoPublish: s.autoPublish,
  })
  showForm.value = true
  error.value = ''
  focusForm()
}
async function refresh() {
  const v = generation
  const res = await newsSourcesApi.list()
  if (!owns(v)) return
  if (res.code !== 200) throw new Error(res.message)
  const changed = sources.value.some((s) =>
    res.data.items.some((n) => n.id === s.id && n.lastSyncAt !== s.lastSyncAt),
  )
  pollingError.value = ''
  sources.value = res.data.items
  configured.value = res.data.configured
  emit('panelUrl', res.data.adminUrl ?? null)
  if (changed) emit('imported')
}
async function load() {
  const v = generation
  loading.value = true
  error.value = ''
  try {
    await refresh()
    if (!owns(v)) return
    if (configured.value && canCreate.value) {
      const res = await newsSourcesApi.feeds()
      if (!owns(v)) return
      if (res.code !== 200) throw new Error(res.message)
      feeds.value = res.data
    }
  } catch (e) {
    if (owns(v)) error.value = e instanceof Error ? e.message : '来源加载失败，请重试'
  } finally {
    if (owns(v)) loading.value = false
  }
}
async function save() {
  if (busy.value) return
  const v = generation
  busy.value = true
  error.value = ''
  try {
    const data = {
      autoPublish: form.autoPublish,
      canteenId: form.canteenId || null,
      enabled: form.enabled,
      intervalMinutes: form.intervalMinutes,
      keyword: form.keyword,
    }
    const res = editingId.value
      ? await newsSourcesApi.update(editingId.value, data)
      : await newsSourcesApi.create({ ...data, mpId: form.mpId })
    if (!owns(v)) return
    if (res.code !== 200 && res.code !== 201) throw new Error(res.message)
    notify.success(data.autoPublish
      ? '来源设置已保存，新同步文章将直接发布。'
      : '来源设置已保存，新同步文章将存为草稿。')
    closeForm()
    await refresh()
  } catch (e) {
    if (owns(v)) error.value = e instanceof Error ? e.message : '来源保存失败'
  } finally {
    if (owns(v)) busy.value = false
  }
}
async function sync(s: NewsSource) {
  const v = generation
  busy.value = true
  error.value = ''
  try {
    const res = await newsSourcesApi.sync(s.id)
    if (!owns(v)) return
    if (res.code !== 200 && res.code !== 201) throw new Error(res.message)
    notify.info('已加入同步队列，结果将在此处自动更新。')
    await refresh()
  } catch (e) {
    if (owns(v)) error.value = e instanceof Error ? e.message : '同步请求失败'
  } finally {
    if (owns(v)) busy.value = false
  }
}
function start() {
  if (timer || !props.active || !viewActive) return
  timer = setInterval(() => {
    const v = generation
    void refresh().catch(() => {
      if (owns(v)) pollingError.value = '同步状态更新失败，请重新加载'
    })
  }, 5000)
}
function stop() {
  generation++
  if (timer) clearInterval(timer)
  timer = undefined
  loading.value = false
  busy.value = false
}
watch(
  () => props.active,
  (active) => {
    if (active && viewActive) {
      void load()
      start()
    } else stop()
  },
  { immediate: true },
)
onDeactivated(() => {
  viewActive = false
  stop()
})
onActivated(() => {
  if (viewActive) return
  viewActive = true
  if (props.active) {
    void load()
    start()
  }
})
onBeforeUnmount(() => {
  viewActive = false
  stop()
})
</script>
<style scoped>
.news-sources {
  --source-accent: #660874;
  --source-text: #1f2937;
  --source-muted: #667085;
  --source-line: #e5e7eb;
  padding-top: 28px;
  color: var(--source-text);
}
.news-sources ::selection {
  background: #f0dff3;
  color: #4d0658;
}
.news-sources :is(button, input, select, summary):focus-visible {
  outline: 2px solid var(--source-accent);
  outline-offset: 3px;
}
.news-sources :is(input, select) {
  caret-color: var(--source-accent);
}
.news-sources button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.sources-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.sources-heading h3,
.source-edit-heading h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
}
.sources-heading p,
.source-edit-heading > p {
  margin: 4px 0 0;
  color: var(--source-muted);
  font-size: 14px;
  line-height: 22px;
}
.sources-heading-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sources-heading-actions svg,
.source-row-actions svg,
.source-form-footer svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.source-directory-labels,
.source-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.25fr) minmax(150px, 1fr) minmax(180px, 1.2fr) auto;
  gap: 20px;
  align-items: center;
}
.source-directory-labels {
  padding: 12px 16px;
  background: #f9fafb;
  border-block: 1px solid var(--source-line);
  color: var(--source-muted);
  font-size: 12px;
  line-height: 20px;
}
.source-actions-label {
  min-width: 150px;
  text-align: right;
}
.source-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.source-row {
  padding: 24px 16px;
  border-bottom: 1px solid var(--source-line);
}
.source-row > * {
  min-width: 0;
}
.source-identity {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.source-account-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: #f5edf6;
  color: var(--source-accent);
  border-radius: 10px;
}
.source-account-icon svg {
  width: 20px;
  height: 20px;
}
.source-account-copy h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.source-account-copy p,
.source-sync-summary p {
  margin: 4px 0 0;
  color: var(--source-muted);
  font-size: 12px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.source-rule-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 20px;
}
.source-rule-primary {
  font-weight: 500;
}
.source-publication {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #4b5563;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 12px;
}
.source-publication svg {
  width: 13px;
  height: 13px;
}
.source-publication-direct {
  color: var(--source-accent);
  background: #f5edf6;
}
.source-sync-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}
.source-sync-state svg {
  color: var(--source-muted);
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.source-sync-state.is-complete svg {
  color: #15803d;
}
.source-sync-state.has-error,
.source-sync-state.has-error svg {
  color: #b91c1c;
}
.source-sync-state.is-syncing,
.source-sync-state.is-syncing svg {
  color: var(--source-accent);
}
.source-import-count {
  display: inline-block;
  margin-left: 10px;
  font-variant-numeric: tabular-nums;
}
.source-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.source-edit-button,
.source-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  color: var(--source-accent);
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
}
.source-edit-button {
  padding: 8px 4px;
}
.source-edit-button:hover,
.source-back:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.source-list-note,
.source-readonly {
  color: var(--source-muted);
  font-size: 12px;
  line-height: 20px;
}
.source-list-note {
  margin: 14px 16px 0;
}
.source-help {
  margin-top: 28px;
  border-top: 1px solid var(--source-line);
  padding-top: 18px;
  color: var(--source-muted);
  font-size: 13px;
  line-height: 22px;
}
.source-help summary {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  list-style: none;
  border-radius: 4px;
}
.source-help summary::-webkit-details-marker {
  display: none;
}
.source-help summary svg {
  width: 16px;
  height: 16px;
}
.source-help-chevron {
  transition: transform 150ms;
}
.source-help[open] .source-help-chevron {
  transform: rotate(180deg);
}
.source-help p {
  max-width: 64ch;
  margin: 12px 0 0 24px;
}

.source-loading,
.source-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 24px;
}
.source-loading {
  gap: 12px;
  color: var(--source-muted);
  font-size: 14px;
}
.source-loading svg {
  width: 24px;
  height: 24px;
}
.source-empty-icon {
  width: 36px;
  height: 36px;
  color: var(--source-accent);
  margin-bottom: 18px;
}
.source-empty h4 {
  margin: 0 0 8px;
  font-size: 17px;
  line-height: 26px;
  font-weight: 600;
}
.source-empty p {
  max-width: 46ch;
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 24px;
  color: var(--source-muted);
}
.source-edit-heading {
  margin-bottom: 28px;
}
.source-back {
  min-height: 36px;
  margin-bottom: 16px;
  color: var(--source-muted);
  font-size: 13px;
}
.source-back svg {
  width: 16px;
  height: 16px;
}
.source-form {
  max-width: 840px;
}
.source-form-section {
  padding: 0 0 28px;
  margin: 0 0 28px;
  border: 0;
  border-bottom: 1px solid var(--source-line);
}
.source-section-heading {
  margin-bottom: 20px;
}
.source-section-heading h4,
.source-publishing legend {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
}
.source-section-heading p,
.source-publishing-intro {
  margin: 4px 0 0;
  color: var(--source-muted);
  font-size: 13px;
  line-height: 22px;
}
.source-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 24px;
}
.source-field {
  min-width: 0;
}
.source-field > .admin-input,
.source-number-input {
  width: 100%;
  margin-top: 8px;
}
.source-field p {
  margin: 6px 0 0;
  color: var(--source-muted);
  font-size: 12px;
  line-height: 20px;
}
.source-optional {
  margin-left: 8px;
  color: var(--source-muted);
  font-weight: 400;
  font-size: 12px;
}
.source-number-input {
  position: relative;
}
.source-number-input input {
  width: 100%;
  padding-right: 56px;
  font-variant-numeric: tabular-nums;
}
.source-number-input > span {
  position: absolute;
  right: 32px;
  top: 9px;
  pointer-events: none;
  font-size: 13px;
  line-height: 22px;
  color: var(--source-muted);
}
.source-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  cursor: pointer;
}
.source-toggle-row strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.source-toggle-description {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 20px;
  color: var(--source-muted);
}
.source-toggle {
  display: inline-flex;
  width: 40px;
  height: 24px;
  position: relative;
  flex-shrink: 0;
}
.source-toggle input {
  appearance: none;
  width: 40px;
  height: 24px;
  margin: 0;
  border-radius: 12px;
  background: #9ca3af;
  cursor: pointer;
  transition: background 150ms;
}
.source-toggle input:checked {
  background: var(--source-accent);
}
.source-toggle > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  pointer-events: none;
  transition: transform 150ms;
}
.source-toggle input:checked + span {
  transform: translateX(16px);
}
.source-toggle input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.source-publishing legend {
  padding: 0;
}
.source-publishing-intro {
  padding-top: 4px;
  margin-bottom: 16px;
}
.source-publication-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.source-publication-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
}
.source-publication-option:hover {
  border-color: #a78bad;
}
.source-publication-option.is-selected {
  border-color: var(--source-accent);
  background: #faf5fb;
}
.source-publication-option.is-disabled {
  cursor: not-allowed;
  background: #f9fafb;
}
.source-publication-option input {
  margin: 4px 0 0;
  accent-color: var(--source-accent);
  flex-shrink: 0;
}
.source-publication-option > span {
  flex: 1;
  min-width: 0;
}
.source-publication-option strong {
  display: block;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}
.source-publication-option span span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 20px;
  color: var(--source-muted);
}
.source-publication-option > svg {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  color: var(--source-muted);
  flex-shrink: 0;
}
.source-publication-option.is-selected > svg {
  color: var(--source-accent);
}
.source-form-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
}
.source-form-footer p {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--source-muted);
}
.source-form-footer > div {
  display: flex;
  gap: 8px;
}
@media (max-width: 1100px) {
  .source-directory-labels {
    display: none;
  }
  .source-row {
    grid-template-columns: minmax(160px, 1fr) minmax(150px, 1fr);
    gap: 20px 24px;
    padding-inline: 0;
  }
  .source-sync-summary {
    grid-column: 1;
  }
  .source-row-actions {
    grid-column: 2;
  }
  .source-rule-summary {
    align-items: flex-end;
  }
  .source-list {
    border-top: 1px solid var(--source-line);
  }
  .source-list-note {
    margin-inline: 0;
  }
}
@media (max-width: 600px) {
  .news-sources {
    padding-top: 24px;
  }
  .sources-heading {
    align-items: flex-start;
    gap: 16px;
  }
  .sources-heading-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .source-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding-block: 20px;
  }
  .source-rule-summary {
    grid-column: 1;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    gap: 8px;
  }
  .source-sync-summary {
    grid-column: 1;
  }
  .source-row-actions {
    grid-column: 1;
    justify-content: flex-start;
    gap: 20px;
  }
  .source-fields,
  .source-publication-options {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .source-form-section {
    margin-bottom: 24px;
    padding-bottom: 24px;
  }
  .source-feedback {
    flex-wrap: wrap;
  }
  .source-form-footer {
    align-items: stretch;
  }
  .source-form-footer > div {
    width: 100%;
  }
  .source-form-footer > div button {
    flex: 1;
  }
  .source-empty {
    padding: 40px 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .news-sources *,
  .news-sources *::before {
    transition: none !important;
  }
}
</style>
