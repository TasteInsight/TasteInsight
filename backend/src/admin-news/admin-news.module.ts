import { AdminNewsSourcesModule } from '@/news-sources/news-sources.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminNewsController } from './admin-news.controller';
import { AdminNewsService } from './admin-news.service';

@Module({
  imports: [AdminNewsSourcesModule, JwtModule.register({}), ConfigModule],
  controllers: [AdminNewsController],
  providers: [AdminNewsService],
})
export class AdminNewsModule {}
