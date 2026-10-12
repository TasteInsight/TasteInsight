import { computed, readonly, ref, watch, type WatchSource } from 'vue'

export function useBatchSelection(options: {
  ids: () => readonly string[]
  context: WatchSource<unknown>
  enabled: () => boolean
}) {
  const selectedIds = ref<string[]>([])
  const contextVersion = ref(0)
  const visibleIds = computed(options.ids)
  const selectedCount = computed(() => selectedIds.value.length)
  const allSelected = computed(() => visibleIds.value.length > 0 &&
    visibleIds.value.every(id => selectedIds.value.includes(id)))
  const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)
  const clear = () => { selectedIds.value = [] }

  watch([options.context, options.enabled], () => {
    contextVersion.value += 1
    clear()
  }, { flush: 'sync' })

  watch(visibleIds, ids => {
    const visible = new Set(ids)
    selectedIds.value = selectedIds.value.filter(id => visible.has(id))
  }, { flush: 'sync' })

  const toggle = (id: string) => {
    if (!options.enabled() || !visibleIds.value.includes(id)) return
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter(selected => selected !== id)
      : [...selectedIds.value, id]
  }

  const toggleAll = () => {
    if (!options.enabled()) return
    selectedIds.value = allSelected.value ? [] : [...visibleIds.value]
  }

  return {
    selectedIds: readonly(selectedIds),
    selectedCount,
    allSelected,
    someSelected,
    contextVersion: readonly(contextVersion),
    toggle,
    toggleAll,
    clear,
  }
}
