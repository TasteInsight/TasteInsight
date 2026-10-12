import { Injectable } from '@nestjs/common';
import { StorageStrategy, UploadResult } from './storage.strategy';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStorageStrategy implements StorageStrategy {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get<string>(
      'UPLOAD_LOCAL_PATH',
      './uploads',
    );
    // 确保目录存在
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }

    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    // 如果没有配置 UPLOAD_BASE_URL，则默认使用 ${APP_URL}/images 路径
    this.baseUrl = this.configService.get<string>(
      'UPLOAD_BASE_URL',
      `${appUrl}/images`,
    );
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    const fileExt = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const filePath = path.join(this.uploadPath, fileName);

    await fs.promises.writeFile(filePath, file.buffer);

    // 处理 URL 拼接，避免双斜杠等问题
    const url = this.baseUrl.endsWith('/')
      ? `${this.baseUrl}${fileName}`
      : `${this.baseUrl}/${fileName}`;

    return { url, filename: fileName };
  }
}
