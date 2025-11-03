// @/api/modules/upload.ts
import request from '@/utils/request';
import type { ImageUploadData } from '@/types/api';

/**
 * 上传图片
 * 注意：这个函数需要特殊处理，因为是 multipart/form-data
 */
export const uploadImage = (filePath: string): Promise<ImageUploadData> => {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: config.baseUrl + '/upload/image',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${useUserStore().token}`,
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data);
          if (data.code === 200) {
            resolve(data.data);
          } else {
            reject(new Error(data.message));
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

// 需要导入的依赖
import config from '@/config';
import { useUserStore } from '@/store/modules/use-user-store';