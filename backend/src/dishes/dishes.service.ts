import { contributionModerationText } from '@/content-moderation/moderation.types';
import { ModerationSubmissionService } from '@/content-moderation/moderation-submission.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  ConflictException,
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
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import {
  contributionSnapshot,
  prepareContribution,
  requestFingerprint,
} from './contribution-fields';
import { claimContributionImages } from '@/upload/contribution-images';

@Injectable()
export class DishesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
    @Optional() private readonly moderation?: ModerationSubmissionService,
  ) {}

  // 获取菜品详情
  async getDishById(id: string, userId?: string): Promise<DishResponseDto> {
    const dish = await this.prisma.dish.findUnique({
      where: { id, ...(!userId ? { status: 'online' } : {}) },
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: userId ? true : { where: { status: 'online' } },
      },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    // 记录用户浏览历史
    // 使用 upsert 操作确保原子性，避免并发请求导致的重复记录
    // 如果记录已存在，更新 viewedAt；否则创建新记录
    if (userId)
      try {
        await this.prisma.browseHistory.upsert({
          where: {
            userId_dishId: {
              userId,
              dishId: id,
            },
          },
          update: {
            viewedAt: new Date(),
          },
          create: {
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
      data: DishDto.fromEntity({
        ...dish,
        ...(!userId && dish.parentDish?.status !== 'online'
          ? { parentDishId: null }
          : {}),
      }),
    };
  }

  // 批量获取菜品详情
  async getDishesByIds(
    ids: string[],
    userId?: string,
  ): Promise<DishListResponseDto> {
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

    // 批量查询菜品
    const dishes = await this.prisma.dish.findMany({
      where: {
        id: { in: ids },
        ...(!userId ? { status: 'online' } : {}),
      },
      include: {
        canteen: true,
        window: true,
        parentDish: true,
        subDishes: userId ? true : { where: { status: 'online' } },
      },
    });

    // 按照请求的 ID 顺序返回（保持顺序一致）
    const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
    const sortedDishes = ids
      .map((id) => dishMap.get(id))
      .filter((dish) => dish != null);

    const items = sortedDishes.map((dish) =>
      DishDto.fromEntity({
        ...dish,
        ...(!userId && dish.parentDish?.status !== 'online'
          ? { parentDishId: null }
          : {}),
      }),
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

  // 获取菜品列表
  async getDishes(
    getDishesDto: GetDishesDto,
    userId?: string,
  ): Promise<DishListResponseDto> {
    const { filter, search, sort, pagination } = getDishesDto;

    // 构建 where 条件 - 使用数组来确保类型正确
    const andConditions: Prisma.DishWhereInput[] = [];

    // 游客仅可查看在售菜品；登录用户可显式筛选状态。
    if (!userId) {
      andConditions.push({ status: 'online' });
    }
    if (filter.status) {
      andConditions.push({ status: filter.status });
    } else if (userId && !filter.includeOffline) {
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
    if (filter.windowId && filter.windowId.length > 0) {
      andConditions.push({ windowId: { in: filter.windowId } });
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
      if (searchFields.includes('ingredients')) {
        orConditions.push({
          ingredients: { has: search.keyword },
        });
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
        orderBy: [orderBy, { id: 'asc' }],
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
    const fingerprint = requestFingerprint(uploadDishDto);
    const dishUpload = await this.prisma.$transaction(async (tx) => {
      if (uploadDishDto.clientRequestId) {
        // Serialize the same user's retry key before the unique-row lookup.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`${userId}:${uploadDishDto.clientRequestId}`}, 0))`;
        const existing = await tx.dishUpload.findUnique({
          where: {
            userId_clientRequestId: {
              userId,
              clientRequestId: uploadDishDto.clientRequestId,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== fingerprint)
            throw new ConflictException('请求标识已用于另一份资料，请重新提交');
          return existing;
        }
      }
      const target = uploadDishDto.targetDishId
        ? await tx.dish.findUnique({
            where: { id: uploadDishDto.targetDishId },
          })
        : null;
      if (uploadDishDto.targetDishId && !target)
        throw new NotFoundException('待补全菜品不存在');
      const data = await prepareContribution(tx, uploadDishDto, target);
      const created = await tx.dishUpload.create({
        data: {
          ...data,
          userId,
          status: 'pending',
          kind: target ? 'update' : 'create',
          targetDishId: target?.id ?? null,
          parentDishId: target ? null : (uploadDishDto.parentDishId ?? null),
          baseSnapshot: target ? contributionSnapshot(target) : undefined,
          clientRequestId: uploadDishDto.clientRequestId,
          requestHash: uploadDishDto.clientRequestId ? fingerprint : undefined,
        } as Prisma.DishUploadUncheckedCreateInput,
      });
      await claimContributionImages(
        tx,
        userId,
        data.images,
        created.id,
        target?.images ?? [],
      );
      const policy = await this.moderation?.policy(tx);
      if (policy)
        await this.moderation!.submit(tx, policy, {
          targetType: 'dishUpload',
          targetId: created.id,
          userId,
          version: String(created.revision),
          text: contributionModerationText(created),
          images: created.images,
        });
      return created;
    });

    return {
      code: 201,
      message: '上传成功，等待审核',
      data: {
        id: dishUpload.id,
        status: dishUpload.status,
        revision: dishUpload.revision,
      },
    };
  }
}
