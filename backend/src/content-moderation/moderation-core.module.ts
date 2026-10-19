import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalStorageStrategy } from '@/upload/strategies/local-storage.strategy';
import { OssStorageStrategy } from '@/upload/strategies/oss-storage.strategy';
import { ModerationProviderService } from './providers/moderation-provider.service';
import { ModerationSettingsService } from './moderation-settings.service';
import { ModerationSubmissionService } from './moderation-submission.service';
import { ModerationAssetsService } from './moderation-assets.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ModerationProviderService,
    ModerationSettingsService,
    ModerationSubmissionService,
    ModerationAssetsService,
    LocalStorageStrategy,
    OssStorageStrategy,
  ],
  exports: [
    ModerationProviderService,
    ModerationSettingsService,
    ModerationSubmissionService,
    ModerationAssetsService,
  ],
})
export class ModerationCoreModule {}
