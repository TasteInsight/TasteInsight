import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import {
  STORAGE_STRATEGY,
  StorageStrategy,
} from './strategies/storage.strategy';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageStrategy,
    OssStorageStrategy,
    S3StorageStrategy,
    {
      provide: STORAGE_STRATEGY,
      inject: [
        ConfigService,
        LocalStorageStrategy,
        OssStorageStrategy,
        S3StorageStrategy,
      ],
      useFactory: (
        config: ConfigService,
        local: LocalStorageStrategy,
        oss: OssStorageStrategy,
        s3: S3StorageStrategy,
      ): StorageStrategy => {
        switch (config.get<string>('UPLOAD_STORAGE_TYPE', 'local')) {
          case 'oss':
            return oss;
          case 's3':
            return s3;
          default:
            return local;
        }
      },
    },
  ],
  exports: [STORAGE_STRATEGY],
})
export class StorageModule {}
