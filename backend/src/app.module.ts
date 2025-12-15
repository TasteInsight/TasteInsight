// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
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
import { AdminExperimentsModule } from './admin-experiments/admin-experiments.module';
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
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    DishSyncQueueModule,
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
    AdminExperimentsModule,
    UploadModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/images',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
