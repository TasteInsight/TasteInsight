<template>
  <div v-if="!components" class="min-h-[400px] flex flex-col items-center justify-center gap-3 p-6">
    <p v-if="loadFailed" role="alert" class="text-red-600">
      编辑器加载失败。请先保留已填写内容，再刷新页面重试。
    </p>
    <p v-else role="status" class="text-gray-500">正在加载编辑器…</p>
  </div>
  <template v-else>
    <component
      :is="components.Toolbar"
      style="border-bottom: 1px solid #ccc"
      :editor="editor"
      mode="default"
    />
    <component
      :is="components.Editor"
      style="height: 400px; overflow-y: hidden"
      :model-value="modelValue"
      :default-config="config"
      mode="default"
      @update:model-value="emit('update:modelValue', $event)"
      @on-created="emit('created', $event)"
    />
  </template>
</template>

<script lang="ts">
let editorResources: Promise<typeof import('@wangeditor/editor-for-vue')> | undefined

function loadEditorResources() {
  // Vite caches failed CSS preloads. Keep the rejection until a full page reload.
  return editorResources ??= Promise.all([
    import('@wangeditor/editor-for-vue'),
    import('@wangeditor/editor/dist/css/style.css'),
  ]).then(([editor]) => editor)
}
</script>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import type { IDomEditor, IEditorConfig } from '@wangeditor/editor'

defineProps<{
  modelValue: string
  editor?: IDomEditor
  config: Partial<IEditorConfig>
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  created: [editor: IDomEditor]
}>()

const components = shallowRef<typeof import('@wangeditor/editor-for-vue')>()
const loadFailed = ref(false)

onMounted(async () => {
  try {
    components.value = await loadEditorResources()
  } catch {
    loadFailed.value = true
  }
})
</script>
