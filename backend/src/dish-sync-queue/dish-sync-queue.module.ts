import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { DISH_SYNC_QUEUE } from './dish-sync.constants';
import { DishSyncProcessor } from './dish-sync.processor';
import { DishSyncService } from './dish-sync.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: DISH_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [DishSyncProcessor, DishSyncService, PrismaService],
  exports: [DishSyncService],
})
export class DishSyncQueueModule {}
