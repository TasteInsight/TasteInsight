import { ModerationCoreModule } from '@/content-moderation/moderation-core.module';
import { Module } from '@nestjs/common';
import { DishesController } from './dishes.controller';
import { DishesService } from './dishes.service';
import { JwtService } from '@nestjs/jwt';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [ModerationCoreModule, RecommendationModule, EmbeddingQueueModule],
  controllers: [DishesController],
  providers: [DishesService, JwtService],
  exports: [DishesService],
})
export class DishesModule {}
