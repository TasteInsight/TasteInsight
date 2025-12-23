import { Module } from '@nestjs/common';
import { DishesController } from './dishes.controller';
import { DishesService } from './dishes.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [RecommendationModule, EmbeddingQueueModule],
  controllers: [DishesController],
  providers: [DishesService, PrismaService, JwtService],
  exports: [DishesService],
})
export class DishesModule {}
