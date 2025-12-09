import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma.service';
import {
  DISH_SYNC_QUEUE,
  DishSyncJobType,
  SyncCanteenNameJobData,
  SyncWindowInfoJobData,
  SyncFloorInfoJobData,
} from './dish-sync.constants';

@Processor(DISH_SYNC_QUEUE)
export class DishSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(DishSyncProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name as DishSyncJobType) {
      case DishSyncJobType.SYNC_CANTEEN_NAME:
        return this.syncCanteenName(job.data as SyncCanteenNameJobData);
      case DishSyncJobType.SYNC_WINDOW_INFO:
        return this.syncWindowInfo(job.data as SyncWindowInfoJobData);
      case DishSyncJobType.SYNC_FLOOR_INFO:
        return this.syncFloorInfo(job.data as SyncFloorInfoJobData);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return null;
    }
  }

  private async syncCanteenName(data: SyncCanteenNameJobData): Promise<number> {
    const { canteenId, newName } = data;
    this.logger.log(
      `Syncing canteen name for canteenId: ${canteenId} to "${newName}"`,
    );

    const result = await this.prisma.dish.updateMany({
      where: { canteenId },
      data: { canteenName: newName },
    });

    this.logger.log(`Updated ${result.count} dishes with new canteen name`);
    return result.count;
  }

  private async syncWindowInfo(data: SyncWindowInfoJobData): Promise<number> {
    const { windowId, newName, newNumber, newFloorId } = data;
    this.logger.log(`Syncing window info for windowId: ${windowId}`);

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
        this.logger.log(`Also syncing floor info to "${floor.name}"`);
      } else {
        this.logger.warn(
          `Floor not found for id: ${newFloorId}, skipping floor update`,
        );
      }
    }

    const result = await this.prisma.dish.updateMany({
      where: { windowId },
      data: updateData,
    });

    this.logger.log(`Updated ${result.count} dishes with new window info`);
    return result.count;
  }

  private async syncFloorInfo(data: SyncFloorInfoJobData): Promise<number> {
    const { floorId, newName, newLevel } = data;
    this.logger.log(`Syncing floor info for floorId: ${floorId}`);

    const result = await this.prisma.dish.updateMany({
      where: { floorId },
      data: {
        floorName: newName,
        floorLevel: newLevel,
      },
    });

    this.logger.log(`Updated ${result.count} dishes with new floor info`);
    return result.count;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
