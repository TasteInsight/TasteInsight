import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ContentLikesService } from './content-likes.service';

@Module({
  imports: [NotificationsModule],
  providers: [ContentLikesService],
  exports: [ContentLikesService],
})
export class ContentInteractionsModule {}
