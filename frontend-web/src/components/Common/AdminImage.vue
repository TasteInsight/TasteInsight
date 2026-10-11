<template>
  <component
    :is="previewable === 'link' ? 'a' : previewable ? 'button' : 'span'"
    v-if="source && !failed"
    v-bind="$attrs"
    class="admin-image"
    :class="{ 'admin-image--preview': variant === 'preview', 'admin-image__button': previewable }"
    :type="previewable === true ? 'button' : undefined"
    :disabled="previewable === true && !loaded"
    :href="previewable === 'link' ? source : undefined"
    :target="previewable === 'link' ? '_blank' : undefined"
    :rel="previewable === 'link' ? 'noopener noreferrer' : undefined"
    :aria-disabled="previewable === 'link' && !loaded ? true : undefined"
    :aria-label="previewable === 'link' ? `在新窗口查看${alt}` : previewable ? `预览${alt}` : undefined"
    :data-state="loaded ? 'ready' : 'loading'"
    @click="activate"
  >
    <img
      :key="`${source}:${attempt}`"
      ref="imageElement"
      :src="source"
      :alt="alt"
      :loading="loading"
      :class="resolvedImageClass"
      @load="handleLoad"
      @error="handleError"
    />
  </component>
  <span
    v-else-if="variant === 'avatar'"
    v-bind="$attrs"
    class="admin-image admin-image__avatar"
    :class="resolvedImageClass"
    role="img"
    :aria-label="`${alt}的头像不可用`"
    data-state="unavailable"
  >
    {{ Array.from(alt.trim())[0] || '用' }}
  </span>
  <span
    v-else-if="variant === 'preview'"
    v-bind="$attrs"
    class="admin-image__unavailable"
    :aria-label="`${alt}：${source ? '图片加载失败' : '暂无图片'}`"
    data-state="unavailable"
  >
    <span>{{ source ? '图片加载失败' : '暂无图片' }}</span>
    <button v-if="source" type="button" class="admin-image__retry" @click.stop="retry">
      重新加载
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src?: string | null
  alt: string
  variant?: 'thumbnail' | 'avatar' | 'preview'
  imageClass?: string
  previewable?: boolean | 'link'
  loading?: 'eager' | 'lazy'
}>(), {
  variant: 'thumbnail',
  imageClass: '',
  previewable: false,
})

const emit = defineEmits<{ preview: [src: string] }>()
const source = computed(() => props.src?.trim() || '')
const failed = ref(false)
const loaded = ref(false)
const attempt = ref(0)
const imageElement = ref<HTMLImageElement>()
const resolvedImageClass = computed(() => props.imageClass || {
  thumbnail: 'w-12 h-12 rounded object-cover',
  avatar: 'w-10 h-10 rounded-full object-cover',
  preview: 'w-full aspect-square rounded-lg object-cover',
}[props.variant])

watch(source, () => {
  failed.value = false
  loaded.value = false
}, { flush: 'sync' })

function handleLoad(event: Event) {
  if (event.currentTarget === imageElement.value) loaded.value = true
}

function handleError(event: Event) {
  if (event.currentTarget !== imageElement.value) return
  failed.value = true
  loaded.value = false
}

function retry() {
  attempt.value += 1
  failed.value = false
  loaded.value = false
}

function activate(event: MouseEvent) {
  if (!props.previewable) return
  event.stopPropagation()
  if (!loaded.value) {
    event.preventDefault()
    return
  }
  if (props.previewable === true) emit('preview', source.value)
}
</script>

<style scoped>
.admin-image {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}

.admin-image--preview {
  display: block;
  max-width: 100%;
}

.admin-image img {
  display: block;
}

.admin-image__button {
  padding: 0;
  background: transparent;
  cursor: zoom-in;
}

.admin-image__button:disabled {
  cursor: default;
}

.admin-image__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 600;
}

.admin-image__unavailable {
  display: flex;
  align-self: start;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  min-height: 4rem;
  padding: 1rem;
  border: 1px dashed #d1d5db;
  border-radius: 0.5rem;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
}

.admin-image__retry {
  padding: 0.25rem;
  color: #660874;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.admin-image__retry:hover {
  color: #4b0655;
}

.admin-image__button:focus-visible,
.admin-image__retry:focus-visible {
  outline: 2px solid #660874;
  outline-offset: 3px;
}
</style>
