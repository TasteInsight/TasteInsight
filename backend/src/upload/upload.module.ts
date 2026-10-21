import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { StorageModule } from './storage.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ModerationCoreModule, ConfigModule, StorageModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
