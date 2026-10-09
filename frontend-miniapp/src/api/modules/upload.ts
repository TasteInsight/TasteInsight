// @/api/modules/upload.ts
import type { ImageUploadData } from '@/types/api';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { USE_MOCK } from '@/mock/mock-adapter';

/**
 * 上传图片
 * 注意：这个函数需要特殊处理，因为是 multipart/form-data
 */
export const uploadImage = (filePath: string): Promise<ImageUploadData> => {
  const userStore = useUserStore();
  const sessionVersion = userStore.sessionVersion;
  const accessToken = userStore.token;
  if (USE_MOCK) {
    return new Promise((resolve, reject) => {
      console.log('[Mock] Uploading image:', filePath);
      setTimeout(() => {
        if (userStore.sessionVersion !== sessionVersion) {
          reject(new Error('登录会话已变更'));
          return;
        }
        resolve({
          url: filePath, // Mock模式下直接返回本地路径
          filename: 'mock_image_' + Date.now() + '.jpg',
        });
      }, 500);
    });
  }

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: config.baseUrl + '/upload/image',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${accessToken}`,
      },
      success: res => {
        if (userStore.sessionVersion !== sessionVersion) {
          reject(new Error('登录会话已变更'));
          return;
        }
        console.log('Upload response status:', res.statusCode);
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            if (!res.data) {
              reject(new Error('服务器未返回数据'));
              return;
            }
            const data = JSON.parse(res.data);
            if (data.code === 200 || data.code === 201) {
              resolve(data.data);
            } else {
              reject(new Error(data.message || '上传失败'));
            }
          } catch (parseError) {
            console.error('解析上传响应失败:', parseError);
            reject(new Error('解析服务器响应失败'));
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`));
        }
      },
      fail: err => {
        reject(userStore.sessionVersion === sessionVersion ? err : new Error('登录会话已变更'));
      },
    });
  });
};
