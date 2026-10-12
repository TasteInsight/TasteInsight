import request from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types/api'
import type {
  StudentDecision,
  StudentVerification,
  StudentVerificationStatus,
} from '@/types/student-verification'

export const studentVerificationApi = {
  list(
    params: { page: number; pageSize: number; status: StudentVerificationStatus },
    signal?: AbortSignal,
  ): Promise<ApiResponse<PaginationResponse<StudentVerification>>> {
    return request.get('/admin/student-verifications', { params, signal })
  },
  decide(userId: string, data: StudentDecision): Promise<ApiResponse<unknown>> {
    return request.post(`/admin/student-verifications/${encodeURIComponent(userId)}/decision`, data)
  },
}
