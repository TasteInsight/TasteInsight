import { watch } from 'vue'
import { toast } from 'vue-sonner'
import { authSessionVersion, getAuthSessionVersion } from '@/utils/auth-session'

type NotificationKind = 'success' | 'error' | 'info'
function show(kind: NotificationKind, message: string, title?: string) {
  const options = {
    id: `${kind}:${message}`,
    duration: message.length > 180 ? Infinity : kind === 'error' ? 8000 : 4500,
    ...(title ? { description: message } : {}),
  }
  toast[kind](title || message, options)
}

export const notify = {
  success: (message: string, title?: string) => show('success', message, title),
  error: (message: string, title?: string) => show('error', message, title),
  info: (message: string, title?: string) => show('info', message, title),
}

export function useNotification() {
  const owner = getAuthSessionVersion()
  const owned = (kind: NotificationKind, message: string, title?: string) => {
    if (owner === getAuthSessionVersion()) show(kind, message, title)
  }
  return {
    success: (message: string, title?: string) => owned('success', message, title),
    error: (message: string, title?: string) => owned('error', message, title),
    info: (message: string, title?: string) => owned('info', message, title),
  }
}

watch(authSessionVersion, () => toast.dismiss(), { flush: 'sync' })
