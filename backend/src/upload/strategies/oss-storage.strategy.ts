import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { StorageStrategy, UploadResult } from './storage.strategy';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class OssStorageStrategy implements StorageStrategy {
  private client: OSS;
  private readonly logger = new Logger(OssStorageStrategy.name);

  constructor(private configService: ConfigService) {
    const storageType = this.configService.get<string>('UPLOAD_STORAGE_TYPE');

    if (storageType === 'oss') {
      const region = this.configService.get<string>('OSS_REGION');
      const accessKeyId = this.configService.get<string>('OSS_ACCESS_KEY_ID');
      const accessKeySecret = this.configService.get<string>(
        'OSS_ACCESS_KEY_SECRET',
      );
      const bucket = this.configService.get<string>('OSS_BUCKET');

      if (!region || !accessKeyId || !accessKeySecret || !bucket) {
        this.logger.warn(
          'OSS configuration is missing, but storage type is set to OSS.',
        );
      } else {
        this.client = new OSS({
          region,
          accessKeyId,
          accessKeySecret,
          bucket,
          secure: true,
        });
      }
    }
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!this.client) {
      throw new InternalServerErrorException('OSS client is not initialized');
    }

    const fileExt = path.extname(file.originalname);
    // 使用 randomUUID 生成唯一文件名，并存放在 images 目录下
    const fileName = `images/${randomUUID()}${fileExt}`;

    try {
      const result = await this.client.put(fileName, file.buffer);
      let url = result.url;

      // 处理自定义域名
      const customDomain = this.configService.get<string>('OSS_CUSTOM_DOMAIN');
      if (customDomain) {
        // result.url 通常是 http(s)://bucket.region.aliyuncs.com/path
        // 我们只需要 path 部分
        const urlObj = new URL(result.url);
        // 确保 customDomain 不以 / 结尾，pathname 以 / 开头
        const domain = customDomain.endsWith('/')
          ? customDomain.slice(0, -1)
          : customDomain;
        url = `${domain}${urlObj.pathname}`;
      }

      return { url, filename: fileName };
    } catch (error) {
      this.logger.error('OSS upload failed', error);
      throw new InternalServerErrorException('Failed to upload file to OSS');
    }
  }
}
