import { StorageStrategy, UploadResult } from './storage.strategy';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { LocalStorageConfiguration } from '../storage.config';

export class LocalStorageStrategy implements StorageStrategy {
  constructor(private readonly config: LocalStorageConfiguration) {}

  async upload(
    file: Express.Multer.File,
    privateFile = false,
  ): Promise<UploadResult> {
    await fs.promises.mkdir(this.config.path, { recursive: true });
    const fileExt = path.extname(file.originalname);
    const fileName = `${privateFile ? '.moderation/' : ''}${randomUUID()}${fileExt}`;
    if (privateFile)
      await fs.promises.mkdir(path.join(this.config.path, '.moderation'), {
        recursive: true,
      });
    const filePath = path.join(this.config.path, fileName);

    await fs.promises.writeFile(filePath, file.buffer);

    // 处理 URL 拼接，避免双斜杠等问题
    const url = this.config.publicBaseUrl.endsWith('/')
      ? `${this.config.publicBaseUrl}${fileName}`
      : `${this.config.publicBaseUrl}/${fileName}`;

    return { url, filename: fileName };
  }

  async read(storageKey: string): Promise<Buffer> {
    if (!/^\.moderation\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(storageKey))
      throw new Error('Invalid managed image key');
    return fs.promises.readFile(path.join(this.config.path, storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    if (
      !/^(?:\.moderation\/)?[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(storageKey)
    ) {
      throw new Error('Invalid managed image key');
    }
    try {
      await fs.promises.unlink(path.join(this.config.path, storageKey));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
