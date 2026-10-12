import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { createHttpError } from './user-friendly-error';

let pendingRefresh: { sessionVersion: number; promise: Promise<void> } | null = null;

/** JSON requests and multipart uploads share the same token rotation. */
export function refreshAccessToken(
  sessionVersion: number,
  failedAccessToken: string | null
): Promise<void> {
  const user = useUserStore();
  if (user.sessionVersion !== sessionVersion) return Promise.reject(new Error('登录会话已变更'));
  if (failedAccessToken !== user.token) return Promise.resolve();
  if (!user.refreshToken) return Promise.reject(createHttpError(401));
  if (pendingRefresh?.sessionVersion === sessionVersion) return pendingRefresh.promise;

  const refreshToken = user.refreshToken;
  const refresh = {
    sessionVersion,
    promise: new Promise<void>((resolve, reject) => {
      uni.request({
        url: config.baseUrl + '/auth/refresh',
        method: 'POST',
        header: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
        data: {},
        timeout: 15000,
        success: response => {
          if (user.sessionVersion !== sessionVersion) {
            reject(new Error('登录会话已变更'));
            return;
          }
          const data = response.data as any;
          const token = data?.data?.token;
          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            data?.code === 200 &&
            token?.accessToken
          ) {
            user.updateTokens(sessionVersion, token.accessToken, token.refreshToken);
            resolve();
          } else {
            reject(createHttpError(response.statusCode === 401 ? 401 : response.statusCode, data));
          }
        },
        fail: () =>
          reject(
            new Error(
              user.sessionVersion === sessionVersion ? '网络开小差了，请稍后再试' : '登录会话已变更'
            )
          ),
      });
    }),
  };
  pendingRefresh = refresh;
  refresh.promise = refresh.promise.finally(() => {
    if (pendingRefresh === refresh) pendingRefresh = null;
  });
  return refresh.promise;
}

export function expireSession(sessionVersion: number): void {
  const user = useUserStore();
  if (user.sessionVersion !== sessionVersion) return;
  user.logoutAction();
  uni.reLaunch({ url: '/pages/login/index' });
}
