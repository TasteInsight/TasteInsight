import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { WerssClient } from './werss.client';
import { NewsSourcesService } from './news-sources.service';
import { NewsSourcesQueue, NEWS_SYNC_QUEUE } from './news-sources.queue';
import { NewsSourcesController } from './news-sources.controller';
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: NEWS_SYNC_QUEUE }),
  ],
  providers: [WerssClient, NewsSourcesService, NewsSourcesQueue],
  exports: [NewsSourcesService, NewsSourcesQueue],
})
export class NewsSourcesModule {}
@Module({
  imports: [NewsSourcesModule, JwtModule.register({}), ConfigModule],
  controllers: [NewsSourcesController],
})
export class AdminNewsSourcesModule {}
