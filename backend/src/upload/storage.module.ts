import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageStrategy,
    OssStorageStrategy,
    S3StorageStrategy,
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
