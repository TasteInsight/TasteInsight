import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [NewsController],
  providers: [NewsService, PrismaService, JwtService],
})
export class NewsModule {}
