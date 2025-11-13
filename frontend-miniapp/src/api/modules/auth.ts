import type { ApiResponse , LoginData} from '@/types/api';
import request from '@/utils/request';

/**
 * @summary 微信登录
 * @description 使用微信授权码登录，获取JWT Token
 * @param {string} code - 微信授权码
 * @returns {Promise<LoginResponse>}
 */
export const wechatLogin = (
  code : string
): Promise<ApiResponse<LoginData>> => {
  return request<ApiResponse<LoginData>>({
    url: '/auth/wechat/login',
    method: 'POST',
    data: { code },
  });
};

/**
 * @summary 刷新Token
 * @description 使用当前Token刷新获取新Token
 * @returns {Promise<LoginResponse>}
 */
export const refreshToken = (
): Promise<ApiResponse<LoginData>> => {
  return request<ApiResponse<LoginData>>({
    url: '/auth/refresh',
    method: 'POST',
    data: { },
  });
};