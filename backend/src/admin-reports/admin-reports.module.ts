import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { PrismaService } from '@/prisma.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { DishReviewStatsQueueModule } from '@/dish-review-stats-queue';

@Module({
  imports: [JwtModule.register({}), ConfigModule, DishReviewStatsQueueModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService, PrismaService, PermissionsGuard],
})
export class AdminReportsModule {}
