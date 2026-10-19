import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { JwtService } from '@nestjs/jwt';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ContentInteractionsModule } from '@/social/content-interactions.module';

@Module({
  imports: [
    ModerationCoreModule,
    AdminConfigModule,
    NotificationsModule,
    ContentInteractionsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, JwtService],
})
export class CommentsModule {}
