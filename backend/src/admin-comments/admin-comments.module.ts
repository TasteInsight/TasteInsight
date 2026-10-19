import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminCommentsService } from './admin-comments.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [
    ModerationCoreModule,
    JwtModule.register({}),
    ConfigModule,
    NotificationsModule,
  ],
  controllers: [AdminCommentsController],
  providers: [AdminCommentsService, PermissionsGuard],
})
export class AdminCommentsModule {}
