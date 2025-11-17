import request from '@/utils/request'
import type { 
  PaginationResponse,
  ApiResponse,
  LogQueryParams,
  OperationLog
} from '@/types/api'

/**
 * 日志管理 API
 */
export const logApi = {
  /**
   * 获取日志列表
   * @param params 查询参数
   * @returns 日志列表
   */
  async getLogs(params: LogQueryParams = {}): Promise<ApiResponse<PaginationResponse<OperationLog>>> {
    return await request.get<ApiResponse<PaginationResponse<OperationLog>>>('/admin/logs', { params });
  }
}

export default logApi
