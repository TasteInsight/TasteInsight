import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { PrismaService } from '@/prisma.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';

@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [AdminReviewsController],
  providers: [AdminReviewsService, PrismaService, PermissionsGuard],
})
export class AdminReviewsModule {}
