import { ref } from 'vue'

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
  resolve: null as ((value: boolean) => void) | null
}

// 显示Modal
export function showModal(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    modalState.title.value = options.title || '提示'
    modalState.message.value = options.message || ''
    modalState.showClose.value = options.showClose !== false
    modalState.closeOnClickMask.value = options.closeOnClickMask !== false

    if (options.buttons && options.buttons.length > 0) {
      modalState.buttons.value = options.buttons.map((btn) => ({
        text: btn.text,
        variant: btn.variant || 'default',
        handler: btn.handler,
        loading: false
      }))
    } else {
      modalState.buttons.value = [
        {
          text: '确定',
          variant: 'primary',
          handler: undefined,
          loading: false
        }
      ]
    }

    modalState.resolve = resolve
    modalState.visible.value = true
  })
}

// 显示Alert（只有确定按钮）
export function showAlert(message: string, title: string = '提示'): Promise<void> {
  return showModal({
    title,
    message,
    buttons: [
      {
        text: '确定',
        variant: 'primary',
        handler: () => true
      }
    ]
  }).then(() => {})
}

// 显示Confirm（确定+取消按钮）
export function showConfirm(
  message: string,
  title: string = '确认',
  confirmText: string = '确定',
  cancelText: string = '取消'
): Promise<boolean> {
  return showModal({
    title,
    message,
    buttons: [
      {
        text: cancelText,
        variant: 'default',
        handler: () => false
      },
      {
        text: confirmText,
        variant: 'primary',
        handler: () => true
      }
    ]
  })
}

// 显示危险操作确认（红色确定按钮）
export function showConfirmDanger(
  message: string,
  title: string = '确认',
  confirmText: string = '确定',
  cancelText: string = '取消'
): Promise<boolean> {
  return showModal({
    title,
    message,
    buttons: [
      {
        text: cancelText,
        variant: 'default',
        handler: () => false
      },
      {
        text: confirmText,
        variant: 'danger',
        handler: () => true
      }
    ]
  })
}

// 关闭Modal
export function closeModal(result: boolean = false, shouldReload: boolean = false) {
  // 先更新visible状态，触发响应式更新
  modalState.visible.value = false
  // 然后resolve Promise
  if (modalState.resolve) {
    const resolveFn = modalState.resolve
    modalState.resolve = null
    // 使用nextTick确保DOM更新完成后再resolve
    Promise.resolve().then(() => {
      resolveFn(result)
      // 如果需要刷新页面
      if (shouldReload) {
        window.location.reload()
      }
    })
  } else if (shouldReload) {
    // 如果没有resolve函数，直接刷新
    window.location.reload()
  }
}

