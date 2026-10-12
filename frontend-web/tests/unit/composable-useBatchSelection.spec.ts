import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useBatchSelection } from '@/composables/useBatchSelection'

const scopes: ReturnType<typeof effectScope>[] = []

function setupSelection() {
  const ids = ref(['a', 'b'])
  const context = ref('page-1')
  const enabled = ref(true)
  const scope = effectScope()
  scopes.push(scope)
  const selection = scope.run(() => useBatchSelection({
    ids: () => ids.value,
    context: () => context.value,
    enabled: () => enabled.value,
  }))!
  return { ids, context, enabled, selection }
}

afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('useBatchSelection', () => {
  it('selects only visible rows and exposes full and partial selection', () => {
    const { selection } = setupSelection()
    selection.toggle('hidden')
    expect(selection.selectedCount.value).toBe(0)
    selection.toggle('a')
    expect(selection.selectedIds.value).toEqual(['a'])
    expect(selection.someSelected.value).toBe(true)
    expect(selection.allSelected.value).toBe(false)
    selection.toggleAll()
    expect(selection.selectedIds.value).toEqual(['a', 'b'])
    expect(selection.allSelected.value).toBe(true)
    expect(selection.someSelected.value).toBe(false)
    selection.toggleAll()
    expect(selection.selectedCount.value).toBe(0)
  })

  it('clears synchronously on context changes, including a round trip to the original page', () => {
    const { selection, context } = setupSelection()
    selection.toggleAll()
    const version = selection.contextVersion.value
    context.value = 'page-2'
    context.value = 'page-1'
    expect(selection.selectedCount.value).toBe(0)
    expect(selection.contextVersion.value).not.toBe(version)
  })

  it('prunes hidden rows without automatically selecting newly loaded rows', () => {
    const { selection, ids } = setupSelection()
    selection.toggleAll()
    ids.value = ['b', 'c']
    expect(selection.selectedIds.value).toEqual(['b'])
    expect(selection.someSelected.value).toBe(true)
  })

  it('clears selection when permission is lost and blocks unavailable selection', () => {
    const { selection, enabled } = setupSelection()
    selection.toggleAll()
    enabled.value = false
    selection.toggle('a')
    selection.toggleAll()
    expect(selection.selectedIds.value).toEqual([])
  })
})
