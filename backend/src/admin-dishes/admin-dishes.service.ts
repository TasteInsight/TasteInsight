import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { AdminGetDishesDto, AdminCreateDishDto, AdminUpdateDishDto, DishStatus } from './dto/admin-dish.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminDishesService {
  constructor(private prisma: PrismaService) {}

  // 管理端获取菜品列表
  async getAdminDishes(query: AdminGetDishesDto, adminInfo: any) {
    const { page = 1, pageSize = 20, canteenId, status, keyword } = query;

    // 构建查询条件
    const where: any = {};

    // 如果管理员有canteenId限制，则只能查看该食堂的菜品
    if (adminInfo.canteenId) {
      where.canteenId = adminInfo.canteenId;
    }

    // 如果指定了食堂ID
    if (canteenId) {
      // 检查权限：如果管理员有食堂限制，必须匹配
      if (adminInfo.canteenId && adminInfo.canteenId !== canteenId) {
        throw new ForbiddenException('权限不足');
      }
      where.canteenId = canteenId;
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 关键字搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { canteenName: { contains: keyword, mode: 'insensitive' } },
        { windowName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 查询总数
    const total = await this.prisma.dish.count({ where });

    // 查询数据
    const items = await this.prisma.dish.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: true,
      },
    });

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

  /**
   * 管理端获取菜品详情
   */
  async getAdminDishById(id: string, adminInfo: any) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: true,
      },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查权限：如果管理员有食堂限制，必须匹配
    if (adminInfo.canteenId && dish.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    return {
      code: 200,
      message: 'success',
      data: dish,
    };
  }

  /**
   * 管理端创建菜品
   */
  async createAdminDish(createDto: AdminCreateDishDto, adminInfo: any) {
    // 检查食堂是否存在
    let canteen;
    if (createDto.canteenId) {
      canteen = await this.prisma.canteen.findUnique({
        where: { id: createDto.canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
    } else {
      // 如果没有提供canteenId，尝试根据canteenName查找
      canteen = await this.prisma.canteen.findFirst({
        where: { name: createDto.canteenName },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
    }

    // 检查权限：如果管理员有食堂限制，只能创建该食堂的菜品
    if (adminInfo.canteenId && canteen.id !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 查找窗口（如果存在）
    let window: any = null;
    if (createDto.windowNumber || createDto.windowName) {
      const orConditions: any[] = [];
      if (createDto.windowNumber) {
        orConditions.push({ number: createDto.windowNumber });
      }
      if (createDto.windowName) {
        orConditions.push({ name: createDto.windowName });
      }
      window = await this.prisma.window.findFirst({
        where: {
          canteenId: canteen.id,
          OR: orConditions,
        },
      });
    }

    // 检查父菜品是否存在
    if (createDto.parentDishId) {
      const parentDish = await this.prisma.dish.findUnique({
        where: { id: createDto.parentDishId },
      });
      if (!parentDish) {
        throw new BadRequestException('指定的父菜品不存在');
      }
    }

    // 创建菜品
    const dish = await this.prisma.dish.create({
      data: {
        name: createDto.name,
        tags: createDto.tags || [],
        price: createDto.price,
        description: createDto.description || '',
        images: createDto.images || [],
        parentDishId: createDto.parentDishId,
        ingredients: createDto.ingredients || [],
        allergens: createDto.allergens || [],
        spicyLevel: createDto.spicyLevel || 0,
        sweetness: createDto.sweetness || 0,
        saltiness: createDto.saltiness || 0,
        oiliness: createDto.oiliness || 0,
        canteenId: canteen.id,
        canteenName: canteen.name,
        floor: createDto.floor,
        windowId: window?.id,
        windowNumber: window?.number || createDto.windowNumber,
        windowName: createDto.windowName,
        availableMealTime: createDto.availableMealTime || [],
        availableDates: createDto.availableDates ? (createDto.availableDates as unknown as Prisma.InputJsonArray) : undefined,
        status: createDto.status || 'offline',
      },
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: true,
      },
    });

    return {
      code: 201,
      message: '创建成功',
      data: dish,
    };
  }

  /**
   * 管理端更新菜品
   */
  async updateAdminDish(id: string, updateDto: AdminUpdateDishDto, adminInfo: any) {
    // 检查菜品是否存在
    const existingDish = await this.prisma.dish.findUnique({
      where: { id },
    });

    if (!existingDish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查权限：如果管理员有食堂限制，只能编辑该食堂的菜品
    if (adminInfo.canteenId && existingDish.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 构建更新数据
    const updateData: any = {};

    // 基本信息
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.tags !== undefined) updateData.tags = updateDto.tags;
    if (updateDto.price !== undefined) updateData.price = updateDto.price;
    if (updateDto.description !== undefined) updateData.description = updateDto.description;
    if (updateDto.images !== undefined) updateData.images = updateDto.images;
    if (updateDto.parentDishId !== undefined) updateData.parentDishId = updateDto.parentDishId;
    if (updateDto.ingredients !== undefined) updateData.ingredients = updateDto.ingredients;
    if (updateDto.allergens !== undefined) updateData.allergens = updateDto.allergens;
    if (updateDto.spicyLevel !== undefined) updateData.spicyLevel = updateDto.spicyLevel;
    if (updateDto.sweetness !== undefined) updateData.sweetness = updateDto.sweetness;
    if (updateDto.saltiness !== undefined) updateData.saltiness = updateDto.saltiness;
    if (updateDto.oiliness !== undefined) updateData.oiliness = updateDto.oiliness;
    if (updateDto.floor !== undefined) updateData.floor = updateDto.floor;
    if (updateDto.windowNumber !== undefined) updateData.windowNumber = updateDto.windowNumber;
    if (updateDto.windowName !== undefined) updateData.windowName = updateDto.windowName;
    if (updateDto.availableMealTime !== undefined) updateData.availableMealTime = updateDto.availableMealTime;
    if (updateDto.availableDates !== undefined) updateData.availableDates = updateDto.availableDates as any;
    if (updateDto.status !== undefined) updateData.status = updateDto.status;

    // 处理食堂ID和名称的更新
    if (updateDto.canteenId || updateDto.canteenName) {
      let canteen;
      if (updateDto.canteenId) {
        canteen = await this.prisma.canteen.findUnique({
          where: { id: updateDto.canteenId },
        });
      } else if (updateDto.canteenName) {
        canteen = await this.prisma.canteen.findFirst({
          where: { name: updateDto.canteenName },
        });
      }

      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }

      // 检查权限：如果管理员有食堂限制，不能将菜品移到其他食堂
      if (adminInfo.canteenId && canteen.id !== adminInfo.canteenId) {
        throw new ForbiddenException('权限不足');
      }

      updateData.canteenId = canteen.id;
      updateData.canteenName = canteen.name;
    }

    // 更新菜品
    const dish = await this.prisma.dish.update({
      where: { id },
      data: updateData,
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: true,
      },
    });

    return {
      code: 200,
      message: '更新成功',
      data: dish,
    };
  }

  /**
   * 管理端删除菜品
   */
  async deleteAdminDish(id: string, adminInfo: any) {
    // 检查菜品是否存在
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        subDishes: true,
      },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查权限：如果管理员有食堂限制，只能删除该食堂的菜品
    if (adminInfo.canteenId && dish.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 检查是否有子菜品
    if (dish.subDishes && dish.subDishes.length > 0) {
      throw new BadRequestException('该菜品有子菜品，无法删除');
    }

    // 删除菜品
    await this.prisma.dish.delete({
      where: { id },
    });

    return {
      code: 200,
      message: '删除成功',
      data: null,
    };
  }

  /**
   * 管理端修改菜品状态
   */
  async updateDishStatus(id: string, status: DishStatus, adminInfo: any) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查权限：如果管理员有食堂限制，必须匹配
    if (adminInfo.canteenId && dish.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    await this.prisma.dish.update({
      where: { id },
      data: { status },
    });

    return {
      code: 200,
      message: '状态修改成功',
      data: null,
    };
  }
}
