import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ContentInteractionsModule } from './content-interactions.module';
import { SocialService } from './social.service';

@Module({
  imports: [
    ModerationCoreModule,
    AdminConfigModule,
    NotificationsModule,
    ContentInteractionsModule,
  ],
  providers: [SocialService],
  exports: [SocialService, ContentInteractionsModule],
})
export class SocialModule {}
