import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminNewsController } from './admin-news.controller';
import { AdminNewsService } from './admin-news.service';
import { PrismaService } from '@/prisma.service';

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AdminNewsController],
  providers: [AdminNewsService, PrismaService],
})
export class AdminNewsModule {}
