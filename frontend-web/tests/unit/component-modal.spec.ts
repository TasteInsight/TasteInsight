import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref, reactive } from 'vue'

// Create mock state - these will be populated in beforeEach
let mockModalState: any
let mockCloseModal: ReturnType<typeof vi.fn>

// Setup the mock before importing the component
vi.mock('@/composables/useModal', () => ({
  get modalState() {
    return mockModalState
  },
  get closeModal() {
    return mockCloseModal
  },
}))

import Modal from '../../src/components/Common/Modal.vue'

describe('components/Common/Modal', () => {
  beforeEach(() => {
    // Reset mocks for each test
    mockModalState = {
      visible: ref(false),
      title: ref(''),
      message: ref(''),
      buttons: ref<any[]>([]),
      showClose: ref(true),
      closeOnClickMask: ref(true),
    }
    mockCloseModal = vi.fn()
  })

  describe('Visibility', () => {
    it('renders when visible prop is true', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '测试标题',
          message: '测试消息',
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.text()).toContain('测试标题')
      expect(wrapper.text()).toContain('测试消息')
    })

    it('renders when modalState.visible is true', async () => {
      mockModalState.visible.value = true
      mockModalState.title.value = '全局标题'
      mockModalState.message.value = '全局消息'

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.text()).toContain('全局标题')
      expect(wrapper.text()).toContain('全局消息')
    })

    it('does not render when both visible prop and modalState are false', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: false,
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.find('.fixed').exists()).toBe(false)
    })
  })

  describe('Close Button', () => {
    it('shows close button when showClose is true', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          showClose: true,
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const closeBtn = wrapper.find('button .iconify[data-icon="carbon:close"]')
      expect(closeBtn.exists()).toBe(true)
    })

    it('hides close button when showClose is false', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          showClose: false,
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const closeBtn = wrapper.find('button .iconify[data-icon="carbon:close"]')
      expect(closeBtn.exists()).toBe(false)
    })

    it('closes modal when close button is clicked with props', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const closeBtn = wrapper.find('button .iconify[data-icon="carbon:close"]').element.parentElement as HTMLButtonElement
      await closeBtn.click()
      await nextTick()

      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('closes modal when close button is clicked with global state', async () => {
      mockModalState.visible.value = true
      mockModalState.title.value = '全局标题'

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const closeBtn = wrapper.find('button .iconify[data-icon="carbon:close"]').element.parentElement as HTMLButtonElement
      await closeBtn.click()
      await nextTick()

      expect(mockCloseModal).toHaveBeenCalledWith(false)
    })
  })

  describe('Mask Click', () => {
    it('closes modal when clicking mask with closeOnClickMask true', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          closeOnClickMask: true,
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const mask = wrapper.find('.fixed.inset-0')
      await mask.trigger('click')
      await nextTick()

      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
    })

    it('does not close modal when clicking mask with closeOnClickMask false', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          closeOnClickMask: false,
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const mask = wrapper.find('.fixed.inset-0')
      await mask.trigger('click')
      await nextTick()

      expect(wrapper.emitted('update:visible')).toBeUndefined()
    })

    it('does not close on mask click when content is clicked', async () => {
      // Test that clicking on the modal content (not the mask) doesn't close the modal
      mockModalState.visible.value = true
      mockModalState.title.value = '标题'

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      // Click on modal content (inner div), not the mask
      const modalContent = wrapper.find('.bg-white.rounded-lg')
      await modalContent.trigger('click')
      await nextTick()

      // Should NOT close because we clicked on content, not mask
      expect(mockCloseModal).not.toHaveBeenCalled()
    })
  })

  describe('Buttons', () => {
    it('renders buttons from props', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          buttons: [
            { text: '取消', variant: 'secondary' },
            { text: '确定', variant: 'primary' },
          ],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const buttons = wrapper.findAll('.bg-gray-50 button')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].text()).toBe('取消')
      expect(buttons[1].text()).toBe('确定')
    })

    it('renders buttons from global state', async () => {
      mockModalState.visible.value = true
      mockModalState.buttons.value = [
        { text: '删除', variant: 'danger' },
      ]

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const buttons = wrapper.findAll('.bg-gray-50 button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].text()).toBe('删除')
      expect(buttons[0].classes()).toContain('bg-red-600')
    })

    it('applies correct variant classes', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          buttons: [
            { text: '次要', variant: 'secondary' },
            { text: '主要', variant: 'primary' },
            { text: '危险', variant: 'danger' },
          ],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const buttons = wrapper.findAll('.bg-gray-50 button')
      expect(buttons[0].classes()).toContain('bg-white')
      expect(buttons[1].classes()).toContain('bg-tsinghua-purple')
      expect(buttons[2].classes()).toContain('bg-red-600')
    })

    it('calls button handler when clicked', async () => {
      const handler = vi.fn(() => true)

      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          buttons: [{ text: '确定', variant: 'primary', handler }],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await nextTick()

      expect(handler).toHaveBeenCalled()
      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
    })

    it('handles async button handler', async () => {
      mockModalState.visible.value = true
      mockModalState.buttons.value = [
        { text: '确定', variant: 'primary', handler: () => Promise.resolve(true) },
      ]

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await flushPromises()

      expect(mockCloseModal).toHaveBeenCalledWith(true)
    })

    it('handles button handler returning false', async () => {
      const handler = vi.fn(() => false)

      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          buttons: [{ text: '取消', variant: 'secondary', handler }],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await nextTick()

      expect(handler).toHaveBeenCalled()
      // Should still close, result is false
      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
    })

    it('handles button handler error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      mockModalState.visible.value = true
      mockModalState.buttons.value = [
        { text: '确定', variant: 'primary', handler: () => { throw new Error('test error') } },
      ]

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledWith('Button handler error:', expect.any(Error))
      // Should not close on error
      expect(mockCloseModal).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('prevents double click when loading', async () => {
      mockModalState.visible.value = true
      mockModalState.buttons.value = [
        { text: '确定', variant: 'primary', loading: true, handler: () => true },
      ]

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await nextTick()

      // Handler should not be called when loading
      expect(mockCloseModal).not.toHaveBeenCalled()
    })

    it('shows loading spinner when button is loading', async () => {
      mockModalState.visible.value = true
      mockModalState.buttons.value = [
        { text: '确定', variant: 'primary', loading: true },
      ]

      const wrapper = mount(Modal, {
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const loadingIcon = wrapper.find('.bg-gray-50 button .iconify[data-icon="mdi:loading"]')
      expect(loadingIcon.exists()).toBe(true)
    })

    it('button without handler closes modal', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
          buttons: [{ text: '确定', variant: 'primary' }],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      const button = wrapper.find('.bg-gray-50 button')
      await button.trigger('click')
      await nextTick()

      expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
    })
  })

  describe('Computed Properties', () => {
    it('modalTitle uses props.title when provided', async () => {
      mockModalState.title.value = '全局标题'

      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: 'Props标题',
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.text()).toContain('Props标题')
    })

    it('modalMessage uses props.message when provided', async () => {
      mockModalState.message.value = '全局消息'

      const wrapper = mount(Modal, {
        props: {
          visible: true,
          message: 'Props消息',
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.text()).toContain('Props消息')
    })

    it('modalButtons uses props.buttons when provided', async () => {
      mockModalState.buttons.value = [{ text: '全局按钮' }]

      const wrapper = mount(Modal, {
        props: {
          visible: true,
          buttons: [{ text: 'Props按钮' }],
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.text()).toContain('Props按钮')
      expect(wrapper.text()).not.toContain('全局按钮')
    })
  })

  describe('Slots', () => {
    it('renders default slot content', async () => {
      const wrapper = mount(Modal, {
        props: {
          visible: true,
          title: '标题',
        },
        slots: {
          default: '<div class="custom-content">自定义内容</div>',
        },
        global: {
          stubs: {
            Teleport: true,
            Transition: false,
          },
        },
      })

      expect(wrapper.find('.custom-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('自定义内容')
    })
  })
})
