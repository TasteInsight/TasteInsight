import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { DISH_SYNC_QUEUE } from './dish-sync.constants';
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
  providers: [DishSyncService],
  exports: [DishSyncService, BullModule],
})
export class DishSyncQueueModule {}
