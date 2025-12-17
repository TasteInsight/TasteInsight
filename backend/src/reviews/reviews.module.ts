import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AdminConfigModule } from '@/admin-config/admin-config.module';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';

@Module({
  imports: [AdminConfigModule, DishReviewStatsQueueModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, PrismaService, JwtService],
})
export class ReviewsModule {}
