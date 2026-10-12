import type { ImageUploadData } from '@/types/api';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { USE_MOCK } from '@/mock/mock-adapter';
import { expireSession, refreshAccessToken } from '@/utils/auth-session';
import { createHttpError } from '@/utils/user-friendly-error';

export interface ImageUploadOptions {
  purpose?: 'dish-contribution';
}

export const uploadImage = async (
  filePath: string,
  options: ImageUploadOptions = {}
): Promise<ImageUploadData> => {
  const user = useUserStore();
  const sessionVersion = user.sessionVersion;
  const assertSession = () => {
    if (user.sessionVersion !== sessionVersion) throw new Error('登录会话已变更');
  };
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 500));
    assertSession();
    return { url: filePath, filename: 'mock_image_' + Date.now() + '.jpg' };
  }

  const send = (): Promise<UniApp.UploadFileSuccessCallbackResult> =>
    new Promise((resolve, reject) => {
      assertSession();
      uni.uploadFile({
        url:
          config.baseUrl + '/upload/image' + (options.purpose ? '?purpose=dish-contribution' : ''),
        filePath,
        name: 'file',
        header: { Authorization: `Bearer ${user.token}` },
        timeout: 30000,
        success: resolve,
        fail: err => {
          try {
            assertSession();
            reject(err);
          } catch (error) {
            reject(error);
          }
        },
      });
    });

  const accessToken = user.token;
  let response = await send();
  assertSession();
  if (response.statusCode === 401) {
    try {
      await refreshAccessToken(sessionVersion, accessToken);
    } catch (error: any) {
      assertSession();
      if (error?.statusCode === 401) expireSession(sessionVersion);
      throw error;
    }
    assertSession();
    response = await send();
    assertSession();
  }

  let body: any;
  try {
    body = response.data ? JSON.parse(response.data) : null;
  } catch {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      throw new Error('解析服务器响应失败');
    }
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (response.statusCode === 401) expireSession(sessionVersion);
    throw createHttpError(response.statusCode, body);
  }
  if (!body) throw new Error('服务器未返回数据');
  if (body.code !== 200 && body.code !== 201) throw new Error(body.message || '上传失败');
  return body.data;
};
