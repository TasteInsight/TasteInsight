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
import { Canteen, Dish, Floor, Prisma, Window } from '@prisma/client';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import {
  BatchConfirmRequestDto,
  BatchDishStatus,
  BatchParsedDishDto,
} from './dto/admin-dish-batch.dto';
import { splitToStringArray } from './utils/split-to-string-array.util';
import type { Express } from 'express';
import type { Buffer } from 'node:buffer';

type NormalizedExcelRow = {
  raw: Record<string, any>;
  canteenName?: string;
  floorName?: string;
  windowName?: string;
  windowNumber?: string;
  dishName?: string;
  subDishRaw?: string;
  priceRaw?: any;
  supplyTime?: string;
  supplyPeriodRaw?: string;
  description?: string;
  tagsRaw?: string;
};

type BatchImportCaches = {
  canteens: Map<string, Canteen>;
  floors: Map<string, Floor>;
  windows: Map<string, Window>;
  parentDishes: Map<string, Dish>;
};

type PrismaJsonInput =
  | Prisma.NullableJsonNullValueInput
  | Prisma.InputJsonValue;
type BatchErrorType = 'validation' | 'permission' | 'unknown';

@Injectable()
export class AdminDishesService {
  constructor(private prisma: PrismaService) {}

  private readonly MAX_BATCH_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  private readonly excelColumnMap: Record<string, keyof NormalizedExcelRow> = {
    食堂: 'canteenName',
    楼层: 'floorName',
    窗口: 'windowName',
    窗口编号: 'windowNumber',
    窗口号: 'windowNumber',
    菜品名: 'dishName',
    菜品子项: 'subDishRaw',
    价格: 'priceRaw',
    供应时间: 'supplyTime',
    供应时段: 'supplyPeriodRaw',
    菜品描述: 'description',
    描述: 'description',
    tags: 'tagsRaw',
    Tags: 'tagsRaw',
  };

  private readonly mealTimeDictionary = new Map<string, string>([
    ['早餐', 'breakfast'],
    ['早饭', 'breakfast'],
    ['午餐', 'lunch'],
    ['午饭', 'lunch'],
    ['中餐', 'lunch'],
    ['晚餐', 'dinner'],
    ['晚饭', 'dinner'],
    ['夜宵', 'nightsnack'],
    ['宵夜', 'nightsnack'],
    ['breakfast', 'breakfast'],
    ['lunch', 'lunch'],
    ['dinner', 'dinner'],
    ['nightsnack', 'nightsnack'],
  ]);

  // 管理端获取菜品列表
  async getAdminDishes(query: AdminGetDishesDto, adminInfo: any) {
    const { page = 1, pageSize = 20, canteenId, windowId, status, keyword } = query;

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

    // 如果指定了窗口ID
    if (windowId) {
      where.windowId = windowId;
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 关键字搜索
    // 只搜索关联表的实时数据，确保数据一致性（不搜索冗余字段，避免歧义）
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { canteen: { name: { contains: keyword, mode: 'insensitive' } } },
        { window: { name: { contains: keyword, mode: 'insensitive' } } },
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
        floor: true,
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
        floor: true,
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

    // 为了更稳健地确保返回的父菜品包含其子菜品 ID（有时关系加载可能未及时反映），
    // 额外查询一次子菜品列表并注入到返回 DTO 中。
    const childRows = await this.prisma.dish.findMany({
      where: { parentDishId: id },
      select: { id: true },
    });

    // 将子项 id 列表注入到 dish 对象，方便 mapToAdminDishDto 使用
    (dish as any).subDishes = childRows.map((r) => ({ id: r.id }));

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
        priceUnit: createDto.priceUnit,
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
    if (updateDto.priceUnit !== undefined)
      updateData.priceUnit = updateDto.priceUnit;
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
        floor: true,
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

  /**
   * 批量解析 Excel 文件
   */
  async parseBatchExcel(file: Express.Multer.File, adminInfo: any) {
    if (!file) {
      throw new BadRequestException('请上传 Excel 文件');
    }

    if (file.size > this.MAX_BATCH_FILE_SIZE) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    const limitedCanteen = adminInfo.canteenId
      ? await this.prisma.canteen.findUnique({
          where: { id: adminInfo.canteenId },
        })
      : null;

    const buffer = await this.readUploadedFile(file);
    let rows: Record<string, any>[] = [];

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      if (!workbook.SheetNames.length) {
        throw new Error('no-sheet');
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch (error) {
      throw new BadRequestException('无法解析 Excel 文件，请确认格式正确');
    }

    if (!rows.length) {
      throw new BadRequestException('Excel 文件内容为空');
    }

    const [canteens, floors, windows] = await Promise.all([
      this.prisma.canteen.findMany(),
      this.prisma.floor.findMany(),
      this.prisma.window.findMany(),
    ]);

    const canteenMap = new Map<string, Canteen>();
    canteens.forEach((c) => canteenMap.set(this.normalizeName(c.name), c));

    const floorMap = new Map<string, Floor>();
    floors.forEach((f) => {
      if (!f.name) return;
      const key = `${f.canteenId}:${this.normalizeName(f.name)}`;
      floorMap.set(key, f);
    });

    const windowMap = new Map<string, Window>();
    windows.forEach((w) => {
      const key = `${w.canteenId}:${this.normalizeName(w.name)}`;
      windowMap.set(key, w);
    });

    const items: BatchParsedDishDto[] = [];

    for (const row of rows) {
      const normalized = this.normalizeExcelRow(row);
      if (this.isRowEmpty(normalized)) {
        continue;
      }
      const item = this.buildParsedDish(
        normalized,
        canteenMap,
        floorMap,
        windowMap,
        limitedCanteen,
      );
      items.push(item);
    }

    if (!items.length) {
      throw new BadRequestException('未发现可解析的数据行');
    }

    const validCount = items.filter(
      (item) => item.status === BatchDishStatus.VALID,
    ).length;
    const warningCount = items.filter(
      (item) => item.status === BatchDishStatus.WARNING,
    ).length;
    const invalidCount = items.filter(
      (item) => item.status === BatchDishStatus.INVALID,
    ).length;

    return {
      code: 200,
      message: 'success',
      data: {
        total: items.length,
        validCount,
        warningCount,
        invalidCount,
        items,
      },
    };
  }

  /**
   * 批量确认导入
   */
  async confirmBatchImport(body: BatchConfirmRequestDto, adminInfo: any) {
    if (!body.dishes || body.dishes.length === 0) {
      throw new BadRequestException('没有可导入的数据');
    }

    const limitedCanteen = adminInfo.canteenId
      ? await this.prisma.canteen.findUnique({
          where: { id: adminInfo.canteenId },
        })
      : null;

    const [existingCanteens, existingFloors, existingWindows] =
      await Promise.all([
        this.prisma.canteen.findMany(),
        this.prisma.floor.findMany(),
        this.prisma.window.findMany(),
      ]);

    const caches: BatchImportCaches = {
      canteens: new Map(),
      floors: new Map(),
      windows: new Map(),
      parentDishes: new Map(),
    };

    existingCanteens.forEach((c) => {
      caches.canteens.set(this.normalizeName(c.name), c);
    });

    existingFloors.forEach((f) => {
      if (!f.name) return;
      const key = `${f.canteenId}:${this.normalizeName(f.name)}`;
      caches.floors.set(key, f);
    });

    existingWindows.forEach((w) => {
      const key = `${w.canteenId}:${this.normalizeName(w.name)}`;
      caches.windows.set(key, w);
    });

    if (limitedCanteen) {
      caches.canteens.set(
        this.normalizeName(limitedCanteen.name),
        limitedCanteen,
      );
    }

    const windowNumberCounters = new Map<string, number>();
    const errors: Array<{
      index: number;
      message: string;
      type: BatchErrorType;
    }> = [];
    let successCount = 0;

    for (let i = 0; i < body.dishes.length; i++) {
      const item = body.dishes[i];

      if (item.status === BatchDishStatus.INVALID) {
        errors.push({
          index: i,
          message: '数据标记为 invalid，已跳过',
          type: 'validation',
        });
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.processSingleBatchItem(
            tx,
            item,
            adminInfo,
            limitedCanteen,
            caches,
            windowNumberCounters,
          );
        });
        successCount += 1;
      } catch (error) {
        let type: BatchErrorType = 'unknown';
        let message = '导入失败';

        if (error instanceof BadRequestException) {
          type = 'validation';
          message = error.message;
        } else if (error instanceof ForbiddenException) {
          type = 'permission';
          message = error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }

        errors.push({ index: i, message, type });
      }
    }

    return {
      code: 200,
      message: 'success',
      data: {
        successCount,
        failCount: errors.length,
        errors,
      },
    };
  }

  private mapToAdminDishDto(dish: any): AdminDishDto {
    return {
      id: dish.id,
      name: dish.name,
      tags: dish.tags,
      price: dish.price,
      priceUnit: dish.priceUnit,
      description: dish.description,
      images: dish.images,
      parentDishId: dish.parentDishId,
      subDishId: dish.subDishes?.map((s: any) => s.id) ?? [],
      ingredients: dish.ingredients,
      allergens: dish.allergens,
      spicyLevel: dish.spicyLevel,
      sweetness: dish.sweetness,
      saltiness: dish.saltiness,
      oiliness: dish.oiliness,
      canteenId: dish.canteenId,
      canteenName: dish.canteen?.name || dish.canteenName,
      floorId: dish.floorId,
      floorLevel: dish.floor?.level || dish.floorLevel,
      floorName: dish.floor?.name || dish.floorName,
      windowId: dish.windowId,
      windowNumber: dish.window?.number || dish.windowNumber,
      windowName: dish.window?.name || dish.windowName,
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
      priceUnit: dishUpload.priceUnit,
      description: dishUpload.description,
      images: dishUpload.images,
      parentDishId: dishUpload.parentDishId || undefined,
      subDishId: [],
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

  /**
   * 管理端获取菜品评价列表
   */
  async getDishReviews(
    dishId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    // 检查菜品是否存在
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
    });

    if (!dish) {
      throw new NotFoundException('菜品不存在');
    }

    const skip = (page - 1) * pageSize;
    const where = { dishId, deletedAt: null };

    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              comments: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
    ]);

    const items = reviews.map((review) => {
      const hasDetails =
        review.spicyLevel !== null ||
        review.sweetness !== null ||
        review.saltiness !== null ||
        review.oiliness !== null;

      return {
        id: review.id,
        dishId: review.dishId,
        userId: review.userId,
        rating: review.rating,
        ratingDetails: hasDetails
          ? {
              spicyLevel: review.spicyLevel,
              sweetness: review.sweetness,
              saltiness: review.saltiness,
              oiliness: review.oiliness,
            }
          : null,
        content: review.content,
        images: review.images,
        status: review.status,
        rejectReason: review.rejectReason,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        deletedAt: review.deletedAt,
        user: {
          id: review.user.id,
          nickname: review.user.nickname,
          avatar: review.user.avatar,
        },
        commentCount: review._count.comments,
      };
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

  private async processSingleBatchItem(
    tx: Prisma.TransactionClient,
    item: BatchParsedDishDto,
    adminInfo: any,
    limitedCanteen: Canteen | null,
    caches: BatchImportCaches,
    windowNumberCounters: Map<string, number>,
  ) {
    const canteenName = item.canteenName?.trim() || limitedCanteen?.name || '';
    if (!canteenName) {
      throw new BadRequestException('食堂名称不能为空');
    }

    const dishName = item.name?.trim();
    if (!dishName) {
      throw new BadRequestException('菜品名称不能为空');
    }

    const price =
      typeof item.price === 'number' ? item.price : Number(item.price);
    if (Number.isNaN(price)) {
      throw new BadRequestException('价格格式不正确');
    }

    const priceUnit = item.priceUnit?.trim() || '元';
    const tags = (item.tags || [])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const subDishNames = (item.subDishNames || [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const canteen = await this.getOrCreateCanteen(
      tx,
      caches,
      canteenName,
      limitedCanteen,
    );

    if (adminInfo.canteenId && canteen.id !== adminInfo.canteenId) {
      throw new ForbiddenException('无权导入其他食堂的数据');
    }

    const floor = await this.getOrCreateFloor(
      tx,
      caches,
      canteen,
      item.floorName,
    );
    const window = await this.getOrCreateWindow(
      tx,
      caches,
      canteen,
      floor,
      item.windowName,
      item.windowNumber,
      windowNumberCounters,
    );

    const mealTimes = this.parseMealTimesFromItem(item);
    const dateRange = this.parseDateRange(item.supplyTime);
    const availableDates: PrismaJsonInput | undefined = dateRange
      ? [{ startDate: dateRange.startDate, endDate: dateRange.endDate }]
      : undefined;
    const description = item.description?.trim() || '';

    if (subDishNames.length > 0) {
      const parentDish = await this.getOrCreateParentDish(
        tx,
        caches,
        dishName,
        canteen,
        floor,
        window,
        tags,
        mealTimes,
        availableDates,
        description,
      );

      for (const subDishName of subDishNames) {
        await this.upsertDish(tx, {
          name: subDishName,
          price,
          priceUnit,
          description,
          tags,
          canteen,
          floor,
          window,
          availableMealTime: mealTimes,
          availableDates,
          parentDishId: parentDish.id,
        });
      }
    } else {
      await this.upsertDish(tx, {
        name: dishName,
        price,
        priceUnit,
        description,
        tags,
        canteen,
        floor,
        window,
        availableMealTime: mealTimes,
        availableDates,
        parentDishId: null,
      });
    }
  }

  private async getOrCreateCanteen(
    tx: Prisma.TransactionClient,
    caches: BatchImportCaches,
    canteenName: string,
    limitedCanteen: Canteen | null,
  ): Promise<Canteen> {
    if (limitedCanteen) {
      const allowedName = this.normalizeName(limitedCanteen.name);
      const incomingName = this.normalizeName(
        canteenName || limitedCanteen.name,
      );
      if (incomingName && allowedName !== incomingName) {
        throw new ForbiddenException('导入食堂与您的权限不匹配');
      }
      return limitedCanteen;
    }

    const normalized = this.normalizeName(canteenName);
    if (!normalized) {
      throw new BadRequestException('食堂名称不能为空');
    }

    if (caches.canteens.has(normalized)) {
      return caches.canteens.get(normalized)!;
    }

    let canteen = await tx.canteen.findFirst({ where: { name: canteenName } });
    if (!canteen) {
      canteen = await tx.canteen.create({
        data: {
          name: canteenName,
          openingHours: {},
        },
      });
    }

    caches.canteens.set(normalized, canteen);
    return canteen;
  }

  private async getOrCreateFloor(
    tx: Prisma.TransactionClient,
    caches: BatchImportCaches,
    canteen: Canteen,
    floorName?: string,
  ): Promise<Floor | null> {
    const trimmed = floorName?.trim();
    if (!trimmed) {
      return null;
    }

    const key = `${canteen.id}:${this.normalizeName(trimmed)}`;
    if (caches.floors.has(key)) {
      return caches.floors.get(key)!;
    }

    let floor = await tx.floor.findFirst({
      where: { canteenId: canteen.id, name: trimmed },
    });

    if (!floor) {
      floor = await tx.floor.create({
        data: {
          canteenId: canteen.id,
          name: trimmed,
          level: this.deriveFloorLevel(trimmed) ?? '1',
        },
      });
    }

    caches.floors.set(key, floor);
    return floor;
  }

  private async getOrCreateWindow(
    tx: Prisma.TransactionClient,
    caches: BatchImportCaches,
    canteen: Canteen,
    floor: Floor | null,
    windowName: string,
    windowNumber: string | undefined,
    counters: Map<string, number>,
  ): Promise<Window> {
    const trimmed = windowName?.trim();
    if (!trimmed) {
      throw new BadRequestException('窗口名称不能为空');
    }

    const key = `${canteen.id}:${this.normalizeName(trimmed)}`;
    if (caches.windows.has(key)) {
      return caches.windows.get(key)!;
    }

    let window = await tx.window.findFirst({
      where: { canteenId: canteen.id, name: trimmed },
    });

    if (!window) {
      const number =
        windowNumber?.trim() ||
        (await this.generateWindowNumber(tx, canteen.id, counters));
      window = await tx.window.create({
        data: {
          canteenId: canteen.id,
          floorId: floor?.id,
          name: trimmed,
          number,
        },
      });
    }

    caches.windows.set(key, window);
    return window;
  }

  private async generateWindowNumber(
    tx: Prisma.TransactionClient,
    canteenId: string,
    counters: Map<string, number>,
  ): Promise<string> {
    if (!counters.has(canteenId)) {
      const existingCount = await tx.window.count({ where: { canteenId } });
      counters.set(canteenId, existingCount);
    }

    const next = (counters.get(canteenId) ?? 0) + 1;
    counters.set(canteenId, next);
    return `AUTO-${next}`;
  }

  private async getOrCreateParentDish(
    tx: Prisma.TransactionClient,
    caches: BatchImportCaches,
    parentName: string,
    canteen: Canteen,
    floor: Floor | null,
    window: Window,
    tags: string[],
    mealTimes: string[],
    availableDates?: PrismaJsonInput,
    description?: string,
  ): Promise<Dish> {
    const trimmed = parentName.trim();
    if (!trimmed) {
      throw new BadRequestException('父菜品名称不能为空');
    }

    const key = `${window.id}:${this.normalizeName(trimmed)}`;
    if (caches.parentDishes.has(key)) {
      return caches.parentDishes.get(key)!;
    }

    let parentDish = await tx.dish.findFirst({
      where: {
        name: trimmed,
        windowId: window.id,
        parentDishId: null,
      },
    });

    if (!parentDish) {
      parentDish = await tx.dish.create({
        data: {
          name: trimmed,
          price: 0,
          priceUnit: '元',
          description: description || '',
          tags,
          canteenId: canteen.id,
          canteenName: canteen.name,
          floorId: floor?.id,
          floorLevel: floor?.level,
          floorName: floor?.name,
          windowId: window.id,
          windowName: window.name,
          windowNumber: window.number,
          availableMealTime: mealTimes,
          availableDates,
          status: 'online',
        },
      });
    }

    caches.parentDishes.set(key, parentDish);
    return parentDish;
  }

  private async upsertDish(
    tx: Prisma.TransactionClient,
    params: {
      name: string;
      price: number;
      priceUnit: string;
      description: string;
      tags: string[];
      canteen: Canteen;
      floor: Floor | null;
      window: Window;
      availableMealTime: string[];
      availableDates?: PrismaJsonInput;
      parentDishId: string | null;
    },
  ) {
    const trimmed = params.name.trim();
    if (!trimmed) {
      throw new BadRequestException('菜品名称不能为空');
    }

    const existing = await tx.dish.findFirst({
      where: {
        name: trimmed,
        windowId: params.window.id,
        parentDishId: params.parentDishId,
      },
    });

    if (existing) {
      await tx.dish.update({
        where: { id: existing.id },
        data: {
          price: params.price,
          priceUnit: params.priceUnit,
          description: params.description,
          tags: params.tags,
          availableMealTime: params.availableMealTime,
          availableDates: params.availableDates,
          windowNumber: params.window.number,
          floorId: params.floor?.id,
          floorLevel: params.floor?.level,
          floorName: params.floor?.name,
        },
      });
      return;
    }

    await tx.dish.create({
      data: {
        name: trimmed,
        price: params.price,
        priceUnit: params.priceUnit,
        description: params.description,
        tags: params.tags,
        canteenId: params.canteen.id,
        canteenName: params.canteen.name,
        floorId: params.floor?.id,
        floorLevel: params.floor?.level,
        floorName: params.floor?.name,
        windowId: params.window.id,
        windowName: params.window.name,
        windowNumber: params.window.number,
        availableMealTime: params.availableMealTime,
        availableDates: params.availableDates,
        parentDishId: params.parentDishId,
        status: 'online',
      },
    });
  }

  private parseMealTimesFromItem(item: BatchParsedDishDto): string[] {
    const source =
      item.supplyPeriod && item.supplyPeriod.length > 0
        ? item.supplyPeriod
        : this.extractMealTimesFromText(item.supplyTime);

    const result = new Set<string>();
    for (const label of source) {
      const trimmed = label.trim();
      if (!trimmed) continue;
      const normalized = trimmed.toLowerCase();
      const mapped =
        this.mealTimeDictionary.get(trimmed) ||
        this.mealTimeDictionary.get(normalized) ||
        this.mealTimeDictionary.get(this.normalizeName(trimmed));
      if (mapped) {
        result.add(mapped);
      }
    }
    return Array.from(result);
  }

  private extractMealTimesFromText(value?: string): string[] {
    if (!value) {
      return [];
    }
    const needles = [
      '早餐',
      '早饭',
      '午餐',
      '午饭',
      '中餐',
      '晚餐',
      '晚饭',
      '夜宵',
      '宵夜',
      'breakfast',
      'lunch',
      'dinner',
      'nightsnack',
    ];
    const lowered = value.toLowerCase();
    const result = new Set<string>();
    for (const needle of needles) {
      if (value.includes(needle) || lowered.includes(needle.toLowerCase())) {
        result.add(needle);
      }
    }
    return Array.from(result);
  }

  private parsePriceCell(value: any): {
    price: number;
    unit: string;
    error?: string;
  } {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return { price: value, unit: '元' };
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return { price: 0, unit: '元', error: '价格不能为空' };
      }

      const regex = /^(\d+(?:\.\d+)?)(?:\s*)(?:元)?(?:\/(.+))?$/;
      const match = trimmed.match(regex);
      if (match) {
        const price = parseFloat(match[1]);
        if (Number.isNaN(price)) {
          return { price: 0, unit: '元', error: '价格格式错误' };
        }
        const unit = match[2] ? `元/${match[2]}` : '元';
        return { price, unit };
      }

      const numeric = parseFloat(trimmed);
      if (!Number.isNaN(numeric)) {
        return { price: numeric, unit: '元' };
      }

      return { price: 0, unit: '元', error: '价格格式错误' };
    }

    return { price: 0, unit: '元', error: '价格格式错误' };
  }

  private parseDateRange(
    value?: string,
  ): { startDate: string; endDate: string } | null {
    if (!value) {
      return null;
    }
    const cleaned = value.trim();
    if (!cleaned) {
      return null;
    }

    const parts = cleaned
      .split(/(?:至|到|to|TO|—|–|-)/)
      .map((part) => part.trim());
    if (parts.length !== 2) {
      return null;
    }

    const [start, end] = parts;
    const datePattern = /^\d{4}-\d{1,2}-\d{1,2}$/;
    if (datePattern.test(start) && datePattern.test(end)) {
      return { startDate: start, endDate: end };
    }
    return null;
  }

  private deriveFloorLevel(name?: string): string | null {
    if (!name) {
      return null;
    }
    if (name.includes('地下')) {
      return '-1';
    }
    const digitMatch = name.match(/(-?\d+)/);
    if (digitMatch) {
      return digitMatch[1];
    }
    const mapping: Record<string, string> = {
      一: '1',
      二: '2',
      三: '3',
      四: '4',
      五: '5',
      六: '6',
      七: '7',
      八: '8',
      九: '9',
      十: '10',
    };
    for (const [key, value] of Object.entries(mapping)) {
      if (name.includes(key)) {
        return value;
      }
    }
    return null;
  }

  private normalizeExcelRow(row: Record<string, any>): NormalizedExcelRow {
    const normalized: NormalizedExcelRow = { raw: row };
    Object.entries(row).forEach(([key, value]) => {
      const trimmedKey = key?.toString().trim();
      if (!trimmedKey) {
        return;
      }
      const mappedKey = this.excelColumnMap[trimmedKey];
      if (mappedKey) {
        (normalized as any)[mappedKey] = value;
      }
    });
    return normalized;
  }

  private isRowEmpty(row: NormalizedExcelRow): boolean {
    const keys: Array<keyof NormalizedExcelRow> = [
      'canteenName',
      'floorName',
      'windowName',
      'windowNumber',
      'dishName',
      'subDishRaw',
      'priceRaw',
      'supplyTime',
      'supplyPeriodRaw',
      'description',
      'tagsRaw',
    ];
    return keys.every((key) => {
      const value = row[key];
      return value === undefined || value === null || `${value}`.trim() === '';
    });
  }

  private buildParsedDish(
    row: NormalizedExcelRow,
    canteenMap: Map<string, Canteen>,
    floorMap: Map<string, Floor>,
    windowMap: Map<string, Window>,
    limitedCanteen: Canteen | null,
  ): BatchParsedDishDto {
    const errors: string[] = [];
    const warnings: string[] = [];

    const canteenName = row.canteenName ? String(row.canteenName).trim() : '';
    const floorName = row.floorName ? String(row.floorName).trim() : undefined;
    const windowName = row.windowName ? String(row.windowName).trim() : '';
    const dishName = row.dishName ? String(row.dishName).trim() : '';
    const {
      price,
      unit,
      error: priceError,
    } = this.parsePriceCell(row.priceRaw);

    if (!canteenName) {
      errors.push('食堂名称不能为空');
    }
    if (!windowName) {
      errors.push('窗口名称不能为空');
    }
    if (!dishName) {
      errors.push('菜品名称不能为空');
    }
    if (priceError) {
      errors.push(priceError);
    }

    if (limitedCanteen && canteenName) {
      const restricted = this.normalizeName(limitedCanteen.name);
      if (restricted !== this.normalizeName(canteenName)) {
        errors.push('导入食堂与您的权限食堂不一致');
      }
    }

    const normalizedCanteen = this.normalizeName(canteenName);
    const matchedCanteen = normalizedCanteen
      ? canteenMap.get(normalizedCanteen)
      : null;
    if (!matchedCanteen && canteenName) {
      warnings.push('食堂不存在，导入时将自动创建');
    }

    if (floorName && matchedCanteen) {
      const floorKey = `${matchedCanteen.id}:${this.normalizeName(floorName)}`;
      if (!floorMap.get(floorKey)) {
        warnings.push('楼层不存在，导入时将自动创建');
      }
    }

    if (windowName && matchedCanteen) {
      const windowKey = `${matchedCanteen.id}:${this.normalizeName(windowName)}`;
      if (!windowMap.get(windowKey)) {
        warnings.push('窗口不存在，导入时将自动创建');
      }
    }

    const supplyPeriod = splitToStringArray(row.supplyPeriodRaw);
    const inferredPeriods =
      !supplyPeriod.length && row.supplyTime
        ? this.extractMealTimesFromText(row.supplyTime)
        : [];
    const tags = splitToStringArray(row.tagsRaw);
    const subDishNames = splitToStringArray(row.subDishRaw);

    const status = errors.length
      ? BatchDishStatus.INVALID
      : warnings.length
        ? BatchDishStatus.WARNING
        : BatchDishStatus.VALID;
    const message = errors.length ? errors.join('；') : warnings.join('；');

    return {
      tempId: randomUUID(),
      name: dishName,
      description: row.description ? String(row.description).trim() : undefined,
      price,
      priceUnit: unit,
      tags,
      canteenName,
      floorName,
      windowName,
      windowNumber: row.windowNumber
        ? String(row.windowNumber).trim()
        : undefined,
      supplyTime: row.supplyTime ? String(row.supplyTime).trim() : undefined,
      supplyPeriod: supplyPeriod.length ? supplyPeriod : inferredPeriods,
      subDishNames,
      status,
      message: message || undefined,
      rawData: row.raw,
    };
  }

  private normalizeName(value?: string | null): string {
    if (!value) {
      return '';
    }
    return value.toString().trim().toLowerCase();
  }

  private async readUploadedFile(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer) {
      return file.buffer;
    }
    if (file.path) {
      return fs.readFile(file.path);
    }
    throw new BadRequestException('无法读取上传的文件');
  }
}
