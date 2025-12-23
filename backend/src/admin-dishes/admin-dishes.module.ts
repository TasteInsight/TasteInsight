import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminDishesController } from './admin-dishes.controller';
import { AdminDishesService } from './admin-dishes.service';
import { PrismaService } from '@/prisma.service';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
    RecommendationModule,
    EmbeddingQueueModule,
  ],
  controllers: [AdminDishesController],
  providers: [AdminDishesService, PrismaService, PermissionsGuard],
})
export class AdminDishesModule {}
