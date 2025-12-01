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
import { ConfigModule } from '@nestjs/config';
import { CanteensModule } from './canteens/canteens.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    AuthModule,
    DishesModule,
    CanteensModule,
    ReviewsModule,
    CommentsModule,
    AdminDishesModule,
    AdminReviewsModule,
    AdminCommentsModule,
    AdminCanteensModule,
    AdminWindowsModule,
    AdminReportsModule,
    AdminUploadsModule,
    AdminAdminsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
