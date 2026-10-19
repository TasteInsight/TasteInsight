import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'
export interface NewsSource {
  id: string
  mpId: string
  name: string
  canteenId: string | null
  canteen?: { name: string } | null
  autoPublish: boolean
  enabled: boolean
  intervalMinutes: number
  keyword: string
  lastSyncAt: string | null
  lastError: string | null
  lastImportedCount: number
  syncLeaseUntil: string | null
}
export interface SourceInput {
  autoPublish: boolean
  canteenId: string | null
  enabled: boolean
  intervalMinutes: number
  keyword: string
}
export interface NewsSourceCapabilities {
  configured: boolean
  adminUrl: string | null
}
export const newsSourcesApi = {
  capabilities: () =>
    request.get<ApiResponse<NewsSourceCapabilities>>('/admin/news-sources/capabilities'),
  list: () =>
    request.get<ApiResponse<{ configured: boolean; adminUrl: string | null; items: NewsSource[] }>>(
      '/admin/news-sources',
    ),
  feeds: () =>
    request.get<ApiResponse<{ id: string; name: string }[]>>('/admin/news-sources/feeds'),
  create: (data: SourceInput & { mpId: string }) =>
    request.post<ApiResponse<NewsSource>>('/admin/news-sources', data),
  update: (id: string, data: SourceInput) =>
    request.put<ApiResponse<NewsSource>>(`/admin/news-sources/${id}`, data),
  sync: (id: string) =>
    request.post<ApiResponse<{ queued: boolean }>>(`/admin/news-sources/${id}/sync`),
}
