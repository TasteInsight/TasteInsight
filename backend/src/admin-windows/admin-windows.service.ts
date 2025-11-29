import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateWindowDto } from './dto/create-window.dto';
import { UpdateWindowDto } from './dto/update-window.dto';
import { WindowListResponseDto, WindowResponseDto, WindowDto } from './dto/window-response.dto';

@Injectable()
export class AdminWindowsService {
  constructor(private prisma: PrismaService) {}

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

    const items: WindowDto[] = windows.map((window) => ({
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
    }));

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

    let floorId: string | null = null;

    // 如果提供了楼层信息，查找或创建楼层
    if (floor) {
      const existingFloor = await this.prisma.floor.findFirst({
        where: {
          canteenId,
          level: floor.level,
        },
      });

      if (existingFloor) {
        floorId = existingFloor.id;
      } else {
        // 创建新楼层
        const newFloor = await this.prisma.floor.create({
          data: {
            canteenId,
            level: floor.level,
            name: floor.name,
          },
        });
        floorId = newFloor.id;
      }
    }

    const window = await this.prisma.window.create({
      data: {
        canteenId,
        floorId,
        name: windowData.name,
        number: windowData.number,
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
      data: {
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
      },
    };
  }

  async update(id: string, updateWindowDto: UpdateWindowDto): Promise<WindowResponseDto> {
    const { floor, ...windowData } = updateWindowDto;

    // 验证窗口是否存在
    const existingWindow = await this.prisma.window.findUnique({
      where: { id },
    });
    if (!existingWindow) {
      throw new NotFoundException('窗口不存在');
    }

    let floorId: string | null = existingWindow.floorId;

    // 如果提供了楼层信息，查找或创建楼层
    if (floor) {
      const existingFloor = await this.prisma.floor.findFirst({
        where: {
          canteenId: existingWindow.canteenId,
          level: floor.level,
        },
      });

      if (existingFloor) {
        floorId = existingFloor.id;
      } else {
        // 创建新楼层
        const newFloor = await this.prisma.floor.create({
          data: {
            canteenId: existingWindow.canteenId,
            level: floor.level,
            name: floor.name,
          },
        });
        floorId = newFloor.id;
      }
    }

    const window = await this.prisma.window.update({
      where: { id },
      data: {
        floorId,
        name: windowData.name,
        number: windowData.number,
        position: windowData.position,
        description: windowData.description,
        tags: windowData.tags,
      },
      include: {
        floor: true,
      },
    });

    return {
      code: 200,
      message: 'success',
      data: {
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
      },
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
