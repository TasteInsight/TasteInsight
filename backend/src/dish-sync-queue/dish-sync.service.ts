import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma.service';
import {
  DISH_SYNC_QUEUE,
  DishSyncJobType,
  SyncCanteenNameJobData,
  SyncWindowInfoJobData,
  SyncFloorInfoJobData,
} from './dish-sync.constants';

@Injectable()
export class DishSyncService {
  private readonly syncMode: 'async' | 'sync';

  constructor(
    @InjectQueue(DISH_SYNC_QUEUE) private readonly dishSyncQueue: Queue,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // 在测试环境使用同步模式，生产环境使用异步模式
    this.syncMode =
      this.configService.get('NODE_ENV') === 'test' ? 'sync' : 'async';
  }

  /**
   * 添加同步食堂名称的任务到队列
   */
  async syncCanteenName(canteenId: string, newName: string): Promise<void> {
    if (this.syncMode === 'sync') {
      // 同步模式：直接执行数据库更新
      await this.prisma.dish.updateMany({
        where: { canteenId },
        data: { canteenName: newName },
      });
      return;
    }

    // 异步模式：添加到队列
    const data: SyncCanteenNameJobData = { canteenId, newName };
    await this.dishSyncQueue.add(DishSyncJobType.SYNC_CANTEEN_NAME, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  /**
   * 添加同步窗口信息的任务到队列
   */
  async syncWindowInfo(
    windowId: string,
    newName: string,
    newNumber?: string,
    newFloorId?: string, // [新增] 参数
  ): Promise<void> {
    if (this.syncMode === 'sync') {
      // 同步模式：直接执行数据库更新
      const updateData: any = { windowName: newName };
      if (newNumber !== undefined) {
        updateData.windowNumber = newNumber;
      }
      if (newFloorId) {
        const floor = await this.prisma.floor.findUnique({
          where: { id: newFloorId },
        });
        if (floor) {
          updateData.floorId = floor.id;
          updateData.floorName = floor.name;
          updateData.floorLevel = floor.level;
        }
      }
      await this.prisma.dish.updateMany({
        where: { windowId },
        data: updateData,
      });
      return;
    }

    // 异步模式：添加到队列
    const data: SyncWindowInfoJobData = {
      windowId,
      newName,
      newNumber,
      newFloorId,
    };
    await this.dishSyncQueue.add(DishSyncJobType.SYNC_WINDOW_INFO, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  /**
   * 添加同步楼层信息的任务到队列
   */
  async syncFloorInfo(
    floorId: string,
    newName: string,
    newLevel: string,
  ): Promise<void> {
    if (this.syncMode === 'sync') {
      // 同步模式：直接执行数据库更新
      await this.prisma.dish.updateMany({
        where: { floorId },
        data: {
          floorName: newName,
          floorLevel: newLevel,
        },
      });
      return;
    }

    // 异步模式：添加到队列
    const data: SyncFloorInfoJobData = { floorId, newName, newLevel };
    await this.dishSyncQueue.add(DishSyncJobType.SYNC_FLOOR_INFO, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  /**
   * 获取队列状态（用于监控）
   */
  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.dishSyncQueue.getWaitingCount(),
      this.dishSyncQueue.getActiveCount(),
      this.dishSyncQueue.getCompletedCount(),
      this.dishSyncQueue.getFailedCount(),
      this.dishSyncQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
