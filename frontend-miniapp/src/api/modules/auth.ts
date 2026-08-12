import type { ApiResponse, LoginData } from '@/types/api';
import request from '@/utils/request';

/**
 * @summary 刷新Token
 * @description 供显式调用场景使用；必须传入 refresh token
 * @returns {Promise<LoginResponse>}
 */
export const refreshToken = (refreshTokenValue: string): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: '/auth/refresh',
    method: 'POST',
    data: {},
    header: { Authorization: `Bearer ${refreshTokenValue}` },
  });
};
