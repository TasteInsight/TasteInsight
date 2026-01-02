import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

describe('store/use-dish-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters by searchQuery and filterOptions', async () => {
    const { useDishStore } = await import('@/store/modules/use-dish-store')
    const store = useDishStore()

    store.addDish({ id: '1', name: 'Noodles', canteenId: 'A', status: 'online' } as any)
    store.addDish({ id: '2', name: 'Rice', canteenId: 'B', status: 'offline' } as any)

    store.setSearchQuery('noo')
    expect(store.filteredDishes.map((d) => d.id)).toEqual(['1'])

    store.setSearchQuery('')
    store.setFilterOptions({ canteenId: 'B' })
    expect(store.filteredDishes.map((d) => d.id)).toEqual(['2'])

    store.setFilterOptions({ status: 'online' })
    expect(store.filteredDishes.map((d) => d.id)).toEqual([])
  })

  it('update and remove dish', async () => {
    const { useDishStore } = await import('@/store/modules/use-dish-store')
    const store = useDishStore()

    store.addDish({ id: '1', name: 'A', canteenId: 'C', status: 'online' } as any)
    store.updateDish('1', { name: 'B' } as any)
    expect(store.dishes[0].name).toBe('B')

    store.removeDish('1')
    expect(store.dishes.length).toBe(0)
  })

  it('update/remove are no-ops when id is missing', async () => {
    const { useDishStore } = await import('@/store/modules/use-dish-store')
    const store = useDishStore()

    store.addDish({ id: '1', name: 'A', canteenId: 'C', status: 'online' } as any)

    store.updateDish('missing', { name: 'B' } as any)
    expect(store.dishes[0].name).toBe('A')

    store.removeDish('missing')
    expect(store.dishes.length).toBe(1)
  })
})
