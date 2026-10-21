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
  private client?: OSS;
  private readonly logger = new Logger(OssStorageStrategy.name);

  constructor(private readonly configService: ConfigService) {
    if (configService.get<string>('UPLOAD_STORAGE_TYPE') === 'oss')
      this.getClient();
  }

  private getClient(): OSS {
    if (!this.client) {
      this.client = new OSS({
        region: this.configService.getOrThrow<string>('OSS_REGION'),
        accessKeyId: this.configService.getOrThrow<string>('OSS_ACCESS_KEY_ID'),
        accessKeySecret: this.configService.getOrThrow<string>(
          'OSS_ACCESS_KEY_SECRET',
        ),
        bucket: this.configService.getOrThrow<string>('OSS_BUCKET'),
        secure: true,
      });
    }
    return this.client;
  }

  async upload(
    file: Express.Multer.File,
    privateFile = false,
  ): Promise<UploadResult> {
    const fileExt = path.extname(file.originalname);
    // 使用 randomUUID 生成唯一文件名，并存放在 images 目录下
    const fileName = `${privateFile ? 'moderation-private' : 'images'}/${randomUUID()}${fileExt}`;

    try {
      const result = await this.getClient().put(
        fileName,
        file.buffer,
        privateFile
          ? { headers: { 'x-oss-object-acl': 'private' } }
          : undefined,
      );
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

  async read(storageKey: string): Promise<Buffer> {
    if (
      !/^moderation-private\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(
        storageKey,
      )
    )
      throw new Error('Invalid managed image key');
    const result = await this.getClient().get(storageKey);
    return result.content as Buffer;
  }

  async remove(storageKey: string): Promise<void> {
    if (
      !/^(?:images|moderation-private)\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(
        storageKey,
      )
    ) {
      throw new Error('Invalid managed OSS image key');
    }
    await this.getClient().delete(storageKey);
  }
}
