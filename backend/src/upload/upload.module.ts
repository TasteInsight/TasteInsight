import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ModerationCoreModule, ConfigModule],
  providers: [UploadService, LocalStorageStrategy, OssStorageStrategy],
  exports: [UploadService],
})
export class UploadModule {}
