import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  AdminGetDishesDto,
  AdminCreateDishDto,
  AdminUpdateDishDto,
  DishStatus,
  DishUploadStatus,
} from './dto/admin-dish.dto';
import { AdminDishDto } from './dto/admin-dish.dto';
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
        items: items.map((item) => this.mapToAdminDishDto(item)),
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
      data: this.mapToAdminDishDto(dish),
    };
  }

  /**
   * 管理端创建菜品
   */
  async createAdminDish(createDto: AdminCreateDishDto, adminInfo: any) {
    // 1. 确定食堂
    let canteenId = createDto.canteenId;
    if (!canteenId && createDto.canteenName) {
      const canteen = await this.prisma.canteen.findFirst({
        where: { name: createDto.canteenName },
      });
      if (canteen) {
        canteenId = canteen.id;
      }
    }

    // 2. 确定窗口，顺序：ID > 名称 > 编号
    let window: any = null;

    if (createDto.windowId) {
      window = await this.prisma.window.findUnique({
        where: { id: createDto.windowId },
        include: { canteen: true, floor: true },
      });
    } else if (canteenId) {
      // 如果未提供 windowId，则需要 canteenId 来按名称或编号查找
      if (createDto.windowName) {
        window = await this.prisma.window.findFirst({
          where: {
            canteenId: canteenId,
            name: createDto.windowName,
          },
          include: { canteen: true, floor: true },
        });
      }

      if (!window && createDto.windowNumber) {
        window = await this.prisma.window.findFirst({
          where: {
            canteenId: canteenId,
            number: createDto.windowNumber,
          },
          include: { canteen: true, floor: true },
        });
      }
    }

    if (!window) {
      throw new BadRequestException(
        '指定的窗口不存在，请提供有效的窗口ID、名称或编号',
      );
    }

    // 3. 检查权限
    if (adminInfo.canteenId && window.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 4. 检查父菜品
    if (createDto.parentDishId) {
      const parentDish = await this.prisma.dish.findUnique({
        where: { id: createDto.parentDishId },
      });
      if (!parentDish) {
        throw new BadRequestException('指定的父菜品不存在');
      }
    }

    // 5. 创建菜品 (DishUpload)
    const dishUpload = await this.prisma.dishUpload.create({
      data: {
        adminId: adminInfo.id,
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

        // 来自窗口的位置信息
        canteenId: window.canteenId,
        canteenName: window.canteen.name,
        windowId: window.id,
        windowNumber: window.number,
        windowName: window.name,

        availableMealTime: createDto.availableMealTime || [],
        availableDates: createDto.availableDates
          ? (createDto.availableDates as unknown as Prisma.InputJsonArray)
          : undefined,
        status: DishUploadStatus.PENDING,
      },
      include: {
        canteen: true,
        window: {
          include: {
            floor: true,
          },
        },
        parentDish: true,
      },
    });

    return {
      code: 201,
      message: '创建成功，已提交审核',
      data: this.mapDishUploadToAdminDishDto(dishUpload),
    };
  }

  /**
   * 管理端更新菜品
   */
  async updateAdminDish(
    id: string,
    updateDto: AdminUpdateDishDto,
    adminInfo: any,
  ) {
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
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.images !== undefined) updateData.images = updateDto.images;
    if (updateDto.parentDishId !== undefined)
      updateData.parentDishId = updateDto.parentDishId;
    if (updateDto.ingredients !== undefined)
      updateData.ingredients = updateDto.ingredients;
    if (updateDto.allergens !== undefined)
      updateData.allergens = updateDto.allergens;
    if (updateDto.spicyLevel !== undefined)
      updateData.spicyLevel = updateDto.spicyLevel;
    if (updateDto.sweetness !== undefined)
      updateData.sweetness = updateDto.sweetness;
    if (updateDto.saltiness !== undefined)
      updateData.saltiness = updateDto.saltiness;
    if (updateDto.oiliness !== undefined)
      updateData.oiliness = updateDto.oiliness;
    if (updateDto.availableMealTime !== undefined)
      updateData.availableMealTime = updateDto.availableMealTime;
    if (updateDto.availableDates !== undefined)
      updateData.availableDates = updateDto.availableDates as any;
    if (updateDto.status !== undefined) updateData.status = updateDto.status;

    // 位置相关信息（食堂/窗口）
    let window: any = null;
    let shouldUpdateWindow = false;

    if (updateDto.windowId) {
      window = await this.prisma.window.findUnique({
        where: { id: updateDto.windowId },
        include: { canteen: true, floor: true },
      });
      shouldUpdateWindow = true;
    } else if (updateDto.windowName || updateDto.windowNumber) {
      // 如果提供了窗口名称或编号，则需要先确定食堂ID
      let canteenId = updateDto.canteenId;
      if (!canteenId && updateDto.canteenName) {
        const canteen = await this.prisma.canteen.findFirst({
          where: { name: updateDto.canteenName },
        });
        if (canteen) canteenId = canteen.id;
      }
      if (!canteenId) {
        canteenId = existingDish.canteenId;
      }

      if (updateDto.windowName) {
        window = await this.prisma.window.findFirst({
          where: { canteenId, name: updateDto.windowName },
          include: { canteen: true, floor: true },
        });
      }

      if (!window && updateDto.windowNumber) {
        window = await this.prisma.window.findFirst({
          where: { canteenId, number: updateDto.windowNumber },
          include: { canteen: true, floor: true },
        });
      }
      shouldUpdateWindow = true;
    }

    if (shouldUpdateWindow) {
      if (!window) {
        throw new BadRequestException(
          '指定的窗口不存在，请提供有效的窗口ID、名称或编号',
        );
      }

      if (adminInfo.canteenId && window.canteenId !== adminInfo.canteenId) {
        throw new ForbiddenException('不能将菜品移动到其他食堂');
      }

      updateData.canteenId = window.canteenId;
      updateData.canteenName = window.canteen.name;
      updateData.floorId = window.floorId;
      updateData.floorLevel = window.floor?.level;
      updateData.floorName = window.floor?.name;
      updateData.windowId = window.id;
      updateData.windowNumber = window.number;
      updateData.windowName = window.name;
    }

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
      data: this.mapToAdminDishDto(dish),
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

  private mapToAdminDishDto(dish: any): AdminDishDto {
    return {
      id: dish.id,
      name: dish.name,
      tags: dish.tags,
      price: dish.price,
      description: dish.description,
      images: dish.images,
      ingredients: dish.ingredients,
      allergens: dish.allergens,
      spicyLevel: dish.spicyLevel,
      sweetness: dish.sweetness,
      saltiness: dish.saltiness,
      oiliness: dish.oiliness,
      canteenId: dish.canteenId,
      canteenName: dish.canteenName,
      floorId: dish.floorId,
      floorLevel: dish.floorLevel,
      floorName: dish.floorName,
      windowId: dish.windowId,
      windowNumber: dish.windowNumber,
      windowName: dish.windowName,
      availableMealTime: dish.availableMealTime,
      availableDates: dish.availableDates,
      status: dish.status,
      averageRating: dish.averageRating,
      reviewCount: dish.reviewCount,
      createdAt: dish.createdAt,
      updatedAt: dish.updatedAt,
    };
  }

  private mapDishUploadToAdminDishDto(
    dishUpload: Prisma.DishUploadGetPayload<{
      include: {
        canteen: true;
        window: { include: { floor: true } };
        parentDish: true;
      };
    }>,
  ): AdminDishDto {
    return {
      id: dishUpload.id,
      name: dishUpload.name,
      tags: dishUpload.tags,
      price: dishUpload.price,
      description: dishUpload.description,
      images: dishUpload.images,
      ingredients: dishUpload.ingredients,
      allergens: dishUpload.allergens,
      spicyLevel: dishUpload.spicyLevel,
      sweetness: dishUpload.sweetness,
      saltiness: dishUpload.saltiness,
      oiliness: dishUpload.oiliness,
      canteenId: dishUpload.canteenId,
      canteenName: dishUpload.canteenName,
      // DishUpload 表中没有存储楼层信息，从关联的 window 获取
      floorId: dishUpload.window?.floorId || null,
      floorLevel: dishUpload.window?.floor?.level || null,
      floorName: dishUpload.window?.floor?.name || null,
      windowId: dishUpload.windowId,
      windowNumber: dishUpload.windowNumber,
      windowName: dishUpload.windowName,
      availableMealTime: dishUpload.availableMealTime as any,
      availableDates: dishUpload.availableDates as any,
      status: dishUpload.status as DishUploadStatus,
      averageRating: 0,
      reviewCount: 0,
      createdAt: dishUpload.createdAt,
      updatedAt: dishUpload.updatedAt,
    };
  }
}
