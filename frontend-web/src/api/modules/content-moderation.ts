import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export type ModerationProvider = 'aliyun' | 'wechat'
export type ModerationMode = 'manual' | 'machine' | 'machine_and_manual'
export interface ModerationPolicy {
  enabled: boolean
  provider: ModerationProvider
  mode: ModerationMode
}
export interface ModerationSettings extends ModerationPolicy {
  mediaConfigured?: boolean
  mediaMissing?: string[]
  providers: Record<ModerationProvider, { configured: boolean; missing: string[] }>
}
export interface ModerationTask {
  id: string
  targetType: string
  targetId: string
  userId: string
  provider: ModerationProvider
  mode: ModerationMode
  status: string
  text: string
  images: string[]
  createdAt: string
  reason?: string
}
export interface ModerationTasks {
  items: ModerationTask[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}
export const contentModerationApi = {
  getPolicy: () => request.get<ApiResponse<ModerationPolicy>>('/admin/content-moderation/policy'),
  getSettings: () => request.get<ApiResponse<ModerationSettings>>('/admin/content-moderation/settings'),
  updateSettings: (data: ModerationPolicy) => request.put<ApiResponse<ModerationSettings>>('/admin/content-moderation/settings', data),
  getTasks: (params: { status: 'manual' | 'failed'; page: number; pageSize: number }) =>
    request.get<ApiResponse<ModerationTasks>>('/admin/content-moderation/tasks', { params }),
  decide: (id: string, data: { approved: boolean; reason?: string }) =>
    request.post<ApiResponse<null>>(`/admin/content-moderation/tasks/${encodeURIComponent(id)}/decision`, data),
}
