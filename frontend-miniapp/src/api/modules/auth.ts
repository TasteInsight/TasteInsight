import type { ApiResponse, LoginData } from '@/types/api';
import request from '@/utils/request';

export interface LoginMethods {
  phone: boolean;
  wechatMiniapp: boolean;
  wechatApp: boolean;
  campusOAuth: boolean;
}
export interface CampusVerificationMethods {
  campusEmail: boolean;
  campusOAuth: boolean;
}
export interface AuthCapabilities {
  loginMethods?: LoginMethods;
  verificationMethods?: CampusVerificationMethods;
  phone: boolean;
  wechatMiniapp: boolean;
  wechatApp: boolean;
  campusEmail: boolean;
  campusOAuth: boolean;
}

export function loginMethods(capabilities: AuthCapabilities | null): LoginMethods {
  return (
    capabilities?.loginMethods ?? {
      phone: Boolean(capabilities?.phone),
      wechatMiniapp: Boolean(capabilities?.wechatMiniapp),
      wechatApp: Boolean(capabilities?.wechatApp),
      campusOAuth: false,
    }
  );
}
export function verificationMethods(
  capabilities: AuthCapabilities | null
): CampusVerificationMethods {
  return (
    capabilities?.verificationMethods ?? {
      campusEmail: Boolean(capabilities?.campusEmail),
      campusOAuth: Boolean(capabilities?.campusOAuth),
    }
  );
}

export interface CampusLoginStart {
  attemptId: string;
  authorizationUrl: string;
  expiresAt: string;
  loginVerifier: string;
}
export interface CampusLoginTicket {
  attemptId: string;
  handoffCode: string;
  loginVerifier: string;
}
export const startCampusLogin = () =>
  request<CampusLoginStart>({ url: '/auth/campus/oauth', method: 'POST', auth: 'none', data: {} });
export const campusLogin = (data: CampusLoginTicket) =>
  request<LoginData>({ url: '/auth/campus/login', method: 'POST', auth: 'none', data });

export interface VerificationChallenge {
  challengeId: string;
  expiresIn: number;
  retryAfter: number;
}

export interface StudentVerification {
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  method?: string;
  expiresAt?: string | null;
  email?: string;
  canContribute: boolean;
  reason?: string | null;
  updatedAt?: string;
}

export interface AccountIdentities {
  campusOAuth?: boolean;
  phone?: string;
  wechat: { miniapp: boolean; app: boolean };
}
export const getAccountIdentities = () => request<AccountIdentities>({ url: '/user/identities' });

export const getAuthCapabilities = () =>
  request<AuthCapabilities>({
    url: '/auth/capabilities',
    auth: 'none',
  });
function normalizePhone(phone: string): string {
  const compact = phone.trim().replace(/[\s-]/g, '');
  return /^1[3-9]\d{9}$/.test(compact) ? `+86${compact}` : compact;
}
export const sendPhoneCode = (phone: string) =>
  request<VerificationChallenge>({
    url: '/auth/phone/challenges',
    method: 'POST',
    auth: 'none',
    data: { phone: normalizePhone(phone) },
  });
export const phoneLogin = (challengeId: string, code: string) =>
  request<LoginData>({
    url: '/auth/phone/login',
    method: 'POST',
    auth: 'none',
    data: { challengeId, code },
  });
export const getStudentVerification = () =>
  request<StudentVerification>({
    url: '/user/student-verification',
  });
export const sendCampusEmailCode = (email: string) =>
  request<VerificationChallenge>({
    url: '/user/student-verification/email/challenges',
    method: 'POST',
    data: { email },
  });
export const verifyCampusEmail = (challengeId: string, code: string) =>
  request<StudentVerification>({
    url: '/user/student-verification',
    method: 'POST',
    data: { challengeId, code },
  });
export type CampusOAuthPurpose = 'VERIFICATION' | 'LOGIN_BIND';
export interface CampusOAuthStart {
  purpose?: CampusOAuthPurpose;
  attemptId: string;
  authorizationUrl: string;
  expiresAt: string;
  account: { id: string; nickname: string; phone?: string };
}
export const startCampusOAuth = () =>
  request<CampusOAuthStart>({
    url: '/user/student-verification/oauth',
    method: 'POST',
    data: {},
  });
export const startCampusLoginBinding = () =>
  request<CampusOAuthStart>({ url: '/user/identities/campus/oauth', method: 'POST', data: {} });
export const completeCampusLoginBinding = (attemptId: string, handoffCode: string) =>
  request<{ completed: true }>({
    url: '/user/identities/campus/oauth/complete',
    method: 'POST',
    data: { attemptId, handoffCode },
  });
export const completeCampusOAuth = (attemptId: string, handoffCode: string) =>
  request<{ completed: true; status: 'VERIFIED' | 'PENDING' }>({
    url: '/user/student-verification/oauth/complete',
    method: 'POST',
    data: { attemptId, handoffCode },
  });
export const sendBindingPhoneCode = (phone: string) =>
  request<VerificationChallenge>({
    url: '/user/identities/phone/challenges',
    method: 'POST',
    data: { phone: normalizePhone(phone) },
  });
export const bindPhone = (challengeId: string, code: string) =>
  request<null>({
    url: '/user/identities/phone',
    method: 'POST',
    data: { challengeId, code },
  });
export const bindWechat = (code: string, platform: 'mp-weixin' | 'app') =>
  request<null>({
    url: '/user/identities/wechat',
    method: 'POST',
    data: { code, platform },
  });

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
