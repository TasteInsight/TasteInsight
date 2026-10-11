import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserProfileService } from './user-profile.service';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [ConfigModule, EmbeddingQueueModule],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
