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
import { AdminReportsModule } from './admin-reports/admin-reports.module';
import { ConfigModule } from '@nestjs/config';
import { CanteensModule } from './canteens/canteens.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    AuthModule,
    DishesModule,
    CanteensModule,
    ReviewsModule,
    AdminDishesModule,
    AdminReviewsModule,
    AdminCommentsModule,
    AdminCanteensModule,
    AdminReportsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
