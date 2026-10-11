import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '@/auth/auth.module';
import { AdminAuthController } from '@/auth/admin-auth.controller';
import { AdminAdminsModule } from '@/admin-admins/admin-admins.module';
import { AdminCanteensModule } from '@/admin-canteens/admin-canteens.module';
import { AdminCommentsModule } from '@/admin-comments/admin-comments.module';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { AdminConfigController } from '@/admin-config/admin-config.controller';
import { AdminDishesModule } from '@/admin-dishes/admin-dishes.module';
import { AdminLogsModule } from '@/admin-logs/admin-logs.module';
import { AdminOperationLogInterceptor } from '@/admin-logs/admin-operation-log.interceptor';
import { AdminNewsModule } from '@/admin-news/admin-news.module';
import { AdminRecommendationModule } from '@/admin-recommendation/admin-recommendation.module';
import { AdminReportsModule } from '@/admin-reports/admin-reports.module';
import { AdminReviewsModule } from '@/admin-reviews/admin-reviews.module';
import { AdminUploadsModule } from '@/admin-uploads/admin-uploads.module';
import { AdminWindowsModule } from '@/admin-windows/admin-windows.module';
import { UploadModule } from '@/upload/upload.module';
import { AdminUploadController } from '@/upload/upload.controller';

@Module({
  imports: [
    AuthModule,
    AdminAdminsModule,
    AdminCanteensModule,
    AdminCommentsModule,
    AdminConfigModule,
    AdminDishesModule,
    AdminLogsModule,
    AdminNewsModule,
    AdminRecommendationModule,
    AdminReportsModule,
    AdminReviewsModule,
    AdminUploadsModule,
    AdminWindowsModule,
  ],
  controllers: [AdminConfigController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AdminOperationLogInterceptor },
  ],
})
export class AdminFeaturesHttpModule {}

@Module({
  imports: [AdminFeaturesHttpModule, AuthModule, UploadModule],
  controllers: [AdminAuthController, AdminUploadController],
})
export class AdminHttpModule {}
