import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  savePageState,
  restorePageState,
  clearPageState,
  clearAllPageStates,
} from '@/utils/page-state-cache'

describe('utils/page-state-cache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('savePageState', () => {
    it('saves state to sessionStorage with prefix', () => {
      savePageState('/test-page', { page: 1, filter: 'active' })

      const stored = sessionStorage.getItem('page_state_/test-page')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toEqual({ page: 1, filter: 'active' })
    })

    it('overwrites existing state', () => {
      savePageState('/test', { a: 1 })
      savePageState('/test', { a: 2 })

      const stored = sessionStorage.getItem('page_state_/test')
      expect(JSON.parse(stored!)).toEqual({ a: 2 })
    })

    it('handles complex state objects', () => {
      const state = {
        filters: { canteen: 'A', status: ['active', 'pending'] },
        pagination: { page: 2, pageSize: 20 },
        selectedId: null,
      }
      savePageState('/complex', state)

      const stored = sessionStorage.getItem('page_state_/complex')
      expect(JSON.parse(stored!)).toEqual(state)
    })

    it('logs warning on sessionStorage error', () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem')
      mockSetItem.mockImplementation(() => {
        throw new Error('QuotaExceeded')
      })

      savePageState('/error-page', { data: 'test' })

      expect(console.warn).toHaveBeenCalledWith(
        '保存页面状态失败:',
        expect.any(Error)
      )

      mockSetItem.mockRestore()
    })
  })

  describe('restorePageState', () => {
    it('restores saved state', () => {
      sessionStorage.setItem('page_state_/test', JSON.stringify({ page: 3 }))

      const result = restorePageState('/test', { page: 1 })
      expect(result).toEqual({ page: 3 })
    })

    it('merges saved state with defaults', () => {
      sessionStorage.setItem('page_state_/merge', JSON.stringify({ page: 2 }))

      const result = restorePageState('/merge', { page: 1, filter: 'all' })
      expect(result).toEqual({ page: 2, filter: 'all' })
    })

    it('returns default state when no cache exists', () => {
      const result = restorePageState('/no-cache', { page: 1, status: 'active' })
      expect(result).toEqual({ page: 1, status: 'active' })
    })

    it('returns default state on JSON parse error', () => {
      sessionStorage.setItem('page_state_/invalid', 'invalid json{')

      const result = restorePageState('/invalid', { page: 1 })
      expect(result).toEqual({ page: 1 })
      expect(console.warn).toHaveBeenCalledWith(
        '恢复页面状态失败:',
        expect.any(Error)
      )
    })

    it('returns default state on sessionStorage error', () => {
      const mockGetItem = vi.spyOn(Storage.prototype, 'getItem')
      mockGetItem.mockImplementation(() => {
        throw new Error('Access denied')
      })

      const result = restorePageState('/error', { default: true })
      expect(result).toEqual({ default: true })

      mockGetItem.mockRestore()
    })

    it('handles null values in cached state', () => {
      sessionStorage.setItem(
        'page_state_/null',
        JSON.stringify({ selected: null, filter: 'active' })
      )

      const result = restorePageState('/null', {
        selected: 'default',
        filter: 'all',
      })
      expect(result).toEqual({ selected: null, filter: 'active' })
    })
  })

  describe('clearPageState', () => {
    it('removes specific page state', () => {
      sessionStorage.setItem('page_state_/page1', JSON.stringify({ a: 1 }))
      sessionStorage.setItem('page_state_/page2', JSON.stringify({ b: 2 }))

      clearPageState('/page1')

      expect(sessionStorage.getItem('page_state_/page1')).toBeNull()
      expect(sessionStorage.getItem('page_state_/page2')).not.toBeNull()
    })

    it('does nothing if state does not exist', () => {
      clearPageState('/nonexistent')
      // Should not throw
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('logs warning on sessionStorage error', () => {
      const mockRemoveItem = vi.spyOn(Storage.prototype, 'removeItem')
      mockRemoveItem.mockImplementation(() => {
        throw new Error('Access denied')
      })

      clearPageState('/error')

      expect(console.warn).toHaveBeenCalledWith(
        '清除页面状态失败:',
        expect.any(Error)
      )

      mockRemoveItem.mockRestore()
    })
  })

  describe('clearAllPageStates', () => {
    it('removes all page state entries', () => {
      sessionStorage.setItem('page_state_/page1', JSON.stringify({ a: 1 }))
      sessionStorage.setItem('page_state_/page2', JSON.stringify({ b: 2 }))
      sessionStorage.setItem('other_key', 'should not be removed')

      clearAllPageStates()

      expect(sessionStorage.getItem('page_state_/page1')).toBeNull()
      expect(sessionStorage.getItem('page_state_/page2')).toBeNull()
      expect(sessionStorage.getItem('other_key')).toBe('should not be removed')
    })

    it('does nothing when no page states exist', () => {
      sessionStorage.setItem('other_key', 'value')

      clearAllPageStates()

      expect(sessionStorage.getItem('other_key')).toBe('value')
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('logs warning on sessionStorage error', () => {
      // First add some items
      sessionStorage.setItem('page_state_/test', '{}')

      // Mock Object.keys to cause an error during iteration
      const mockRemoveItem = vi.spyOn(Storage.prototype, 'removeItem')
      mockRemoveItem.mockImplementation(() => {
        throw new Error('Access denied')
      })

      clearAllPageStates()

      expect(console.warn).toHaveBeenCalledWith(
        '清除所有页面状态失败:',
        expect.any(Error)
      )

      mockRemoveItem.mockRestore()
    })
  })

  describe('integration', () => {
    it('save and restore workflow', () => {
      const pageKey = '/dishes'
      const initialState = { page: 1, filter: '', search: '' }

      // Initial restore returns defaults
      const state1 = restorePageState(pageKey, initialState)
      expect(state1).toEqual(initialState)

      // User changes state
      const userState = { page: 3, filter: 'active', search: 'noodles' }
      savePageState(pageKey, userState)

      // Restore gets user state merged with defaults
      const state2 = restorePageState(pageKey, initialState)
      expect(state2).toEqual(userState)

      // Clear and verify defaults restored
      clearPageState(pageKey)
      const state3 = restorePageState(pageKey, initialState)
      expect(state3).toEqual(initialState)
    })

    it('multiple pages isolation', () => {
      savePageState('/page1', { value: 1 })
      savePageState('/page2', { value: 2 })

      expect(restorePageState('/page1', { value: 0 })).toEqual({ value: 1 })
      expect(restorePageState('/page2', { value: 0 })).toEqual({ value: 2 })
      expect(restorePageState('/page3', { value: 0 })).toEqual({ value: 0 })
    })
  })
})

