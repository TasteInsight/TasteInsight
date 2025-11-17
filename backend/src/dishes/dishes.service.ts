import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetDishesDto, SortOrder } from './dto/get-dishes.dto';
import { UploadDishDto } from './dto/upload-dish.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DishesService {
  constructor(private prisma: PrismaService) {}

  // 获取菜品详情
  async getDishById(id: string) {
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

    return {
      code: 200,
      message: 'success',
      data: dish,
    };
  }

  // 获取菜品列表
  async getDishes(getDishesDto: GetDishesDto) {
    const { filter, search, sort, pagination } = getDishesDto;
    
    // 构建 where 条件 - 使用数组来确保类型正确
    const andConditions: Prisma.DishWhereInput[] = [];

    // 状态筛选：默认只显示 online 的菜品
    if (!filter.includeOffline) {
      andConditions.push({ status: 'online' });
    }

    // 评分筛选
    if (filter.rating) {
      andConditions.push({
        averageRating: {
          gte: filter.rating.min,
          lte: filter.rating.max,
        },
      });
    }

    // 供应时间筛选
    if (filter.mealTime && filter.mealTime.length > 0) {
      andConditions.push({
        availableMealTime: {
          hasSome: filter.mealTime,
        },
      });
    }

    // 价格筛选
    if (filter.price) {
      andConditions.push({
        price: {
          gte: filter.price.min,
          lte: filter.price.max,
        },
      });
    }

    // 标签筛选
    if (filter.tag && filter.tag.length > 0) {
      andConditions.push({
        tags: {
          hasSome: filter.tag,
        },
      });
    }

    // 食堂筛选
    if (filter.canteenId && filter.canteenId.length > 0) {
      andConditions.push({
        canteenId: {
          in: filter.canteenId,
        },
      });
    }

    // 辣度筛选
    if (filter.spicyLevel) {
      andConditions.push({
        spicyLevel: {
          gte: filter.spicyLevel.min,
          lte: filter.spicyLevel.max,
        },
      });
    }

    // 肉类偏好筛选
    if (filter.meatPreference && filter.meatPreference.length > 0) {
      andConditions.push({
        ingredients: {
          hasSome: filter.meatPreference,
        },
      });
    }

    // 避免食材筛选（菜品不包含这些食材）
    if (filter.avoidIngredients && filter.avoidIngredients.length > 0) {
      andConditions.push({
        NOT: {
          ingredients: {
            hasSome: filter.avoidIngredients,
          },
        },
      });
    }

    // 喜欢食材筛选（菜品包含这些食材）
    if (filter.favoriteIngredients && filter.favoriteIngredients.length > 0) {
      andConditions.push({
        ingredients: {
          hasSome: filter.favoriteIngredients,
        },
      });
    }

    // 甜度筛选
    if (filter.sweetness) {
      andConditions.push({
        sweetness: {
          gte: filter.sweetness.min,
          lte: filter.sweetness.max,
        },
      });
    }

    // 咸度筛选
    if (filter.saltiness) {
      andConditions.push({
        saltiness: {
          gte: filter.saltiness.min,
          lte: filter.saltiness.max,
        },
      });
    }

    // 油度筛选
    if (filter.oiliness) {
      andConditions.push({
        oiliness: {
          gte: filter.oiliness.min,
          lte: filter.oiliness.max,
        },
      });
    }

    // 搜索条件
    if (search.keyword) {
      const searchFields = search.fields || ['name', 'description', 'tags'];
      const orConditions: Prisma.DishWhereInput[] = [];

      if (searchFields.includes('name')) {
        orConditions.push({ name: { contains: search.keyword, mode: 'insensitive' } });
      }
      if (searchFields.includes('description')) {
        orConditions.push({ description: { contains: search.keyword, mode: 'insensitive' } });
      }
      if (searchFields.includes('tags')) {
        orConditions.push({ tags: { has: search.keyword } });
      }

      if (orConditions.length > 0) {
        andConditions.push({ OR: orConditions });
      }
    }

    // 构建最终的 where 条件
    const where: Prisma.DishWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    // 排序
    const orderBy: Prisma.DishOrderByWithRelationInput = {};
    if (sort.field) {
      orderBy[sort.field] = sort.order || SortOrder.ASC;
    } else {
      // 默认按评分降序
      orderBy.averageRating = SortOrder.DESC;
    }

    // 分页
    const skip = (pagination.page - 1) * pagination.pageSize;
    const take = pagination.pageSize;

    // 查询
    const [items, total] = await Promise.all([
      this.prisma.dish.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          canteen: true,
          window: true,
        },
      }),
      this.prisma.dish.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages,
        },
      },
    };
  }

  // 收藏菜品
  async favoriteDish(dishId: string, userId: string) {
    // 检查菜品是否存在
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查是否已经收藏
    const existing = await this.prisma.favoriteDish.findUnique({
      where: {
        userId_dishId: {
          userId,
          dishId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('已经收藏过该菜品');
    }

    // 创建收藏记录
    await this.prisma.favoriteDish.create({
      data: {
        userId,
        dishId,
      },
    });

    // 获取收藏总数
    const favoriteCount = await this.prisma.favoriteDish.count({
      where: { dishId },
    });

    return {
      code: 200,
      message: '收藏成功',
      data: {
        isFavorited: true,
        favoriteCount,
      },
    };
  }

  // 取消收藏菜品
  async unfavoriteDish(dishId: string, userId: string) {
    // 检查菜品是否存在
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 检查是否已收藏
    const existing = await this.prisma.favoriteDish.findUnique({
      where: {
        userId_dishId: {
          userId,
          dishId,
        },
      },
    });

    if (!existing) {
      throw new BadRequestException('尚未收藏该菜品');
    }

    // 删除收藏记录
    await this.prisma.favoriteDish.delete({
      where: {
        userId_dishId: {
          userId,
          dishId,
        },
      },
    });

    // 获取收藏总数
    const favoriteCount = await this.prisma.favoriteDish.count({
      where: { dishId },
    });

    return {
      code: 200,
      message: '取消收藏成功',
      data: {
        isFavorited: false,
        favoriteCount,
      },
    };
  }

  // 用户上传菜品
  async uploadDish(uploadDishDto: UploadDishDto, userId: string) {
    // 创建 DishUpload 记录
    const dishUpload = await this.prisma.dishUpload.create({
      data: {
        userId,
        name: uploadDishDto.name || '未命名菜品',
        tags: uploadDishDto.tags || [],
        price: uploadDishDto.price,
        description: uploadDishDto.description,
        images: uploadDishDto.images || [],
        ingredients: uploadDishDto.ingredients || [],
        allergens: uploadDishDto.allergens || [],
        spicyLevel: uploadDishDto.spicyLevel ?? 2,
        sweetness: uploadDishDto.sweetness ?? 2,
        saltiness: uploadDishDto.saltiness ?? 2,
        oiliness: uploadDishDto.oiliness ?? 2,
        canteenName: uploadDishDto.canteenName,
        floor: uploadDishDto.floor,
        windowNumber: uploadDishDto.windowNumber,
        windowName: uploadDishDto.windowName,
        availableMealTime: uploadDishDto.availableMealTime,
        availableDates: uploadDishDto.availableDates as any,
        status: 'pending', // 默认为待审核状态
      },
    });

    return {
      code: 201,
      message: '上传成功，等待审核',
      data: {
        id: dishUpload.id,
        status: dishUpload.status,
      },
    };
  }
}
