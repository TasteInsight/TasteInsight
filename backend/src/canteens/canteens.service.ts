import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  CanteenListResponseDto,
  CanteenResponseDto,
  WindowListResponseDto,
  WindowResponseDto,
} from './dto/canteen-response.dto';
import { DishListResponseDto } from '@/dishes/dto/dish-response.dto';
import { CanteenDto, FloorDto, WindowDto } from './dto/canteen.dto';
import { DishDto } from '@/dishes/dto/dish.dto';

@Injectable()
export class CanteensService {
  constructor(private prisma: PrismaService) {}

  async getCanteens(
    page: number,
    pageSize: number,
  ): Promise<CanteenListResponseDto> {
    const skip = (page - 1) * pageSize;
    const [canteens, total] = await Promise.all([
      this.prisma.canteen.findMany({
        skip,
        take: pageSize,
        include: {
          windows: {
            include: {
              floor: true,
            },
          },
        },
      }),
      this.prisma.canteen.count(),
    ]);

    const items = canteens.map((canteen) => this.mapToCanteenDto(canteen));
    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: '获取食堂列表成功',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    };
  }

  async getCanteenById(id: string): Promise<CanteenResponseDto> {
    const canteen = await this.prisma.canteen.findUnique({
      where: { id },
      include: {
        windows: {
          include: {
            floor: true,
          },
        },
      },
    });

    if (!canteen) {
      throw new NotFoundException('食堂未找到');
    }

    return {
      code: 200,
      message: '获取食堂详情成功',
      data: this.mapToCanteenDto(canteen),
    };
  }

  // 批量获取食堂详情
  async getCanteensByIds(ids: string[]): Promise<CanteenListResponseDto> {
    if (!ids || ids.length === 0) {
      return {
        code: 200,
        message: 'success',
        data: {
          items: [],
          meta: {
            page: 1,
            pageSize: 0,
            total: 0,
            totalPages: 0,
          },
        },
      };
    }

    const canteens = await this.prisma.canteen.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        windows: {
          include: {
            floor: true,
          },
        },
      },
    });

    // 按照请求的 ID 顺序返回
    const canteenMap = new Map(
      canteens.map((canteen) => [canteen.id, canteen]),
    );
    const sortedCanteens = ids
      .map((id) => canteenMap.get(id))
      .filter((canteen) => canteen != null);

    const items = sortedCanteens.map((canteen) =>
      this.mapToCanteenDto(canteen),
    );

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page: 1,
          pageSize: items.length,
          total: items.length,
          totalPages: 1,
        },
      },
    };
  }

  async getCanteenWindows(
    canteenId: string,
    page: number,
    pageSize: number,
  ): Promise<WindowListResponseDto> {
    if (page < 1) page = 1;
    const skip = (page - 1) * pageSize;
    const [windows, total] = await Promise.all([
      this.prisma.window.findMany({
        where: { canteenId },
        skip,
        take: pageSize,
        include: { floor: true },
      }),
      this.prisma.window.count({ where: { canteenId } }),
    ]);

    const items = windows.map((window) => this.mapToWindowDto(window));
    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: '获取食堂窗口列表成功',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    };
  }

  async getWindowById(id: string): Promise<WindowResponseDto> {
    const window = await this.prisma.window.findUnique({
      where: { id },
      include: { floor: true },
    });

    if (!window) {
      throw new NotFoundException('窗口未找到');
    }

    return {
      code: 200,
      message: '获取窗口详情成功',
      data: this.mapToWindowDto(window),
    };
  }

  async getWindowDishes(
    windowId: string,
    page: number,
    pageSize: number,
  ): Promise<DishListResponseDto> {
    if (page < 1) page = 1;
    const skip = (page - 1) * pageSize;
    const [dishes, total] = await Promise.all([
      this.prisma.dish.findMany({
        where: { windowId },
        skip,
        take: pageSize,
      }),
      this.prisma.dish.count({ where: { windowId } }),
    ]);

    const items = dishes.map((dish) => DishDto.fromEntity(dish));
    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: '获取窗口菜品列表成功',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    };
  }

  /**
   * 根据名称搜索食堂ID
   */
  async searchCanteenIdByName(name: string): Promise<string | null> {
    if (!name) return null;

    // 尝试精确匹配
    let canteen = await this.prisma.canteen.findFirst({
      where: { name: name },
    });
    if (canteen) return canteen.id;

    // 尝试模糊匹配
    canteen = await this.prisma.canteen.findFirst({
      where: { name: { contains: name } },
    });
    if (canteen) return canteen.id;

    return null;
  }

  /**
   * 解析食堂标识符（可以是ID或名称）
   * 先尝试作为ID查询，如果不存在再按名称查询
   */
  async resolveCanteenId(identifier: string): Promise<string | null> {
    if (!identifier) return null;

    // 先尝试作为ID查询
    const canteenById = await this.prisma.canteen.findUnique({
      where: { id: identifier },
      select: { id: true },
    });
    if (canteenById) return canteenById.id;

    // 如果ID查询失败，再按名称查询
    return this.searchCanteenIdByName(identifier);
  }

  private mapToCanteenDto(canteen: any): CanteenDto {
    const windows = canteen.windows ?? [];
    const floors = canteen.floors ?? [];

    return {
      id: canteen.id,
      name: canteen.name,
      position: canteen.position,
      description: canteen.description,
      images: canteen.images ?? [],
      openingHours: canteen.openingHours ?? [],
      averageRating: canteen.averageRating,
      reviewCount: canteen.reviewCount,
      floors: floors.map((floor: any) => this.mapToFloorDto(floor)),
      windows: windows.map((window: any) => this.mapToWindowDto(window)),
    };
  }

  private mapToWindowDto(window: any): WindowDto {
    return {
      id: window.id,
      name: window.name,
      number: window.number,
      position: window.position,
      floor: window.floor ? this.mapToFloorDto(window.floor) : undefined,
      description: window.description,
      tags: window.tags ?? [],
    };
  }

  private mapToFloorDto(floor: any): FloorDto {
    return {
      level: floor.level,
      name: floor.name,
    };
  }
}
