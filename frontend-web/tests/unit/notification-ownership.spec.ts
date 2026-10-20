import { beforeEach, describe, expect, it, vi } from 'vitest'
import { showConfirm, closeModal, modalState, cancelModals } from '@/composables/useModal'
import { notify, useNotification } from '@/composables/useNotification'
import { invalidateAuthSession } from '@/utils/auth-session'
import { toast } from 'vue-sonner'

describe('notification ownership', () => {
  beforeEach(() => {
    cancelModals()
    toast.dismiss()
  })
  it('queues confirmations and resolves both callers in order', async () => {
    const first = showConfirm('第一项')
    const second = showConfirm('第二项')
    expect(modalState.message.value).toBe('第一项')
    closeModal(true)
    expect(await first).toBe(true)
    await Promise.resolve()
    expect(modalState.message.value).toBe('第二项')
    closeModal(false)
    expect(await second).toBe(false)
  })
  it('cancels every pending confirmation when the account changes', async () => {
    const first = showConfirm('第一项')
    const second = showConfirm('第二项')
    invalidateAuthSession()
    await expect(Promise.all([first, second])).resolves.toEqual([false, false])
    expect(modalState.visible.value).toBe(false)
  })
  it('drops feedback produced by an old account operation after the session changes', () => {
    const spy = vi.spyOn(toast, 'error')
    const owned = useNotification()
    invalidateAuthSession()
    owned.error('旧账号操作失败')
    expect(spy).not.toHaveBeenCalled()
  })
  it('keeps a success notification from replacing an active confirmation', () => {
    const spy = vi.spyOn(toast, 'success')
    void showConfirm('确认停用')
    notify.success('保存成功')
    expect(modalState.message.value).toBe('确认停用')
    expect(spy).toHaveBeenCalledWith('保存成功', expect.any(Object))
  })
})
