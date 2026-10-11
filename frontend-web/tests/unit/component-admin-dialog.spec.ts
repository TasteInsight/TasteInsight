import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, onActivated, ref } from 'vue'
import AdminDialog from '../../src/components/Common/AdminDialog.vue'

enableAutoUnmount(afterEach)

const panel = '<section><h2 id="dialog-title">编辑菜品</h2><input aria-label="菜品名称"><button>保存</button></section>'

function mountDialog(props: Partial<{
  open: boolean
  label: string
  labelledby: string
  closeOnBackdrop: boolean
  closeOnEscape: boolean
}> = {}) {
  return mount(AdminDialog, {
    props: { open: true, label: '编辑菜品', ...props },
    slots: { default: panel },
    global: { stubs: { Teleport: true } },
  })
}

function mountCachedDialogs(initiallyOpen = false) {
  const showPage = ref(true)
  const detailOpen = ref(initiallyOpen)
  const previewOpen = ref(initiallyOpen)
  const previewMounted = ref(true)
  let onPageActivated = () => {}
  const Page = defineComponent({
    setup() {
      onActivated(() => onPageActivated())
      return () => h('div', [
        h(AdminDialog, { open: detailOpen.value, label: '详情' }, () => h('input')),
        previewMounted.value
          ? h(AdminDialog, { open: previewOpen.value, label: '图片预览' }, () => h('button', '关闭图片'))
          : null,
        h(AdminDialog, { open: false, label: '备用弹窗' }),
      ])
    },
  })
  const OtherPage = defineComponent({ template: '<div>其他页面</div>' })
  const wrapper = mount(defineComponent({
    setup: () => () => h(KeepAlive, null, { default: () => h(showPage.value ? Page : OtherPage) }),
  }))

  return {
    wrapper, showPage, detailOpen, previewOpen, previewMounted,
    onActivation(callback: () => void) { onPageActivated = callback },
  }
}

async function settleDialogs() {
  await nextTick()
  await nextTick()
}

describe('components/Common/AdminDialog', () => {
  it('opens with showModal and does not reopen when its label changes', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const wrapper = mount(AdminDialog, {
      props: { open: true, label: '编辑菜品' },
      slots: { default: panel },
    })
    const dialog = document.querySelector('dialog') as HTMLDialogElement
    const input = dialog.querySelector('input')!
    input.focus()

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(dialog.open).toBe(true)
    expect(dialog.getAttribute('aria-label')).toBe('编辑菜品')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    await wrapper.setProps({ label: '修改菜品' })

    expect(wrapper.props('label')).toBe('修改菜品')
    expect(document.querySelector('dialog')).toBe(dialog)
    expect(dialog.getAttribute('aria-label')).toBe('修改菜品')
    expect(document.activeElement).toBe(input)
    expect(showModal).toHaveBeenCalledTimes(1)
  })

  it('waits for the panel to render before opening after a prop change', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const wrapper = mountDialog({ open: false })

    expect(showModal).not.toHaveBeenCalled()
    expect(wrapper.find('input').exists()).toBe(false)

    await wrapper.setProps({ open: true })
    await nextTick()

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(wrapper.find('input').exists()).toBe(true)
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it('closes natively before removing the panel and does not emit a second close', async () => {
    const wrapper = mountDialog()
    const dialog = wrapper.get('dialog').element as HTMLDialogElement
    const panelPresentAtClose: boolean[] = []
    dialog.addEventListener('close', () => panelPresentAtClose.push(!!dialog.querySelector('input')))

    await wrapper.setProps({ open: false })

    expect(dialog.open).toBe(false)
    expect(panelPresentAtClose).toEqual([true])
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('does not open after the owner cancels an opening update', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const wrapper = mountDialog({ open: false })

    const opening = wrapper.setProps({ open: true })
    const closing = wrapper.setProps({ open: false })
    await Promise.all([opening, closing])
    await nextTick()

    expect(showModal).not.toHaveBeenCalled()
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
  })

  it('supports heading references and forwards caller attributes to the dialog', () => {
    const wrapper = mount(AdminDialog, {
      props: { open: true, labelledby: 'dialog-title' },
      attrs: { class: 'text-gray-900', 'data-testid': 'dish-dialog' },
      slots: { default: panel },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe('dialog-title')
    expect(wrapper.get('dialog').attributes('data-testid')).toBe('dish-dialog')
    expect(wrapper.get('dialog').classes()).toContain('text-gray-900')
  })

  it('requests close for a backdrop click but not a panel click', async () => {
    const wrapper = mountDialog()

    await wrapper.get('section').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('dialog').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('preserves an open dialog when backdrop dismissal is disabled', async () => {
    const wrapper = mountDialog({ closeOnBackdrop: false })

    await wrapper.get('dialog').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it.each([true, false])('prevents native cancellation and applies closeOnEscape=%s', (allowed) => {
    const wrapper = mountDialog({ closeOnEscape: allowed })
    const event = new Event('cancel', { cancelable: true })

    wrapper.get('dialog').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('close')?.length ?? 0).toBe(allowed ? 1 : 0)
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it('teleports nested dialogs to independent body roots and only dismisses the child', async () => {
    const childOpen = ref(false)
    const closeParent = vi.fn()
    const closeChild = vi.fn(() => { childOpen.value = false })
    const wrapper = mount(AdminDialog, {
      props: { open: true, label: '父弹窗', onClose: closeParent },
      slots: {
        default: () => h('section', [h(AdminDialog, {
          open: childOpen.value,
          label: '子弹窗',
          onClose: closeChild,
        }, () => h('button', '关闭子弹窗'))]),
      },
    })

    childOpen.value = true
    await nextTick()
    await nextTick()
    const parent = document.querySelector('dialog[aria-label="父弹窗"]') as HTMLDialogElement
    const child = document.querySelector('dialog[aria-label="子弹窗"]') as HTMLDialogElement
    expect(parent.parentElement).toBe(document.body)
    expect(child.parentElement).toBe(document.body)

    child.dispatchEvent(new Event('cancel', { cancelable: true }))
    await nextTick()

    expect(closeChild).toHaveBeenCalledTimes(1)
    expect(closeParent).not.toHaveBeenCalled()
    expect(child.open).toBe(false)
    expect(parent.open).toBe(true)
    wrapper.unmount()
  })

  it('closes the native dialog on unmount without requesting an owner close', () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const wrapper = mountDialog()
    const dialog = wrapper.get('dialog').element as HTMLDialogElement

    wrapper.unmount()

    expect(close).toHaveBeenCalledTimes(1)
    expect(dialog.open).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('releases the top layer while deactivated and keeps the cached panel draft', async () => {
    const showPage = ref(true)
    const Page = defineComponent({
      components: { AdminDialog },
      template: '<AdminDialog :open="true" label="缓存编辑"><section><input /></section></AdminDialog>',
    })
    const OtherPage = defineComponent({ template: '<div>其他页面</div>' })
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const wrapper = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, { default: () => h(showPage.value ? Page : OtherPage) }),
    }), { attachTo: document.body, global: { stubs: { Teleport: true } } })
    const dialog = wrapper.get('dialog').element as HTMLDialogElement
    await wrapper.get('input').setValue('未保存的菜名')

    showPage.value = false
    await nextTick()

    expect(close).toHaveBeenCalledTimes(1)
    expect(dialog.open).toBe(false)

    showPage.value = true
    await settleDialogs()

    expect(dialog.open).toBe(true)
    expect(showModal).toHaveBeenCalledTimes(2)
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('未保存的菜名')
  })

  it('does not open from an inactive page update until the page is activated', async () => {
    const showPage = ref(true)
    const open = ref(false)
    const Page = defineComponent({
      setup: () => () => h(AdminDialog, { open: open.value, label: '缓存弹窗' }, () => h('input')),
    })
    const OtherPage = defineComponent({ template: '<div>其他页面</div>' })
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const wrapper = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, { default: () => h(showPage.value ? Page : OtherPage) }),
    }), { attachTo: document.body, global: { stubs: { Teleport: true } } })

    showPage.value = false
    await nextTick()
    open.value = true
    await nextTick()
    await nextTick()
    expect(showModal).not.toHaveBeenCalled()

    showPage.value = true
    await settleDialogs()

    expect(showModal).toHaveBeenCalledTimes(1)
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it('restores sibling dialogs in their logical opening order and retains the draft', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const cached = mountCachedDialogs()
    cached.detailOpen.value = true
    await settleDialogs()
    cached.previewOpen.value = true
    await settleDialogs()
    const detail = document.querySelector('dialog[aria-label="详情"]') as HTMLDialogElement
    const preview = document.querySelector('dialog[aria-label="图片预览"]') as HTMLDialogElement
    const input = detail.querySelector('input')!
    input.value = '未保存的草稿'
    expect(showModal.mock.contexts).toEqual([detail, preview])

    cached.showPage.value = false
    await settleDialogs()
    expect(detail.open).toBe(false)
    expect(preview.open).toBe(false)
    showModal.mockClear()

    cached.showPage.value = true
    await settleDialogs()

    expect(showModal.mock.contexts).toEqual([detail, preview])
    expect(detail.open).toBe(true)
    expect(preview.open).toBe(true)
    expect(input.value).toBe('未保存的草稿')
    expect(document.querySelector('dialog[aria-label="备用弹窗"]')?.hasAttribute('open')).toBe(false)
  })

  it('uses a new opening order after a logical close and reopen', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const cached = mountCachedDialogs(true)
    await settleDialogs()
    const detail = document.querySelector('dialog[aria-label="详情"]') as HTMLDialogElement
    const preview = document.querySelector('dialog[aria-label="图片预览"]') as HTMLDialogElement
    expect(showModal.mock.contexts).toEqual([detail, preview])

    cached.detailOpen.value = false
    await settleDialogs()
    cached.detailOpen.value = true
    await settleDialogs()
    cached.showPage.value = false
    await settleDialogs()
    showModal.mockClear()
    cached.showPage.value = true
    await settleDialogs()

    expect(showModal.mock.contexts).toEqual([preview, detail])
  })

  it.each(['close', 'unmount'] as const)('discards a queued preview when activation triggers %s', async (action) => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const cached = mountCachedDialogs(true)
    await settleDialogs()
    const detail = document.querySelector('dialog[aria-label="详情"]') as HTMLDialogElement
    const preview = document.querySelector('dialog[aria-label="图片预览"]') as HTMLDialogElement
    cached.showPage.value = false
    await settleDialogs()
    showModal.mockClear()
    cached.onActivation(() => {
      if (action === 'close') cached.previewOpen.value = false
      else cached.previewMounted.value = false
    })

    cached.showPage.value = true
    await settleDialogs()

    expect(showModal.mock.contexts).toEqual([detail])
    expect(preview.open).toBe(false)
    expect(preview.isConnected).toBe(action === 'close')
  })

  it('does not restore dialogs after their owner unmounts during the activation batch', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const cached = mountCachedDialogs(true)
    await settleDialogs()
    const dialogs = Array.from(document.querySelectorAll('dialog'))
    cached.showPage.value = false
    await settleDialogs()
    showModal.mockClear()

    cached.showPage.value = true
    await nextTick()
    cached.wrapper.unmount()
    await settleDialogs()

    expect(showModal).not.toHaveBeenCalled()
    expect(dialogs.every((dialog) => !dialog.open && !dialog.isConnected)).toBe(true)
  })
})
