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
          windows: true,
        },
      }),
      this.prisma.canteen.count(),
    ]);

    const items = canteens.map((canteen) => this.mapToCanteenDto(canteen));
    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: 'success',
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
        windows: true,
      },
    });

    if (!canteen) {
      throw new NotFoundException('Canteen not found');
    }

    return {
      code: 200,
      message: 'success',
      data: this.mapToCanteenDto(canteen),
    };
  }

  async getCanteenWindows(
    canteenId: string,
    page: number,
    pageSize: number,
  ): Promise<WindowListResponseDto> {
    if (page < 1)
      page = 1;
    const skip = (page - 1) * pageSize;
    const [windows, total] = await Promise.all([
      this.prisma.window.findMany({
        where: { canteenId },
        skip,
        take: pageSize,
      }),
      this.prisma.window.count({ where: { canteenId } }),
    ]);

    const items = windows.map((window) => this.mapToWindowDto(window));
    const totalPages = Math.ceil(total / pageSize);

    return {
      code: 200,
      message: 'success',
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
    });

    if (!window) {
      throw new NotFoundException('Window not found');
    }

    return {
      code: 200,
      message: 'success',
      data: this.mapToWindowDto(window),
    };
  }

  async getWindowDishes(
    windowId: string,
    page: number,
    pageSize: number,
  ): Promise<DishListResponseDto> {
    if (page < 1)
      page = 1;
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
      message: 'success',
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

  private mapToCanteenDto(canteen: any): CanteenDto {
    const windows = canteen.windows ?? [];
    const floors = canteen.floors ?? [];

    return {
      id: canteen.id,
      name: canteen.name,
      position: canteen.position,
      description: canteen.description,
      images: canteen.images ?? [],
      openingHours: Array.isArray(canteen.openingHours)
        ? canteen.openingHours
        : [],
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
      floor: this.mapToFloorDto(window.floor),
      description: window.description,
      tags: window.tags ?? [],
    };
  }

  private mapToFloorDto(floor: any): FloorDto {
    return {
      level: floor.level,
      name: floor.name,
    }
  }
}
