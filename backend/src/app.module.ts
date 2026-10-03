// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { DishesModule } from './dishes/dishes.module';
import { AdminDishesModule } from './admin-dishes/admin-dishes.module';
import { AdminReviewsModule } from './admin-reviews/admin-reviews.module';
import { AdminCommentsModule } from './admin-comments/admin-comments.module';
import { AdminCanteensModule } from './admin-canteens/admin-canteens.module';
import { AdminWindowsModule } from './admin-windows/admin-windows.module';
import { AdminReportsModule } from './admin-reports/admin-reports.module';
import { AdminUploadsModule } from './admin-uploads/admin-uploads.module';
import { AdminAdminsModule } from './admin-admins/admin-admins.module';
import { AdminNewsModule } from './admin-news/admin-news.module';
import { AdminConfigModule } from './admin-config/admin-config.module';
import { AdminRecommendationModule } from './admin-recommendation/admin-recommendation.module';
import { AdminLogsModule } from './admin-logs/admin-logs.module';
import { AdminOperationLogInterceptor } from './admin-logs/admin-operation-log.interceptor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CanteensModule } from './canteens/canteens.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommentsModule } from './comments/comments.module';
import { NewsModule } from './news/news.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { UploadModule } from './upload/upload.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { BullModule } from '@nestjs/bullmq';
import { DishSyncQueueModule } from './dish-sync-queue';
import { DishReviewStatsQueueModule } from './dish-review-stats-queue';
import { EmbeddingQueueModule } from './embedding-queue/embedding-queue.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { AIChatModule } from './ai-chat/ai-chat.module';
import { resolve } from 'path';
import type { ServerResponse } from 'http';
import { validateEnvironment } from './environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    DishSyncQueueModule,
    DishReviewStatsQueueModule,
    AuthModule,
    DishesModule,
    CanteensModule,
    ReviewsModule,
    CommentsModule,
    NewsModule,
    MealPlansModule,
    UserProfileModule,
    AdminUploadsModule,
    AdminDishesModule,
    AdminReviewsModule,
    AdminCommentsModule,
    AdminCanteensModule,
    AdminWindowsModule,
    AdminReportsModule,
    AdminAdminsModule,
    AdminNewsModule,
    AdminConfigModule,
    AdminRecommendationModule,
    AdminLogsModule,
    RecommendationModule,
    EmbeddingQueueModule,
    AIChatModule,
    UploadModule,
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: resolve(
            process.cwd(),
            configService.get<string>('UPLOAD_LOCAL_PATH', './uploads'),
          ),
          serveRoot: '/images',
          serveStaticOptions: {
            setHeaders: (response: ServerResponse) => {
              response.setHeader('X-Content-Type-Options', 'nosniff');
              response.setHeader(
                'Content-Security-Policy',
                "default-src 'none'; sandbox",
              );
            },
          },
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminOperationLogInterceptor,
    },
  ],
})
export class AppModule {}
