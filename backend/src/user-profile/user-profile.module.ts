import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';

@Module({
  imports: [ConfigModule, JwtModule],
  controllers: [UserProfileController],
  providers: [UserProfileService, PrismaService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
