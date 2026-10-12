import request from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types/api'
import type {
  CommunityContent,
  CommunityContentType,
  CommunityModeration,
  CommunityQuery,
} from '@/types/community'

export const communityApi = {
  list(
    type: CommunityContentType,
    params: CommunityQuery,
    signal?: AbortSignal,
  ): Promise<ApiResponse<PaginationResponse<CommunityContent>>> {
    return request.get(`/admin/${type}`, { params, signal })
  },
  approve(
    type: CommunityContentType,
    id: string,
    data: CommunityModeration,
  ): Promise<ApiResponse<void>> {
    return request.post(`/admin/${type}/${encodeURIComponent(id)}/approve`, data)
  },
  reject(
    type: CommunityContentType,
    id: string,
    data: CommunityModeration & { reason: string },
  ): Promise<ApiResponse<void>> {
    return request.post(`/admin/${type}/${encodeURIComponent(id)}/reject`, data)
  },
  delete(type: CommunityContentType, id: string): Promise<ApiResponse<void>> {
    return request.delete(`/admin/${type}/${encodeURIComponent(id)}`)
  },
}
