import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '@/upload/storage.module';
import { ModerationProviderService } from './providers/moderation-provider.service';
import { ModerationSettingsService } from './moderation-settings.service';
import { ModerationSubmissionService } from './moderation-submission.service';
import { ModerationAssetsService } from './moderation-assets.service';

@Module({
  imports: [ConfigModule, StorageModule],
  providers: [
    ModerationProviderService,
    ModerationSettingsService,
    ModerationSubmissionService,
    ModerationAssetsService,
  ],
  exports: [
    ModerationProviderService,
    ModerationSettingsService,
    ModerationSubmissionService,
    ModerationAssetsService,
  ],
})
export class ModerationCoreModule {}
