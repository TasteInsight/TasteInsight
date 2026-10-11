<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      v-bind="$attrs"
      class="admin-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledby"
      :aria-label="label"
      @cancel.prevent.stop="handleCancel"
      @click.self="handleBackdrop"
    >
      <slot v-if="open" />
    </dialog>
  </Teleport>
</template>

<script lang="ts">
type DialogRestoration = { order: number; restore: () => void }

let openingOrder = 0
let restorationScheduled = false
const pendingRestorations = new Set<DialogRestoration>()
</script>

<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  open: boolean
  labelledby?: string
  label?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}>(), {
  closeOnBackdrop: true,
  closeOnEscape: true,
})

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let active = true
const restoration: DialogRestoration = {
  order: props.open ? ++openingOrder : 0,
  restore() {
    if (dialog.value?.isConnected) syncDialog()
  },
}

function closeDialog() {
  pendingRestorations.delete(restoration)
  if (dialog.value?.open) dialog.value.close()
}

function syncDialog() {
  if (!dialog.value) return
  if (props.open && active) {
    if (!dialog.value.open && !pendingRestorations.has(restoration)) dialog.value.showModal()
  } else {
    closeDialog()
  }
}

watch(() => props.open, async (open) => {
  if (open) {
    restoration.order = ++openingOrder
    await nextTick()
  }
  syncDialog()
})

onMounted(syncDialog)
onActivated(() => {
  active = true
  if (!props.open || dialog.value?.open) return
  pendingRestorations.add(restoration)
  if (restorationScheduled) return
  restorationScheduled = true
  // KeepAlive activation order differs from the dialogs' logical opening order.
  void nextTick(() => {
    restorationScheduled = false
    const restorations = [...pendingRestorations].sort((a, b) => a.order - b.order)
    pendingRestorations.clear()
    for (const entry of restorations) entry.restore()
  })
})
onDeactivated(() => {
  active = false
  closeDialog()
})
onBeforeUnmount(() => {
  active = false
  closeDialog()
})

function handleCancel() {
  if (props.closeOnEscape) emit('close')
}

function handleBackdrop() {
  if (props.closeOnBackdrop) emit('close')
}
</script>

<style scoped>
.admin-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 1rem;
  border: 0;
  background: transparent;
  color: inherit;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.admin-dialog[open] {
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-dialog::backdrop {
  background: rgb(0 0 0 / 50%);
}
</style>
