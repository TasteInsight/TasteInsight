import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  AdminGetPendingUploadsDto,
  DishUploadDto,
} from './dto/admin-upload.dto';

@Injectable()
export class AdminUploadsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取待审核的上传菜品列表
   */
  async getPendingUploads(query: AdminGetPendingUploadsDto, adminInfo: any) {
    const { page = 1, pageSize = 20, status } = query;

    // 构建查询条件
    const where: any = {};

    // 如果指定了状态，则筛选状态，否则返回所有
    if (status) {
      where.status = status;
    }

    // 如果管理员有 canteenId 限制，只能查看该食堂的上传
    if (adminInfo.canteenId) {
      where.canteenId = adminInfo.canteenId;
    }

    // 查询总数
    const total = await this.prisma.dishUpload.count({ where });

    // 查询数据
    const items = await this.prisma.dishUpload.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
        canteen: true,
        window: true,
        parentDish: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      code: 200,
      message: 'success',
      data: {
        items: items.map((item) => this.mapToDishUploadDto(item)),
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
   * 获取待审核上传菜品详情
   */
  async getPendingUploadById(id: string, adminInfo: any) {
    const upload = await this.prisma.dishUpload.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
        canteen: true,
        window: {
          include: {
            floor: true,
          },
        },
        parentDish: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在');
    }

    // 检查权限：如果管理员有食堂限制，必须匹配
    if (adminInfo.canteenId && upload.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    return {
      code: 200,
      message: 'success',
      data: this.mapToDishUploadDto(upload),
    };
  }

  /**
   * 通过用户上传菜品审核
   */
  async approveUpload(id: string, adminInfo: any) {
    // 查找上传记录
    const upload = await this.prisma.dishUpload.findUnique({
      where: { id },
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

    if (!upload) {
      throw new NotFoundException('上传记录不存在');
    }

    // 检查权限：如果管理员有食堂限制，必须匹配
    if (adminInfo.canteenId && upload.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 使用事务确保菜品创建和状态更新的原子性，并在事务内检查状态防止竞态条件
    try {
      await this.prisma.$transaction(async (tx) => {
        // 在事务内再次检查状态，使用条件更新防止竞态条件
        const updateResult = await tx.dishUpload.updateMany({
          where: {
            id,
            status: 'pending', // 只有 pending 状态才能被处理
          },
          data: {
            status: 'processing', // 临时状态，防止并发处理
          },
        });

        // 如果没有更新任何记录，说明已被其他管理员处理
        if (updateResult.count === 0) {
          throw new BadRequestException('该上传已被处理');
        }

        // 创建正式菜品记录
        const dish = await tx.dish.create({
          data: {
            name: upload.name,
            tags: upload.tags,
            price: upload.price,
            description: upload.description,
            images: upload.images,
            ingredients: upload.ingredients,
            allergens: upload.allergens,
            spicyLevel: upload.spicyLevel,
            sweetness: upload.sweetness,
            saltiness: upload.saltiness,
            oiliness: upload.oiliness,
            canteenId: upload.canteenId,
            canteenName: upload.canteenName,
            floorId: upload.window?.floorId || null,
            floorLevel: upload.window?.floor?.level || null,
            floorName: upload.window?.floor?.name || null,
            windowId: upload.windowId,
            windowNumber: upload.windowNumber,
            windowName: upload.windowName,
            availableMealTime: upload.availableMealTime,
            availableDates: upload.availableDates || undefined,
            parentDishId: upload.parentDishId,
            status: 'online',
            averageRating: 0,
            reviewCount: 0,
          },
        });

        // 更新上传记录状态为 approved
        await tx.dishUpload.update({
          where: { id },
          data: {
            status: 'approved',
            approvedDishId: dish.id,
          },
        });
      });
    } catch (error) {
      // 如果是我们抛出的 BadRequestException，直接重新抛出
      if (error instanceof BadRequestException) {
        throw error;
      }
      // 其他错误可能是数据库错误，重新抛出
      throw error;
    }

    return {
      code: 200,
      message: '审核通过，菜品已入库',
      data: null,
    };
  }

  /**
   * 拒绝用户上传菜品审核
   */
  async rejectUpload(id: string, reason: string, adminInfo: any) {
    // 查找上传记录
    const upload = await this.prisma.dishUpload.findUnique({
      where: { id },
    });

    if (!upload) {
      throw new NotFoundException('上传记录不存在');
    }

    // 检查权限：如果管理员有食堂限制，必须匹配
    if (adminInfo.canteenId && upload.canteenId !== adminInfo.canteenId) {
      throw new ForbiddenException('权限不足');
    }

    // 使用条件更新防止竞态条件：只有 pending 状态才能被拒绝
    const updateResult = await this.prisma.dishUpload.updateMany({
      where: {
        id,
        status: 'pending',
      },
      data: {
        status: 'rejected',
        rejectReason: reason,
      },
    });

    // 如果没有更新任何记录，说明已被其他管理员处理
    if (updateResult.count === 0) {
      throw new BadRequestException('该上传已被处理');
    }

    return {
      code: 200,
      message: '已拒绝',
      data: null,
    };
  }

  /**
   * 将数据库记录映射为 DishUploadDto
   */
  private mapToDishUploadDto(upload: any): DishUploadDto {
    const uploaderType = upload.userId ? 'user' : 'admin';
    const uploaderName = upload.userId
      ? upload.user?.nickname
      : upload.admin?.username;

    return {
      id: upload.id,
      name: upload.name,
      tags: upload.tags,
      price: upload.price,
      description: upload.description,
      images: upload.images,
      ingredients: upload.ingredients,
      allergens: upload.allergens,
      spicyLevel: upload.spicyLevel,
      sweetness: upload.sweetness,
      saltiness: upload.saltiness,
      oiliness: upload.oiliness,
      canteenId: upload.canteenId,
      canteenName: upload.canteenName,
      windowId: upload.windowId,
      windowNumber: upload.windowNumber,
      windowName: upload.windowName,
      availableMealTime: upload.availableMealTime,
      availableDates: upload.availableDates,
      status: upload.status,
      rejectReason: upload.rejectReason,
      approvedDishId: upload.approvedDishId,
      userId: upload.userId,
      adminId: upload.adminId,
      uploaderType,
      uploaderName: uploaderName || null,
      parentDishId: upload.parentDishId,
      parentDishName: upload.parentDish?.name || null,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
  }
}
