import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { StorageStrategy } from './strategies/storage.strategy';

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly local: LocalStorageStrategy,
    private readonly oss: OssStorageStrategy,
    private readonly s3: S3StorageStrategy,
  ) {}

  get type(): string {
    return this.config.get<string>('UPLOAD_STORAGE_TYPE', 'local');
  }

  forType(type = this.type): StorageStrategy {
    switch (type) {
      case 'local':
        return this.local;
      case 'oss':
        return this.oss;
      case 's3':
        return this.s3;
      default:
        throw new Error('Unsupported image storage type');
    }
  }
}
