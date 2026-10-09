import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [NewsController],
  providers: [NewsService, JwtService],
})
export class NewsModule {}
