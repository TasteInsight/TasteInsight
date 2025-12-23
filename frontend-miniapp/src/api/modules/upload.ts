// @/api/modules/upload.ts
import request from '@/utils/request';
import type { ImageUploadData } from '@/types/api';
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';
import { USE_MOCK } from '@/mock/mock-adapter';

/**
 * 上传图片
 * 注意：这个函数需要特殊处理，因为是 multipart/form-data
 */
export const uploadImage = (filePath: string): Promise<ImageUploadData> => {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      console.log('[Mock] Uploading image:', filePath);
      setTimeout(() => {
        resolve({
          url: filePath, // Mock模式下直接返回本地路径
          filename: 'mock_image_' + Date.now() + '.jpg'
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
        Authorization: `Bearer ${useUserStore().token}`,
      },
      success: (res) => {
        console.log('Upload response:', res); // 添加调试日志
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
            console.error('解析上传响应失败:', parseError, '原始响应:', res.data);
            reject(new Error('解析服务器响应失败'));
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
};
