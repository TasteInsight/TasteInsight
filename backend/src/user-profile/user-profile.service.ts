import { contributionModerationText } from '@/content-moderation/moderation.types';
import { randomUUID } from 'crypto';
import { ModerationSubmissionService } from '@/content-moderation/moderation-submission.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import {
  Injectable,
  NotFoundException,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import { DishUpload, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import {
  UpdateUserProfileDto,
  UpdateUserPreferencesDto,
  UpdateUserSettingsDto,
} from './dto/update-user-profile.dto';
import {
  UserBrowseHistoryResponseDto,
  UserFavoriteListResponseDto,
  UserProfileResponseDto,
  UserReportListResponseDto,
  UserReviewListResponseDto,
  UserUploadListResponseDto,
} from './dto/user-response.dto';
import { SuccessResponseDto } from '@/common/dto/response.dto';
import {
  UserFavoriteData,
  UserHistoryData,
  UserPreferenceData,
  UserProfileData,
  UserReportData,
  UserReviewData,
  UserSettingData,
  UserUploadData,
} from '@/user-profile/dto/user.dto';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { isCurrentStudent } from '@/auth/student-status';
import {
  assertRevision,
  contributionSnapshot,
  prepareContribution,
} from '@/dishes/contribution-fields';
import { claimContributionImages } from '@/upload/contribution-images';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { DishDto } from '@/dishes/dto/dish.dto';

@Injectable()
export class UserProfileService {
  constructor(
    private prisma: PrismaService,
    @Optional() private embeddingQueueService?: EmbeddingQueueService,
    @Optional() private readonly moderation?: ModerationSubmissionService,
    @Optional() private readonly moderationAssets?: ModerationAssetsService,
  ) {}

  // 创建用户入口（由用户模块负责），缺省值由数据库默认值提供
  async createUser(openId: string) {
    return this.prisma.user.create({
      data: {
        openId,
        nickname: `微信用户_${openId.slice(-4)}`,
        allergens: [],
        preferences: {
          create: {},
        },
        settings: {
          create: {},
        },
      },
      include: { settings: true, preferences: true },
    });
  }

  async getUserProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        settings: true,
        studentVerification: true,
        favoriteDishes: { select: { dishId: true } },
        reviews: { select: { id: true } },
        comments: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('用户未找到');
    }

    const u: any = user;
    const data = this.mapToUserProfileDto(u);
    if (this.moderation) {
      data.publicProfileSubmission = null;
      const latest = await this.prisma.contentModerationTask.findFirst({
        where: { targetType: 'profile', targetId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (latest && !['approved', 'superseded'].includes(latest.status)) {
        const fields = {
          ...((latest.profilePatch ?? {}) as Record<string, string | null>),
        };
        if (fields.avatar)
          fields.avatar =
            this.moderationAssets?.previewImages([fields.avatar])[0] ??
            fields.avatar;
        data.publicProfileSubmission = {
          status: latest.status,
          fields,
          reason: latest.reason,
        };
      }
    }
    return {
      code: 200,
      message: 'success',
      data,
    };
  }

  async updateUserProfile(
    userId: string,
    updateDto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const { preferences, settings, ...userData } = updateDto;

    const userUpdatePayload = Object.fromEntries(
      Object.entries(userData).filter(([_, value]) => value !== undefined),
    );

    // 标记是否需要刷新用户嵌入（避免重复刷新）
    let needRefreshEmbedding = false;

    // 检查是否更新了 allergens（过敏原变化会影响推荐）
    if (userUpdatePayload.allergens !== undefined) {
      needRefreshEmbedding = true;
    }

    let submitted = false;
    await this.prisma.$transaction(async (tx) => {
      if (this.moderation) {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const policy = await this.moderation.policy(tx);
        const profilePatch = Object.fromEntries(
          Object.entries(userUpdatePayload).filter(([key]) =>
            ['nickname', 'avatar', 'bio'].includes(key),
          ),
        ) as Record<string, string>;
        if (Object.keys(profilePatch).length) {
          // Merge pending edits so changing the bio preserves a pending nickname.
          const previous = await tx.contentModerationTask.findFirst({
            where: {
              targetType: 'profile',
              targetId: userId,
              status: {
                in: [
                  'queued',
                  'processing',
                  'waiting',
                  'ready',
                  'manual',
                  'failed',
                ],
              },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          });
          const patch = {
            ...((previous?.profilePatch ?? {}) as Record<string, string>),
            ...profilePatch,
          };
          await this.moderation.submit(tx, policy, {
            targetType: 'profile',
            targetId: userId,
            userId,
            version: randomUUID(),
            text: [patch.nickname, patch.bio].filter(Boolean).join('\n'),
            images: patch.avatar ? [patch.avatar] : [],
            profilePatch: patch,
          });
          if (!policy.enabled) {
            await tx.contentModerationTask.updateMany({
              where: {
                targetType: 'profile',
                targetId: userId,
                status: 'rejected',
              },
              data: { status: 'superseded', lockedUntil: null },
            });
            if (profilePatch.avatar)
              await this.moderationAssets?.approve(tx, [profilePatch.avatar]);
          }
          if (policy.enabled) {
            submitted = true;
            for (const key of Object.keys(profilePatch))
              delete userUpdatePayload[key];
          }
        }
      }
      if (Object.keys(userUpdatePayload).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdatePayload,
        });
      }

      // Update Preferences if provided
      if (preferences) {
        const preferenceData = this.mapToUserPreferencesUpdateData(preferences);

        await tx.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            ...preferenceData,
          },
          update: preferenceData,
        });

        // 偏好变化会影响推荐
        needRefreshEmbedding = true;
      }

      // Update Settings if provided
      if (settings) {
        const settingsData = this.mapToUserSettingsUpdateData(settings);
        await tx.userSetting.upsert({
          where: { userId },
          create: {
            userId,
            ...settingsData,
          },
          update: settingsData,
        });
      }
    });

    // 所有更新完成后，统一触发一次嵌入刷新（避免重复）
    if (needRefreshEmbedding && this.embeddingQueueService) {
      await this.embeddingQueueService.enqueueRefreshUser(userId);
    }

    const response = await this.getUserProfile(userId);
    if (submitted) response.message = '公开资料已提交审核';
    return response;
  }

  async getMyReviews(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserReviewListResponseDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId, deletedAt: null },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          dish: { select: { name: true, images: true } },
          user: { select: { nickname: true, avatar: true } },
        },
      }),
      this.prisma.review.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToUserReviewItemDto(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async getMyFavorites(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserFavoriteListResponseDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.favoriteDish.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { addedAt: 'desc' },
        include: {
          dish: {
            select: {
              name: true,
              images: true,
              price: true,
              windowName: true,
              tags: true,
              averageRating: true,
              canteen: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.favoriteDish.count({ where: { userId } }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToUserFavoriteDishDto(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async getBrowseHistory(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserBrowseHistoryResponseDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.browseHistory.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { viewedAt: 'desc' },
        include: {
          dish: {
            select: {
              name: true,
              images: true,
              price: true,
              windowName: true,
              tags: true,
              averageRating: true,
              canteen: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.browseHistory.count({ where: { userId } }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToUserBrowseHistoryDto(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async clearBrowseHistory(userId: string): Promise<SuccessResponseDto> {
    await this.prisma.browseHistory.deleteMany({
      where: { userId },
    });
    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async getMyUploads(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserUploadListResponseDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.dishUpload.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.dishUpload.count({ where: { userId } }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToUserUploadDto(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async getMyUpload(userId: string, id: string) {
    const upload = await this.prisma.dishUpload.findUnique({
      where: { id, userId },
      include: { window: { include: { floor: true } } },
    });
    if (!upload) throw new NotFoundException('上传记录不存在');
    const target = upload.targetDishId
      ? await this.prisma.dish.findUnique({
          where: { id: upload.targetDishId },
        })
      : null;
    const {
      requestHash: _hash,
      refreshPending: _pending,
      approvedSnapshot: _approved,
      ...detail
    } = upload;
    return {
      code: 200,
      message: 'success',
      data: {
        ...detail,
        images:
          this.moderationAssets?.previewImages(upload.images) ?? upload.images,
        floorId: upload.window?.floorId ?? null,
        floorName: upload.window?.floor?.name ?? null,
        floorLevel: upload.window?.floor?.level ?? null,
        targetDish: target ? DishDto.fromEntity(target) : null,
      },
    };
  }

  async updateMyUpload(userId: string, id: string, dto: UpdateUploadDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const upload = await tx.dishUpload.findUnique({ where: { id, userId } });
      if (!upload) throw new NotFoundException('上传记录不存在');
      assertRevision(upload, dto.revision);
      if (!['pending', 'rejected'].includes(upload.status))
        throw new BadRequestException('仅待审核或未通过审核的资料可以修改');
      if (dto.targetDishId && dto.targetDishId !== upload.targetDishId)
        throw new BadRequestException('不能变更补全目标');
      if (
        dto.parentDishId !== undefined &&
        dto.parentDishId !== upload.parentDishId
      )
        throw new BadRequestException('不能变更父菜品');
      const target = upload.targetDishId
        ? await tx.dish.findUnique({ where: { id: upload.targetDishId } })
        : null;
      if (upload.targetDishId && !target)
        throw new NotFoundException('待补全菜品不存在');
      const data = await prepareContribution(tx, dto, target, upload);
      await claimContributionImages(
        tx,
        userId,
        data.images,
        id,
        target?.images ?? [],
      );
      const saved = await tx.dishUpload.update({
        where: { id },
        data: {
          ...data,
          status: 'pending',
          rejectReason: null,
          revision: upload.revision + 1,
          ...(target ? { baseSnapshot: contributionSnapshot(target) } : {}),
        } as Prisma.DishUploadUncheckedUpdateInput,
      });
      const policy = await this.moderation?.policy(tx);
      if (policy)
        await this.moderation!.submit(tx, policy, {
          targetType: 'dishUpload',
          targetId: id,
          userId,
          version: String(saved.revision),
          text: contributionModerationText(saved),
          images: saved.images,
        });
    });
    return this.getMyUpload(userId, id);
  }

  async withdrawMyUpload(userId: string, id: string, revision: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const upload = await tx.dishUpload.findUnique({ where: { id, userId } });
      if (!upload) throw new NotFoundException('上传记录不存在');
      assertRevision(upload, revision);
      if (!['pending', 'rejected'].includes(upload.status))
        throw new BadRequestException('仅待审核或未通过审核的资料可以撤回');
      const child = await tx.dishUpload.findFirst({
        where: { parentUploadId: id, status: { not: 'withdrawn' } },
        select: { id: true },
      });
      if (child)
        throw new BadRequestException('有关联的子菜品记录，暂不可撤回');
      await tx.dishUpload.update({
        where: { id },
        data: { status: 'withdrawn', revision: upload.revision + 1 },
      });
      await this.moderation?.cancel(tx, 'dishUpload', id);
    });
    return { code: 200, message: '已撤回', data: null };
  }

  async getMyReports(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<UserReportListResponseDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { reporterId: userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.report.count({ where: { reporterId: userId } }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToUserReportDto(item)),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  private mapToUserProfileDto(user: any): UserProfileData {
    return {
      id: user.id,
      openId: user.openId,
      nickname: user.nickname,
      avatar: user.avatar || '',
      bio: user.bio || '',
      capabilities: {
        canContribute: isCurrentStudent(user.studentVerification),
      },
      preferences: this.mapToUserPreferencesDto(user.preferences),
      settings: this.mapToUserSettingsDto(user.settings),
      allergens: user.allergens,
      myFavoriteDishes: user.favoriteDishes.map((f: any) => f.dishId),
      myReviews: user.reviews.map((r: any) => r.id),
      myComments: user.comments.map((c: any) => c.id),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private mapToUserPreferencesDto(preferences: any): UserPreferenceData {
    // 处理 preferences 为空的情况
    if (!preferences) {
      return {
        tagPreferences: [],
        priceRange: {
          min: 0,
          max: 50,
        },
        meatPreference: [],
        tastePreferences: {
          spicyLevel: 0,
          sweetness: 0,
          saltiness: 0,
          oiliness: 0,
        },
        canteenPreferences: [],
        portionSize: 'medium',
        favoriteIngredients: [],
        avoidIngredients: [],
      };
    }

    return {
      tagPreferences: preferences.tagPreferences || [],
      priceRange: {
        min: preferences.priceMin ?? 0,
        max: preferences.priceMax ?? 50,
      },
      meatPreference: preferences.meatPreference || [],
      tastePreferences: {
        spicyLevel: preferences.spicyLevel ?? 0,
        sweetness: preferences.sweetness ?? 0,
        saltiness: preferences.saltiness ?? 0,
        oiliness: preferences.oiliness ?? 0,
      },
      canteenPreferences: preferences.canteenPreferences || [],
      portionSize: preferences.portionSize || 'medium',
      favoriteIngredients: preferences.favoriteIngredients || [],
      avoidIngredients: preferences.avoidIngredients || [],
    };
  }

  private mapToUserPreferencesUpdateData(
    preferences: UpdateUserPreferencesDto,
  ) {
    const preferenceData: Record<string, any> = {
      spicyLevel: preferences.tastePreferences?.spicyLevel,
      tagPreferences: preferences.tagPreferences,
      priceMin: preferences.priceRange?.min,
      priceMax: preferences.priceRange?.max,
      meatPreference: preferences.meatPreference,
      sweetness: preferences.tastePreferences?.sweetness,
      saltiness: preferences.tastePreferences?.saltiness,
      oiliness: preferences.tastePreferences?.oiliness,
      canteenPreferences: preferences.canteenPreferences,
      portionSize: preferences.portionSize,
      favoriteIngredients: preferences.favoriteIngredients,
      avoidIngredients: preferences.avoidIngredients,
    };

    Object.keys(preferenceData).forEach(
      (key) => preferenceData[key] === undefined && delete preferenceData[key],
    );

    return preferenceData;
  }

  private mapToUserSettingsDto(settings: any): UserSettingData {
    // 处理 settings 为空的情况
    if (!settings) {
      return {
        showMealPlans: false,
        notificationSettings: {
          newDishAlert: true,
          priceChangeAlert: false,
          reviewReplyAlert: true,
          likeAlert: true,
          postReplyAlert: true,
          diningAlert: true,
          weeklyRecommendation: true,
        },
        displaySettings: {
          showCalories: true,
          showNutrition: false,
          sortBy: 'rating',
        },
      };
    }

    return {
      showMealPlans: settings.showMealPlans ?? false,
      notificationSettings: {
        newDishAlert: settings.newDishAlert ?? true,
        priceChangeAlert: settings.priceChangeAlert ?? false,
        reviewReplyAlert: settings.reviewReplyAlert ?? true,
        likeAlert: settings.likeAlert ?? true,
        postReplyAlert: settings.postReplyAlert ?? true,
        diningAlert: settings.diningAlert ?? true,
        weeklyRecommendation: settings.weeklyRecommendation ?? true,
      },
      displaySettings: {
        showCalories: settings.showCalories ?? true,
        showNutrition: settings.showNutrition ?? false,
        sortBy: settings.defaultSortBy || 'rating',
      },
    };
  }

  private mapToUserSettingsUpdateData(settings: UpdateUserSettingsDto) {
    const settingsData: Record<string, any> = {
      showMealPlans: settings.showMealPlans,
      newDishAlert: settings.notificationSettings?.newDishAlert,
      priceChangeAlert: settings.notificationSettings?.priceChangeAlert,
      reviewReplyAlert: settings.notificationSettings?.reviewReplyAlert,
      likeAlert: settings.notificationSettings?.likeAlert,
      postReplyAlert: settings.notificationSettings?.postReplyAlert,
      diningAlert: settings.notificationSettings?.diningAlert,
      weeklyRecommendation: settings.notificationSettings?.weeklyRecommendation,
      showCalories: settings.displaySettings?.showCalories,
      showNutrition: settings.displaySettings?.showNutrition,
      defaultSortBy: settings.displaySettings?.sortBy,
    };

    Object.keys(settingsData).forEach(
      (key) => settingsData[key] === undefined && delete settingsData[key],
    );

    return settingsData;
  }

  private mapToUserReviewItemDto(review: any): UserReviewData {
    const hasDetails =
      review.spicyLevel !== null ||
      review.sweetness !== null ||
      review.saltiness !== null ||
      review.oiliness !== null;

    return {
      id: review.id,
      dishId: review.dishId,
      userId: review.userId,
      userNickname: review.user.nickname,
      userAvatar: review.user.avatar || '',
      rating: review.rating,
      ratingDetails: hasDetails
        ? {
            spicyLevel: review.spicyLevel,
            sweetness: review.sweetness,
            saltiness: review.saltiness,
            oiliness: review.oiliness,
          }
        : null,
      content: review.content || '',
      images:
        this.moderationAssets?.previewImages(review.images) ?? review.images,
      status: review.status,
      createdAt: review.createdAt.toISOString(),
      dishName: review.dish.name,
      dishImage: review.dish.images[0] || '',
    };
  }

  private mapToUserFavoriteDishDto(favorite: any): UserFavoriteData {
    return {
      dishId: favorite.dishId,
      addedAt: favorite.addedAt.toISOString(),
      dishName: favorite.dish.name,
      dishImages: favorite.dish.images,
      dishPrice: favorite.dish.price,
      canteenName: favorite.dish.canteen.name,
      windowName: favorite.dish.windowName,
      tags: favorite.dish.tags,
      averageRating: favorite.dish.averageRating,
    };
  }

  private mapToUserBrowseHistoryDto(history: any): UserHistoryData {
    return {
      dishId: history.dishId,
      viewedAt:
        history.viewedAt instanceof Date
          ? history.viewedAt.toISOString()
          : history.viewedAt,
      dishName: history.dish.name,
      dishImages: history.dish.images,
      dishPrice: history.dish.price,
      canteenName: history.dish.canteen.name,
      windowName: history.dish.windowName,
      tags: history.dish.tags,
      averageRating: history.dish.averageRating,
    };
  }

  private mapToUserUploadDto(upload: DishUpload): UserUploadData {
    return {
      id: upload.id,
      name: upload.name,
      images:
        this.moderationAssets?.previewImages(upload.images) ?? upload.images,
      canteenName: upload.canteenName,
      windowName: upload.windowName,
      price: upload.price,
      priceUnit: upload.priceUnit,
      status: upload.status,
      rejectReason: upload.rejectReason,
      kind: upload.kind ?? 'create',
      targetDishId: upload.targetDishId ?? null,
      approvedDishId: upload.approvedDishId ?? null,
      revision: upload.revision ?? 1,
      createdAt: upload.createdAt.toISOString(),
    };
  }

  private mapToUserReportDto(report: any): UserReportData {
    return {
      id: report.id,
      reporterId: report.reporterId,
      reporterNickname: report.reporter.nickname,
      reporter: {
        id: report.reporter.id,
        nickname: report.reporter.nickname,
        avatar: report.reporter.avatar || null,
      },
      targetType: report.targetType,
      targetId: report.targetId,
      type: report.type,
      reason: report.reason,
      status: report.status,
      handleResult: report.handleResult ?? null,
      handledBy: report.handledBy ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      handledAt: report.handledAt ? report.handledAt.toISOString() : null,
    };
  }
}
