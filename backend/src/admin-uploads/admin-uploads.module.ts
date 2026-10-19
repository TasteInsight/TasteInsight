import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [
    ModerationCoreModule,
    JwtModule.register({}),
    ConfigModule,
    NotificationsModule,
  ],
  controllers: [AdminUploadsController],
  providers: [AdminUploadsService, PermissionsGuard],
})
export class AdminUploadsModule {}
