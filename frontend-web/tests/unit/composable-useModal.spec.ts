import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  modalState,
  showModal,
  showAlert,
  showConfirm,
  showConfirmDanger,
  closeModal,
} from '@/composables/useModal'

describe('composables/useModal', () => {
  beforeEach(() => {
    // Reset modal state before each test
    modalState.visible.value = false
    modalState.title.value = '提示'
    modalState.message.value = ''
    modalState.buttons.value = []
    modalState.showClose.value = true
    modalState.closeOnClickMask.value = true
    modalState.resolve = null
  })

  describe('showModal', () => {
    it('sets modal state correctly with full options', async () => {
      const promise = showModal({
        title: 'Test Title',
        message: 'Test Message',
        showClose: false,
        closeOnClickMask: false,
        buttons: [
          { text: 'Cancel', variant: 'default' },
          { text: 'OK', variant: 'primary' },
        ],
      })

      expect(modalState.visible.value).toBe(true)
      expect(modalState.title.value).toBe('Test Title')
      expect(modalState.message.value).toBe('Test Message')
      expect(modalState.showClose.value).toBe(false)
      expect(modalState.closeOnClickMask.value).toBe(false)
      expect(modalState.buttons.value.length).toBe(2)
      expect(modalState.buttons.value[0].text).toBe('Cancel')
      expect(modalState.buttons.value[1].text).toBe('OK')

      // Close modal to resolve promise
      closeModal(true)
      const result = await promise
      expect(result).toBe(true)
    })

    it('uses default values when options are minimal', async () => {
      const promise = showModal({})

      expect(modalState.visible.value).toBe(true)
      expect(modalState.title.value).toBe('提示')
      expect(modalState.message.value).toBe('')
      expect(modalState.showClose.value).toBe(true)
      expect(modalState.closeOnClickMask.value).toBe(true)
      // Should have default button
      expect(modalState.buttons.value.length).toBe(1)
      expect(modalState.buttons.value[0].text).toBe('确定')
      expect(modalState.buttons.value[0].variant).toBe('primary')

      closeModal()
      await promise
    })

    it('handles empty buttons array by providing default button', async () => {
      const promise = showModal({ buttons: [] })

      expect(modalState.buttons.value.length).toBe(1)
      expect(modalState.buttons.value[0].text).toBe('确定')

      closeModal()
      await promise
    })
  })

  describe('showAlert', () => {
    it('shows alert with message and default title', async () => {
      const promise = showAlert('Alert Message')

      expect(modalState.visible.value).toBe(true)
      expect(modalState.title.value).toBe('提示')
      expect(modalState.message.value).toBe('Alert Message')
      expect(modalState.buttons.value.length).toBe(1)
      expect(modalState.buttons.value[0].text).toBe('确定')

      closeModal(true)
      await promise
    })

    it('shows alert with custom title', async () => {
      const promise = showAlert('Message', 'Custom Title')

      expect(modalState.title.value).toBe('Custom Title')
      expect(modalState.message.value).toBe('Message')

      closeModal(true)
      await promise
    })

    it('returns void (undefined) after close', async () => {
      const promise = showAlert('Test')
      closeModal(true)
      const result = await promise
      expect(result).toBeUndefined()
    })
  })

  describe('showConfirm', () => {
    it('shows confirm with default button texts', async () => {
      const promise = showConfirm('Are you sure?')

      expect(modalState.visible.value).toBe(true)
      expect(modalState.title.value).toBe('确认')
      expect(modalState.message.value).toBe('Are you sure?')
      expect(modalState.buttons.value.length).toBe(2)
      expect(modalState.buttons.value[0].text).toBe('取消')
      expect(modalState.buttons.value[0].variant).toBe('default')
      expect(modalState.buttons.value[1].text).toBe('确定')
      expect(modalState.buttons.value[1].variant).toBe('primary')

      closeModal(true)
      const result = await promise
      expect(result).toBe(true)
    })

    it('shows confirm with custom title and button texts', async () => {
      const promise = showConfirm('Delete?', 'Confirm Delete', 'Yes', 'No')

      expect(modalState.title.value).toBe('Confirm Delete')
      expect(modalState.buttons.value[0].text).toBe('No')
      expect(modalState.buttons.value[1].text).toBe('Yes')

      closeModal(false)
      const result = await promise
      expect(result).toBe(false)
    })
  })

  describe('showConfirmDanger', () => {
    it('shows danger confirm with red confirm button', async () => {
      const promise = showConfirmDanger('Delete this item?')

      expect(modalState.visible.value).toBe(true)
      expect(modalState.title.value).toBe('确认')
      expect(modalState.buttons.value.length).toBe(2)
      expect(modalState.buttons.value[0].variant).toBe('default')
      expect(modalState.buttons.value[1].variant).toBe('danger')

      closeModal(true)
      const result = await promise
      expect(result).toBe(true)
    })

    it('shows danger confirm with custom texts', async () => {
      const promise = showConfirmDanger('Really delete?', 'Warning', 'Delete', 'Keep')

      expect(modalState.title.value).toBe('Warning')
      expect(modalState.buttons.value[0].text).toBe('Keep')
      expect(modalState.buttons.value[1].text).toBe('Delete')
      expect(modalState.buttons.value[1].variant).toBe('danger')

      closeModal(false)
      await promise
    })
  })

  describe('closeModal', () => {
    it('closes modal and resolves with false by default', async () => {
      const promise = showModal({})

      closeModal()

      expect(modalState.visible.value).toBe(false)
      
      // Wait for microtask
      await Promise.resolve()
      const result = await promise
      expect(result).toBe(false)
    })

    it('closes modal and resolves with provided result', async () => {
      const promise = showModal({})

      closeModal(true)

      expect(modalState.visible.value).toBe(false)
      
      await Promise.resolve()
      const result = await promise
      expect(result).toBe(true)
    })

    it('clears resolve function after calling', async () => {
      showModal({})

      expect(modalState.resolve).not.toBeNull()

      closeModal()

      // After nextTick, resolve should be null
      await Promise.resolve()
      expect(modalState.resolve).toBeNull()
    })

    it('does nothing if resolve is null', () => {
      modalState.resolve = null
      modalState.visible.value = true

      // Should not throw
      closeModal()

      expect(modalState.visible.value).toBe(false)
    })
  })

  describe('button handlers', () => {
    it('initializes button loading to false', async () => {
      const promise = showModal({
        buttons: [
          { text: 'Test', variant: 'primary', handler: () => true },
        ],
      })

      expect(modalState.buttons.value[0].loading).toBe(false)

      closeModal()
      await promise
    })

    it('preserves button handler function', async () => {
      const handler = vi.fn(() => true)
      const promise = showModal({
        buttons: [{ text: 'Test', handler }],
      })

      expect(modalState.buttons.value[0].handler).toBe(handler)

      closeModal()
      await promise
    })

    it('handles undefined handler', async () => {
      const promise = showModal({
        buttons: [{ text: 'Test' }],
      })

      expect(modalState.buttons.value[0].handler).toBeUndefined()

      closeModal()
      await promise
    })
  })

  describe('button handler invocation', () => {
    it('showAlert button handler returns true when invoked', async () => {
      const promise = showAlert('Test message')
      
      // Get the button handler and invoke it
      const handler = modalState.buttons.value[0].handler
      expect(handler).toBeDefined()
      const result = handler!()
      expect(result).toBe(true)
      
      closeModal(true)
      await promise
    })

    it('showConfirm cancel button handler returns false', async () => {
      const promise = showConfirm('Test?')
      
      // Cancel button is first
      const cancelHandler = modalState.buttons.value[0].handler
      expect(cancelHandler).toBeDefined()
      const result = cancelHandler!()
      expect(result).toBe(false)
      
      closeModal(false)
      await promise
    })

    it('showConfirm confirm button handler returns true', async () => {
      const promise = showConfirm('Test?')
      
      // Confirm button is second
      const confirmHandler = modalState.buttons.value[1].handler
      expect(confirmHandler).toBeDefined()
      const result = confirmHandler!()
      expect(result).toBe(true)
      
      closeModal(true)
      await promise
    })

    it('showConfirmDanger cancel button handler returns false', async () => {
      const promise = showConfirmDanger('Delete?')
      
      // Cancel button is first
      const cancelHandler = modalState.buttons.value[0].handler
      expect(cancelHandler).toBeDefined()
      const result = cancelHandler!()
      expect(result).toBe(false)
      
      closeModal(false)
      await promise
    })

    it('showConfirmDanger confirm button handler returns true', async () => {
      const promise = showConfirmDanger('Delete?')
      
      // Confirm button is second
      const confirmHandler = modalState.buttons.value[1].handler
      expect(confirmHandler).toBeDefined()
      const result = confirmHandler!()
      expect(result).toBe(true)
      
      closeModal(true)
      await promise
    })
  })
})

