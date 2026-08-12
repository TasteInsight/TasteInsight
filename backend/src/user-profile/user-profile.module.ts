import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { EmbeddingQueueModule } from '@/embedding-queue/embedding-queue.module';

@Module({
  imports: [ConfigModule, JwtModule, EmbeddingQueueModule],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
