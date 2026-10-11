import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [UploadService, LocalStorageStrategy, OssStorageStrategy],
  exports: [UploadService],
})
export class UploadModule {}
