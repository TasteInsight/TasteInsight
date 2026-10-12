<template>
  <view class="campus-page" :aria-busy="loading || submitting">
    <view class="campus-heading"
      ><button class="campus-button" :disabled="submitting || loading || closing" @click="leave">
        取消</button
      ><text class="editor-title">{{ postId ? '编辑动态' : '发布动态' }}</text
      ><button class="campus-button campus-primary" :disabled="!canSubmit" @click="submit">
        {{ submitting ? '发布中…' : postId ? '保存' : '发布' }}
      </button></view
    >
    <view v-if="conflict" class="editor-conflict" aria-live="polite">
      <text class="editor-conflict-title">动态已更新</text>
      <text class="campus-hint">当前文字和照片已保留。核对最新内容后，再选择如何继续编辑。</text>
      <button
        v-if="!conflict.latest"
        class="campus-button"
        aria-label="读取动态最新版本"
        :disabled="loading"
        @click="readLatestVersion"
      >
        {{ loading ? '读取中…' : '查看最新版本' }}
      </button>
      <template v-else>
        <text class="editor-conflict-label">最新内容</text>
        <text class="editor-latest-content" selectable>{{ conflict.latest.content }}</text>
        <view v-if="conflict.latest.images.length" class="editor-latest-images">
          <button
            v-for="(url, index) in conflict.latest.images"
            :key="url"
            class="editor-preview"
            :aria-label="'查看最新内容的第 ' + (index + 1) + ' 张图片'"
            @click="previewLatest(index)"
          >
            <image :src="url" mode="aspectFill" />
          </button>
        </view>
        <view class="editor-conflict-actions">
          <button
            class="campus-button"
            aria-label="保留我的修改继续编辑"
            :disabled="closing"
            @click="resolveConflict(false)"
          >
            保留我的修改
          </button>
          <button
            class="campus-button"
            aria-label="采用动态最新内容"
            :disabled="closing"
            @click="resolveConflict(true)"
          >
            采用最新内容
          </button>
        </view>
      </template>
    </view>
    <view v-if="error" class="campus-error" role="alert"
      ><text>{{ error }}</text
      ><button v-if="!ready" class="campus-button" @click="initialize">重新加载</button></view
    >
    <view v-if="loading && !ready" class="campus-skeleton" aria-hidden="true"
      ><view class="campus-skeleton-line" /><view class="campus-skeleton-line" /><view
        class="campus-skeleton-line"
    /></view>
    <template v-if="ready">
      <textarea
        v-model="content"
        class="editor-content"
        :disabled="submitting || loading || closing"
        maxlength="2000"
        aria-label="动态正文"
        placeholder="今天吃到了什么？分享你的校园日常。"
        placeholder-style="color: #667085"
      />
      <view class="editor-count campus-hint">{{ content.length }} / 2000</view>
      <view class="editor-images">
        <view v-for="(image, index) in images" :key="image.path" class="editor-image-cell"
          ><button
            class="editor-preview"
            :aria-label="'预览第 ' + (index + 1) + ' 张图片'"
            @click="preview(index)"
          >
            <image :src="image.path" mode="aspectFill" /></button
          ><button
            class="campus-button editor-remove"
            :disabled="submitting || loading || closing"
            :aria-label="'移除第 ' + (index + 1) + ' 张图片'"
            @click="images.splice(index, 1)"
          >
            移除
          </button></view
        >
        <button
          v-if="images.length < 9"
          class="campus-button editor-add"
          :disabled="submitting || loading || closing"
          @click="chooseImages"
        >
          <text class="iconfont icon-camera" aria-hidden="true" /><text>添加照片</text
          ><text class="campus-hint">{{ images.length }} / 9</text>
        </button>
      </view>
    </template>
  </view>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { onLoad, onBackPress } from '@dcloudio/uni-app';
import { getPost, createPost, updatePost, type Post } from '@/api/modules/social';
import { uploadImage } from '@/api/modules/upload';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { confirmDiscardChanges } from '@/utils/confirm-discard';
import { openCampus } from '@/utils/campus-navigation';

interface EditorImage {
  path: string;
  uploaded?: string;
}
const user = useUserStore();
const postId = ref('');
const content = ref('');
const images = ref<EditorImage[]>([]);
const loading = ref(false);
const submitting = ref(false);
const closing = ref(false);
const ready = ref(false);
const error = ref('');
const conflict = ref<{ latest?: Post } | null>(null);
const expectedUpdatedAt = ref('');
let owner = '';
let session = 0;
let active = true;
let version = 0;
let leaving = false;
let baseContent = '';
let baseImages: string[] = [];
const current = (request: number) =>
  active && request === version && owner === user.userInfo?.id && session === user.sessionVersion;
const draftKey = () => `community-draft:${owner}:${postId.value || 'new'}`;
const dirty = computed(
  () =>
    content.value !== baseContent ||
    JSON.stringify(images.value.map(item => item.path)) !== JSON.stringify(baseImages)
);
const canSubmit = computed(
  () =>
    ready.value &&
    !loading.value &&
    !submitting.value &&
    !closing.value &&
    !conflict.value &&
    !!content.value.trim() &&
    content.value.length <= 2000
);
function saveTextDraft() {
  if (!owner || !ready.value || session !== user.sessionVersion || owner !== user.userInfo?.id)
    return;
  try {
    uni.setStorageSync(
      draftKey(),
      JSON.stringify({ content: content.value, expectedUpdatedAt: expectedUpdatedAt.value })
    );
  } catch {
    /* Storage may be unavailable in a private browser session. */
  }
}
async function initialize() {
  if (!owner || !current(version)) {
    error.value = '请重新登录后发布';
    return;
  }
  const request = ++version;
  loading.value = true;
  ready.value = false;
  error.value = '';
  conflict.value = null;
  try {
    let latest: Post | undefined;
    if (postId.value) {
      const response = await getPost(postId.value);
      if (!current(request)) return;
      if (response.code !== 200 || response.data.userId !== owner)
        throw new Error(
          response.data?.userId !== owner
            ? '只能编辑自己的动态'
            : response.message || '动态加载失败'
        );
      content.value = response.data.content;
      expectedUpdatedAt.value = response.data.updatedAt;
      images.value = response.data.images.map(path => ({ path, uploaded: path }));
      latest = response.data;
    }
    baseContent = content.value;
    baseImages = images.value.map(item => item.path);
    try {
      const raw = uni.getStorageSync(draftKey());
      const draft = raw ? JSON.parse(raw) : null;
      if (
        draft &&
        typeof draft.content === 'string' &&
        typeof draft.expectedUpdatedAt === 'string'
      ) {
        content.value = draft.content.slice(0, 2000);
        if (latest && draft.expectedUpdatedAt !== expectedUpdatedAt.value) {
          expectedUpdatedAt.value = draft.expectedUpdatedAt;
          conflict.value = { latest };
        }
      }
    } catch {
      /* An invalid draft does not replace the server content. */
    }
    ready.value = true;
  } catch (cause) {
    if (current(request))
      error.value = cause instanceof Error ? cause.message : '动态加载失败，请重试';
  } finally {
    if (current(request)) loading.value = false;
  }
}
function chooseImages() {
  if (submitting.value || loading.value || closing.value || !requireStudent()) return;
  const request = version;
  uni.chooseImage({
    count: 9 - images.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: result => {
      if (!current(request)) return;
      const paths =
        typeof result.tempFilePaths === 'string' ? [result.tempFilePaths] : result.tempFilePaths;
      images.value.push(...paths.slice(0, 9 - images.value.length).map(path => ({ path })));
    },
  });
}
function preview(index: number) {
  const urls = images.value.map(item => item.path);
  uni.previewImage({ urls, current: urls[index] });
}
function previewLatest(index: number) {
  const urls = conflict.value?.latest?.images;
  if (urls) uni.previewImage({ urls, current: urls[index] });
}
async function readLatestVersion() {
  if (!conflict.value || loading.value || closing.value) return;
  const request = ++version;
  loading.value = true;
  error.value = '';
  try {
    const response = await getPost(postId.value);
    if (!current(request)) return;
    if (response.code !== 200 || response.data.userId !== owner)
      throw new Error('无法读取这条动态，请返回后重试');
    conflict.value = { latest: response.data };
  } catch (cause) {
    if (current(request))
      error.value = cause instanceof Error ? cause.message : '最新内容读取失败，请重试';
  } finally {
    if (current(request)) loading.value = false;
  }
}
async function resolveConflict(useLatest: boolean) {
  const latest = conflict.value?.latest;
  if (!latest || closing.value) return;
  const request = version;
  closing.value = true;
  try {
    const confirmed = await new Promise<boolean>(resolve => {
      uni.showModal({
        title: useLatest ? '采用最新内容？' : '保留我的修改？',
        content: useLatest
          ? '当前未保存的文字和照片将被最新内容替换。'
          : '保留当前文字和照片继续编辑。再次保存将替换刚查看的最新内容。',
        confirmText: useLatest ? '采用最新' : '保留并编辑',
        cancelText: '再看看',
        success: result => resolve(result.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed || !current(request)) return;
    ready.value = false;
    baseContent = latest.content;
    baseImages = [...latest.images];
    expectedUpdatedAt.value = latest.updatedAt;
    if (useLatest) {
      content.value = latest.content;
      images.value = latest.images.map(path => ({ path, uploaded: path }));
    }
    conflict.value = null;
    error.value = '';
    ready.value = true;
    if (useLatest) uni.removeStorageSync(draftKey());
    else saveTextDraft();
  } finally {
    if (current(request)) closing.value = false;
  }
}
async function submit() {
  if (!canSubmit.value || !requireStudent()) return;
  const request = version;
  submitting.value = true;
  error.value = '';
  try {
    const uploaded: string[] = [];
    for (const image of images.value) {
      if (!current(request)) return;
      if (!image.uploaded) image.uploaded = (await uploadImage(image.path)).url;
      if (!current(request)) return;
      uploaded.push(image.uploaded);
    }
    const payload = { content: content.value.trim(), images: uploaded };
    const response = postId.value
      ? await updatePost(postId.value, { ...payload, expectedUpdatedAt: expectedUpdatedAt.value })
      : await createPost(payload);
    if (!current(request)) return;
    if (![200, 201].includes(response.code))
      throw new Error(response.message || '发布失败，请重试');
    uni.removeStorageSync(draftKey());
    leaving = true;
    ready.value = false;
    uni.redirectTo({ url: `/pages/community/detail?id=${encodeURIComponent(response.data.id)}` });
  } catch (cause) {
    if (current(request)) {
      if (postId.value && (cause as { statusCode?: number } | null)?.statusCode === 409) {
        conflict.value = {};
        error.value = '';
      } else error.value = cause instanceof Error ? cause.message : '发布失败，请重试';
    }
  } finally {
    if (current(request)) submitting.value = false;
  }
}
async function leave() {
  if (submitting.value || loading.value || closing.value) return;
  const request = version;
  closing.value = true;
  try {
    if (
      !(await confirmDiscardChanges(
        dirty.value,
        images.value.some(image => !image.uploaded)
          ? '文字草稿会保留，离开后需重新选择照片。'
          : '文字草稿会保留，确定离开编辑吗？'
      )) ||
      !current(request)
    )
      return;
    saveTextDraft();
    leaving = true;
    uni.navigateBack({ fail: () => openCampus() });
  } finally {
    if (current(request)) closing.value = false;
  }
}
watch(content, saveTextDraft, { flush: 'sync' });
watch(
  () => user.sessionVersion,
  () => {
    version++;
    content.value = '';
    images.value = [];
    ready.value = false;
    conflict.value = null;
    loading.value = false;
    submitting.value = false;
    closing.value = false;
    error.value = '登录账号已变更，请重新打开编辑页';
  },
  { flush: 'sync' }
);
onLoad(options => {
  postId.value = String(options?.id || '');
  owner = user.userInfo?.id || '';
  session = user.sessionVersion;
  void initialize();
});
onBackPress(() => {
  if (leaving) return false;
  if (submitting.value || loading.value || closing.value) return true;
  if (!dirty.value) return false;
  void leave();
  return true;
});
onScopeDispose(() => {
  saveTextDraft();
  active = false;
  version++;
});
</script>
<style scoped>
@import './community.css';
.editor-title {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}
.editor-conflict {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}
.editor-conflict-title,
.editor-conflict-label {
  font-size: 16px;
  font-weight: 600;
}
.editor-conflict-label {
  margin-top: 8px;
}
.editor-latest-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 16px;
  line-height: 1.8;
}
.editor-latest-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  max-width: 360px;
}
.editor-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.editor-content {
  box-sizing: border-box;
  width: 100%;
  min-height: 260px;
  padding: 0;
  color: #1f2937;
  font-size: 17px;
  line-height: 1.9;
  caret-color: #660874;
}
.editor-content:focus-within {
  outline: none;
}
.editor-count {
  margin: 12px 0 20px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.editor-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.editor-image-cell {
  min-width: 0;
}
.editor-preview {
  position: relative;
  display: block;
  width: 100%;
  height: 0;
  margin: 0;
  padding: 0 0 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f4f4f5;
}
.editor-preview image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.editor-preview::after {
  border: 0;
}
.editor-remove {
  display: flex;
  width: 100%;
  padding: 4px;
  color: #667085;
  font-size: 13px;
}
.editor-add {
  flex-direction: column;
  min-height: 112px;
  padding: 16px 4px;
  border: 1px dashed #9ca3af;
  color: #475467;
}
.editor-add .iconfont {
  font-size: 28px;
}
</style>
