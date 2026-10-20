import { ref, watch } from 'vue'
import { authSessionVersion } from '@/utils/auth-session'

let modalRequest = 0
let opener: HTMLElement | null = null
const pending: {
  options: ModalOptions
  resolve: (value: boolean) => void
  opener: HTMLElement | null
}[] = []

export interface ButtonConfig {
  text: string
  variant?: 'primary' | 'danger' | 'default'
  handler?: () => void | boolean | Promise<boolean>
  loading?: boolean
}

export interface ModalOptions {
  title?: string
  message?: string
  buttons?: ButtonConfig[]
  showClose?: boolean
  closeOnClickMask?: boolean
}

// 全局Modal状态
export const modalState = {
  visible: ref(false),
  title: ref('提示'),
  message: ref(''),
  buttons: ref<ButtonConfig[]>([]),
  showClose: ref(true),
  closeOnClickMask: ref(true),
  resolve: null as ((value: boolean) => void) | null,
}

// 显示Modal
export function showModal(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const request = {
      options,
      resolve,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }
    if (modalState.visible.value) pending.push(request)
    else activate(request)
  })
}

function activate(request: (typeof pending)[number]) {
  modalRequest += 1
  opener = request.opener
  const { options, resolve } = request
  modalState.title.value = options.title || '提示'
  modalState.message.value = options.message || ''
  modalState.showClose.value = options.showClose !== false
  modalState.closeOnClickMask.value = options.closeOnClickMask !== false

  if (options.buttons && options.buttons.length > 0) {
    modalState.buttons.value = options.buttons.map((btn) => ({
      text: btn.text,
      variant: btn.variant || 'default',
      handler: btn.handler,
      loading: false,
    }))
  } else {
    modalState.buttons.value = [
      {
        text: '确定',
        variant: 'primary',
        handler: undefined,
        loading: false,
      },
    ]
  }

  modalState.resolve = resolve
  modalState.visible.value = true
}

// 显示Confirm（确定+取消按钮）
export function showConfirm(
  message: string,
  title: string = '确认',
  confirmText: string = '确定',
  cancelText: string = '取消',
): Promise<boolean> {
  return showModal({
    title,
    message,
    buttons: [
      {
        text: cancelText,
        variant: 'default',
        handler: () => false,
      },
      {
        text: confirmText,
        variant: 'primary',
        handler: () => true,
      },
    ],
  })
}

// 显示危险操作确认（红色确定按钮）
export function showConfirmDanger(
  message: string,
  title: string = '确认',
  confirmText: string = '确定',
  cancelText: string = '取消',
): Promise<boolean> {
  return showModal({
    title,
    message,
    buttons: [
      {
        text: cancelText,
        variant: 'default',
        handler: () => false,
      },
      {
        text: confirmText,
        variant: 'danger',
        handler: () => true,
      },
    ],
  })
}

// 关闭Modal
export function closeModal(result: boolean = false) {
  const closedRequest = modalRequest
  const returnTarget = opener
  opener = null
  // 先更新visible状态，触发响应式更新
  modalState.visible.value = false
  // 然后resolve Promise
  if (modalState.resolve) {
    const resolveFn = modalState.resolve
    modalState.resolve = null
    // 使用nextTick确保DOM更新完成后再resolve
    Promise.resolve().then(() => {
      resolveFn(result)
    })
  }
  requestAnimationFrame(() => {
    const active = document.activeElement
    const nativeNeedsRecovery = active === document.body || active instanceof HTMLDialogElement
    if (
      closedRequest === modalRequest &&
      !modalState.visible.value &&
      nativeNeedsRecovery &&
      returnTarget?.isConnected &&
      !returnTarget.matches(':disabled') &&
      !returnTarget.closest('[inert]')
    ) {
      returnTarget.focus({ preventScroll: true })
    }
  })
  Promise.resolve().then(() => {
    if (!modalState.visible.value && pending.length) activate(pending.shift()!)
  })
}

export function cancelModals() {
  for (const request of pending.splice(0)) request.resolve(false)
  closeModal(false)
}

watch(authSessionVersion, cancelModals, { flush: 'sync' })
