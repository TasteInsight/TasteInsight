import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateWindowDto, FloorInputDto } from './dto/create-window.dto';
import { UpdateWindowDto } from './dto/update-window.dto';
import {
  WindowListResponseDto,
  WindowResponseDto,
  WindowDto,
} from './dto/window-response.dto';
import { DishSyncService } from '@/dish-sync-queue/dish-sync.service';

// Window 类型定义，用于 mapWindowToDto
type WindowWithFloor = {
  id: string;
  canteenId: string;
  floorId: string | null;
  name: string;
  number: string;
  position: string | null;
  description: string | null;
  tags: string[];
  floor: {
    id: string;
    level: string;
    name: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AdminWindowsService {
  constructor(
    private prisma: PrismaService,
    private dishSyncService: DishSyncService,
  ) {}

  /**
   * 将 Window 实体映射为 WindowDto
   */
  private mapWindowToDto(window: WindowWithFloor): WindowDto {
    return {
      id: window.id,
      canteenId: window.canteenId,
      floorId: window.floorId,
      name: window.name,
      number: window.number,
      position: window.position,
      description: window.description,
      tags: window.tags,
      floor: window.floor
        ? {
            id: window.floor.id,
            level: window.floor.level,
            name: window.floor.name,
          }
        : null,
      createdAt: window.createdAt,
      updatedAt: window.updatedAt,
    };
  }

  /**
   * 查找或创建楼层
   */
  private async findOrCreateFloor(
    canteenId: string,
    floor: FloorInputDto,
  ): Promise<string> {
    const existingFloor = await this.prisma.floor.findFirst({
      where: {
        canteenId,
        level: floor.level,
      },
    });

    if (existingFloor) {
      return existingFloor.id;
    }

    // 创建新楼层
    const newFloor = await this.prisma.floor.create({
      data: {
        canteenId,
        level: floor.level,
        name: floor.name,
      },
    });
    return newFloor.id;
  }

  async findAllByCanteen(
    canteenId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<WindowListResponseDto> {
    // 验证食堂是否存在
    const canteen = await this.prisma.canteen.findUnique({
      where: { id: canteenId },
    });
    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    const skip = (page - 1) * pageSize;

    const [total, windows] = await Promise.all([
      this.prisma.window.count({ where: { canteenId } }),
      this.prisma.window.findMany({
        where: { canteenId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          floor: true,
        },
      }),
    ]);

    const items: WindowDto[] = windows.map((window) =>
      this.mapWindowToDto(window),
    );

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async create(createWindowDto: CreateWindowDto): Promise<WindowResponseDto> {
    const { canteenId, floor, ...windowData } = createWindowDto;

    // 验证食堂是否存在
    const canteen = await this.prisma.canteen.findUnique({
      where: { id: canteenId },
    });
    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    // 如果提供了楼层信息，查找或创建楼层
    const floorId = floor
      ? await this.findOrCreateFloor(canteenId, floor)
      : null;

    const window = await this.prisma.window.create({
      data: {
        canteenId,
        floorId,
        name: windowData.name,
        number: windowData.number ?? '',
        position: windowData.position,
        description: windowData.description,
        tags: windowData.tags || [],
      },
      include: {
        floor: true,
      },
    });

    return {
      code: 200,
      message: 'success',
      data: this.mapWindowToDto(window),
    };
  }

  async update(
    id: string,
    updateWindowDto: UpdateWindowDto,
  ): Promise<WindowResponseDto> {
    const { floor, ...windowData } = updateWindowDto;

    // 验证窗口是否存在
    const existingWindow = await this.prisma.window.findUnique({
      where: { id },
    });
    if (!existingWindow) {
      throw new NotFoundException('窗口不存在');
    }

    // 如果提供了楼层信息，查找或创建楼层；否则保持原有楼层
    const floorId = floor
      ? await this.findOrCreateFloor(existingWindow.canteenId, floor)
      : existingWindow.floorId;

    // 执行数据库更新
    const window = await this.prisma.window.update({
      where: { id },
      data: {
        floorId, // 这里使用了计算后的最新 floorId
        name: windowData.name,
        ...(windowData.number !== undefined
          ? { number: windowData.number }
          : {}),
        position: windowData.position,
        description: windowData.description,
        tags: windowData.tags,
      },
      include: {
        floor: true,
      },
    });

    // 1. 检查名字是否改变
    const nameChanged = existingWindow.name !== windowData.name;

    // 2. 检查编号是否改变 (注意处理 undefined)
    const numberChanged =
      windowData.number !== undefined &&
      existingWindow.number !== windowData.number;

    // 3. 检查楼层是否改变 (对比 ID)
    // 注意：existingWindow.floorId 可能为 null
    const floorChanged = existingWindow.floorId !== floorId;

    if (nameChanged || numberChanged || floorChanged) {
      // 这里的 window.name 是更新后的名字
      // floorId 是更新后的楼层ID (如果没变就是原来的，变了就是新的)
      await this.dishSyncService.syncWindowInfo(
        window.id,
        window.name,
        window.number,
        floorId || undefined, // 如果是 null 转 undefined
      );
    }

    return {
      code: 200,
      message: 'success',
      data: this.mapWindowToDto(window),
    };
  }

  async remove(id: string): Promise<any> {
    const window = await this.prisma.window.findUnique({
      where: { id },
      include: {
        dishes: true,
      },
    });

    if (!window) {
      throw new NotFoundException('窗口不存在');
    }

    // 检查是否有关联的菜品
    if (window.dishes.length > 0) {
      throw new BadRequestException('该窗口下存在菜品，无法删除');
    }

    await this.prisma.window.delete({ where: { id } });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }
}
