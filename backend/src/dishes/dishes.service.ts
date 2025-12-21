import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { GetDishesDto, SortOrder } from './dto/get-dishes.dto';
import { UploadDishDto } from './dto/upload-dish.dto';
import { DishDto } from './dto/dish.dto';
import { Prisma } from '@prisma/client';
import {
  DishListResponseDto,
  DishResponseDto,
  DishUploadResponseDto,
  FavoriteStatusResponseDto,
} from './dto/dish-response.dto';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { createHash } from 'crypto';

@Injectable()
export class DishesService {
  constructor(
    private prisma: PrismaService,
    private recommendationService: RecommendationService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
  ) {}

  // 获取菜品详情
  async getDishById(id: string, userId: string): Promise<DishResponseDto> {
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

    // 记录用户浏览历史
    try {
      await this.prisma.browseHistory.create({
        data: {
          userId,
          dishId: id,
        },
      });
    } catch (error) {
      // 记录失败不影响主要功能，静默处理
      console.warn('Failed to record browse history:', error);
    }

    return {
      code: 200,
      message: 'success',
      data: DishDto.fromEntity(dish),
    };
  }

  // 获取菜品列表
  async getDishes(
    getDishesDto: GetDishesDto,
    userId: string,
  ): Promise<DishListResponseDto> {
    const { isSuggestion, filter, search, sort, pagination } = getDishesDto;

    // 如果是推荐模式，调用推荐服务
    // isSuggestion 为 true 时使用默认 HOME 场景的推荐
    if (isSuggestion) {
      // 生成稳定的 requestId，确保同一个推荐会话（相同的 filter 和 search）
      // 在不同页之间返回一致的结果
      const requestIdSeed = JSON.stringify({
        userId,
        filter,
        search: search?.keyword || '',
        // 不包含 pagination，因为我们希望同一个会话的不同页使用相同的 requestId
      });
      const requestId = createHash('md5').update(requestIdSeed).digest('hex');

      const result = await this.recommendationService.getRecommendations(
        userId,
        {
          filter,
          search: search?.keyword ? search : undefined,
          pagination,
          requestId, // 传递 requestId 以保持分页一致性
          // 默认首页推荐场景，不追踪详细事件
        },
      );

      // 获取推荐的菜品ID列表
      const dishIds = result.data.items.map((item) => item.id);

      // 批量查询完整的菜品数据（推荐服务已经处理了过敏原过滤）
      const fullDishes = await this.prisma.dish.findMany({
        where: {
          id: { in: dishIds },
          status: 'online',
        },
        include: {
          canteen: true,
          window: true,
          floor: true,
          subDishes: {
            select: { id: true },
          },
        },
      });

      // 按照推荐顺序排序
      const dishMap = new Map(fullDishes.map((dish) => [dish.id, dish]));
      const sortedDishes = dishIds
        .map((id) => dishMap.get(id))
        .filter((dish) => dish != null);

      // 使用推荐服务返回的 total
      const totalPages = Math.ceil(
        result.data.meta.total / pagination.pageSize,
      );

      return {
        code: result.code,
        message: result.message,
        data: {
          items: sortedDishes.map((dish) => DishDto.fromEntity(dish)),
          meta: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: result.data.meta.total,
            totalPages,
          },
        },
      };
    }

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
    // 0 表示未设置，应该保留在结果中（不参与筛选）
    if (filter.spicyLevel) {
      andConditions.push({
        OR: [
          { spicyLevel: 0 }, // 未设置的菜品保留
          {
            spicyLevel: {
              gte: filter.spicyLevel.min,
              lte: filter.spicyLevel.max,
            },
          },
        ],
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
        OR: [
          { sweetness: 0 }, // 未设置的菜品保留
          {
            sweetness: {
              gte: filter.sweetness.min,
              lte: filter.sweetness.max,
            },
          },
        ],
      });
    }

    // 咸度筛选
    if (filter.saltiness) {
      andConditions.push({
        OR: [
          { saltiness: 0 }, // 未设置的菜品保留
          {
            saltiness: {
              gte: filter.saltiness.min,
              lte: filter.saltiness.max,
            },
          },
        ],
      });
    }

    // 油度筛选
    if (filter.oiliness) {
      andConditions.push({
        OR: [
          { oiliness: 0 }, // 未设置的菜品保留
          {
            oiliness: {
              gte: filter.oiliness.min,
              lte: filter.oiliness.max,
            },
          },
        ],
      });
    }

    // 搜索条件
    if (search.keyword) {
      const searchFields = search.fields || ['name', 'description', 'tags'];
      const orConditions: Prisma.DishWhereInput[] = [];

      if (searchFields.includes('name')) {
        orConditions.push({
          name: { contains: search.keyword, mode: 'insensitive' },
        });
      }
      if (searchFields.includes('description')) {
        orConditions.push({
          description: { contains: search.keyword, mode: 'insensitive' },
        });
      }
      if (searchFields.includes('tags')) {
        orConditions.push({ tags: { has: search.keyword } });
      }

      if (orConditions.length > 0) {
        andConditions.push({ OR: orConditions });
      }
    }

    // 构建最终的 where 条件
    const where: Prisma.DishWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // 排序
    // sort.field 已通过 DishSortField 枚举在 DTO 层进行白名单验证，防止字段注入攻击
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
        items: items.map((dish) => DishDto.fromEntity(dish)),
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
  async favoriteDish(
    dishId: string,
    userId: string,
  ): Promise<FavoriteStatusResponseDto> {
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

    // 异步刷新用户嵌入（收藏变化会影响推荐）
    if (this.embeddingQueueService) {
      await this.embeddingQueueService.enqueueRefreshUser(userId);
    }

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
  async unfavoriteDish(
    dishId: string,
    userId: string,
  ): Promise<FavoriteStatusResponseDto> {
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

    // 异步刷新用户嵌入（收藏变化会影响推荐）
    if (this.embeddingQueueService) {
      await this.embeddingQueueService.enqueueRefreshUser(userId);
    }

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
  async uploadDish(
    uploadDishDto: UploadDishDto,
    userId: string,
  ): Promise<DishUploadResponseDto> {
    // 1. 确定食堂
    let canteenId = uploadDishDto.canteenId;
    let canteenName = uploadDishDto.canteenName;

    if (canteenId) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
      canteenName = canteen.name;
    } else {
      const canteen = await this.prisma.canteen.findFirst({
        where: { name: canteenName },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
      canteenId = canteen.id;
    }

    // 2. 确定窗口（可选）
    let windowId = uploadDishDto.windowId;
    let windowName = uploadDishDto.windowName;
    let windowNumber = uploadDishDto.windowNumber;

    let window: any = null;

    // 首先尝试按 ID 查找
    if (windowId) {
      window = await this.prisma.window.findUnique({
        where: { id: windowId },
      });
      // 验证窗口是否属于该食堂
      if (window && window.canteenId !== canteenId) {
        throw new BadRequestException('指定的窗口不属于该食堂');
      }
    }

    // 如果未通过 ID 找到（或未提供 ID），尝试按名称查找
    if (!window && windowName) {
      window = await this.prisma.window.findFirst({
        where: { canteenId, name: windowName },
      });
    }

    // 如果仍未找到，尝试按窗口号查找
    if (!window && windowNumber) {
      window = await this.prisma.window.findFirst({
        where: { canteenId, number: windowNumber },
      });
    }

    // 如果找到，使用权威信息
    if (window) {
      windowId = window.id;
      windowName = window.name;
      windowNumber = window.number;
    } else {
      // 如果未找到，说明用户提供的信息有误
      if (windowId || windowName || windowNumber) {
        throw new BadRequestException('指定的窗口不存在或信息不完整');
      }
    }

    // 创建 DishUpload 记录
    const dishUpload = await this.prisma.dishUpload.create({
      data: {
        userId,
        name: uploadDishDto.name || '未命名菜品',
        tags: uploadDishDto.tags || [],
        price: uploadDishDto.price,
        priceUnit: uploadDishDto.priceUnit,
        description: uploadDishDto.description,
        images: uploadDishDto.images || [],
        ingredients: uploadDishDto.ingredients || [],
        allergens: uploadDishDto.allergens || [],
        spicyLevel: uploadDishDto.spicyLevel ?? 0,
        sweetness: uploadDishDto.sweetness ?? 0,
        saltiness: uploadDishDto.saltiness ?? 0,
        oiliness: uploadDishDto.oiliness ?? 0,
        canteenId: canteenId,
        canteenName: canteenName,
        windowId: windowId,
        windowNumber: windowNumber,
        windowName: windowName,
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
