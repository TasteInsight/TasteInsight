// 队列名称常量
export const DISH_SYNC_QUEUE = 'dish-sync';

// 任务类型
export enum DishSyncJobType {
  SYNC_CANTEEN_NAME = 'sync-canteen-name',
  SYNC_WINDOW_INFO = 'sync-window-info',
  SYNC_FLOOR_INFO = 'sync-floor-info',
}

// 任务数据接口
export interface SyncCanteenNameJobData {
  canteenId: string;
  newName: string;
}

export interface SyncWindowInfoJobData {
  windowId: string;
  newName: string;
  newNumber?: string;
  newFloorId?: string; // [新增] 支持传递新的楼层ID
}

export interface SyncFloorInfoJobData {
  floorId: string;
  newName: string;
  newLevel: string;
}
