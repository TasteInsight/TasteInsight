import { contributionModerationText } from '@/content-moderation/moderation.types';
import { rejectContribution } from '@/dishes/reject-contribution';
import { ModerationSubmissionService } from '@/content-moderation/moderation-submission.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import {
  canAccessCanteen,
  canteenScopeFilter,
  isGlobalScope,
} from '@/auth/admin-scope';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { enqueueDishNotifications } from '@/notifications/notification-events';
import { withdrawDishNotifications } from '@/notifications/withdraw-dish-notifications';
import { Prisma, DishUpload } from '@prisma/client';
import {
  AdminGetUploadsDto,
  DishUploadDto,
  AdminApproveUploadDto,
  AdminEditUploadDto,
} from './dto/admin-upload.dto';
import {
  NotificationService,
  UploadResultNotificationType,
} from '@/notifications/notification.service';
import {
  CONTRIBUTION_FIELDS,
  assertRevision,
  checkedFields,
  contributionSnapshot,
  assertBaseline,
  changedDishData,
  prepareContribution,
  sameValue,
} from '@/dishes/contribution-fields';
import { DishDto } from '@/dishes/dto/dish.dto';
import { claimContributionImages } from '@/upload/contribution-images';

const detailInclude = {
  user: { select: { id: true, nickname: true } },
  admin: { select: { id: true, username: true } },
  canteen: true,
  window: { include: { floor: true } },
  parentDish: { select: { id: true, name: true } },
  parentUpload: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AdminUploadsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private notifications?: NotificationService,
    @Optional() private readonly moderation?: ModerationSubmissionService,
    @Optional() private readonly moderationAssets?: ModerationAssetsService,
  ) {}

  private assertScope(upload: { canteenId: string }, adminInfo: any) {
    if (!canAccessCanteen(adminInfo, upload.canteenId))
      throw new ForbiddenException('权限不足');
  }

  private async resultNotification(
    tx: Prisma.TransactionClient,
    upload: DishUpload,
    type: UploadResultNotificationType,
    revision: number,
  ) {
    if (!upload.userId) return;
    await this.notifications?.create(tx, {
      userId: upload.userId,
      actorId: null,
      type,
      targetType: 'dish_upload',
      targetId: upload.id,
      dedupeKey: `${type}:${upload.id}:${revision}`,
    });
  }

  async getUploads(query: AdminGetUploadsDto, adminInfo: any) {
    const { page = 1, pageSize = 20, status, keyword, canteenId } = query;
    const where: Prisma.DishUploadWhereInput = {};
    if (status) where.status = status;
    if (!isGlobalScope(adminInfo))
      where.canteenId = canteenScopeFilter(adminInfo);
    if (canteenId) {
      this.assertScope({ canteenId }, adminInfo);
      where.canteenId = canteenId;
    }
    if (keyword?.trim()) {
      const contains: Prisma.StringFilter = {
        contains: keyword.trim(),
        mode: 'insensitive',
      };
      where.OR = [
        { name: contains },
        { nameEn: contains },
        { canteenName: contains },
        { windowName: contains },
        { user: { nickname: contains } },
        { admin: { username: contains } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.dishUpload.count({ where }),
      this.prisma.dishUpload.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: detailInclude,
      }),
    ]);
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

  async getUploadById(id: string, adminInfo: any) {
    const upload = await this.prisma.dishUpload.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!upload) throw new NotFoundException('上传记录不存在');
    this.assertScope(upload, adminInfo);
    const canApprove =
      adminInfo.role === 'superadmin' ||
      adminInfo.permissions?.includes('upload:approve');
    const canReadOwn =
      upload.adminId === adminInfo.id &&
      adminInfo.permissions?.includes('dish:create');
    if (!canApprove && !canReadOwn)
      throw new ForbiddenException('无权访问该上传记录');
    const target = upload.targetDishId
      ? await this.prisma.dish.findUnique({
          where: { id: upload.targetDishId },
        })
      : null;
    const visibleTarget =
      target && canAccessCanteen(adminInfo, target.canteenId) ? target : null;
    const candidates =
      canApprove && !upload.targetDishId
        ? await this.prisma.dish.findMany({
            where: {
              canteenId: upload.canteenId,
              status: 'online',
              ...(upload.approvedDishId
                ? { id: { not: upload.approvedDishId } }
                : {}),
              name: { contains: upload.name.trim(), mode: 'insensitive' },
            },
            take: 10,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          })
        : [];
    return {
      code: 200,
      message: 'success',
      data: {
        ...this.mapToDishUploadDto(upload),
        targetDish: visibleTarget ? DishDto.fromEntity(visibleTarget) : null,
        duplicateCandidates: candidates.map((dish) => DishDto.fromEntity(dish)),
      },
    };
  }

  async editUpload(id: string, dto: AdminEditUploadDto, adminInfo: any) {
    const forbidden = Object.keys(dto).filter(
      (field) =>
        !['revision', 'targetDishUpdatedAt'].includes(field) &&
        !(CONTRIBUTION_FIELDS as readonly string[]).includes(field),
    );
    if (forbidden.length)
      throw new BadRequestException('不能变更提交记录的归属、类型或审核状态');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const upload = await tx.dishUpload.findUnique({ where: { id } });
      if (!upload) throw new NotFoundException('上传记录不存在');
      this.assertScope(upload, adminInfo);
      assertRevision(upload, dto.revision);
      if (upload.status !== 'pending')
        throw new BadRequestException('仅待审核资料可以编辑');
      const edited = CONTRIBUTION_FIELDS.filter(
        (field) =>
          dto[field] !== undefined &&
          !sameValue(dto[field], upload[field], field),
      );
      const target = upload.targetDishId
        ? await tx.dish.findUnique({ where: { id: upload.targetDishId } })
        : null;
      if (upload.targetDishId && !target)
        throw new NotFoundException('待补全菜品不存在');
      if (target) this.assertScope(target, adminInfo);
      const changes = target
        ? [...new Set([...upload.changedFields, ...edited])]
        : undefined;
      const input: Record<string, any> = {
        ...upload,
        ...dto,
        changedFields: changes,
      };
      if (edited.includes('windowId')) {
        input.windowName = '';
        input.windowNumber = null;
      }
      const data = await prepareContribution(tx, input, target, upload);
      if (upload.userId)
        await claimContributionImages(
          tx,
          upload.userId,
          data.images,
          id,
          target?.images ?? [],
        );
      const saved = await tx.dishUpload.update({
        where: { id },
        data: {
          ...data,
          revision: upload.revision + 1,
          ...(target && dto.targetDishUpdatedAt
            ? { baseSnapshot: contributionSnapshot(target) }
            : {}),
        } as Prisma.DishUploadUncheckedUpdateInput,
      });
      if (saved.userId) {
        const policy = await this.moderation?.policy(tx);
        if (policy)
          await this.moderation!.submit(tx, policy, {
            targetType: 'dishUpload',
            targetId: id,
            userId: saved.userId,
            version: String(saved.revision),
            text: contributionModerationText(saved),
            images: saved.images,
          });
      }
    });
    return this.getUploadById(id, adminInfo);
  }

  async approveUpload(
    id: string,
    adminInfo: any,
    dto: AdminApproveUploadDto = {},
  ) {
    const upload = await this.prisma.dishUpload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('上传记录不存在');
    this.assertScope(upload, adminInfo);
    await this.prisma.$transaction(async (tx) => {
      let parentDishId = upload.parentDishId;
      const parentCanteenIds: string[] = [];
      if (upload.approvedDishId && !upload.targetDishId) {
        const published = await tx.dish.findUnique({
          where: { id: upload.approvedDishId },
          select: { parentDishId: true },
        });
        parentDishId = published?.parentDishId ?? null;
      } else if (upload.parentUploadId) {
        await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${upload.parentUploadId} FOR UPDATE`;
        const parent = await tx.dishUpload.findUnique({
          where: { id: upload.parentUploadId },
        });
        if (!parent || parent.status !== 'approved' || !parent.approvedDishId)
          throw new BadRequestException('请先审核通过父菜品');
        parentCanteenIds.push(parent.canteenId);
        parentDishId = parent.approvedDishId;
      }
      if (parentDishId) {
        await tx.$queryRaw`SELECT "id" FROM "dishes" WHERE "id" = ${parentDishId} FOR UPDATE`;
        const parent = await tx.dish.findUnique({
          where: { id: parentDishId },
        });
        if (!parent || parent.status === 'offline')
          throw new BadRequestException('父菜品不存在或未上架');
        parentCanteenIds.push(parent.canteenId);
      }
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.dishUpload.findUnique({
        where: { id },
        include: { window: { include: { floor: true } } },
      });
      if (!current) throw new NotFoundException('上传记录不存在');
      this.assertScope(current, adminInfo);
      assertRevision(current, dto.revision);
      await this.moderation?.assertApprovable(
        tx,
        'dishUpload',
        id,
        String(current.revision),
      );
      await this.moderationAssets?.approve(tx, current.images);
      if (
        current.approvedDishId !== upload.approvedDishId ||
        current.targetDishId !== upload.targetDishId ||
        current.parentDishId !== upload.parentDishId ||
        current.parentUploadId !== upload.parentUploadId
      )
        throw new ConflictException('父子关系已变化，请重试审核');
      if (parentCanteenIds.some((canteenId) => canteenId !== current.canteenId))
        throw new BadRequestException('父子菜品必须属于同一食堂');
      if (dto.mergeDishId && (current.targetDishId || current.approvedDishId))
        throw new BadRequestException('已关联正式菜品的记录不能归并到其他菜品');
      if (!dto.mergeDishId && (dto.mergeFields || dto.mergeDishUpdatedAt))
        throw new BadRequestException('请指定归并目标');
      const claimed = await tx.dishUpload.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'processing' },
      });
      if (!claimed.count) throw new BadRequestException('该上传已被处理');
      const targetId = current.targetDishId ?? dto.mergeDishId;
      let dish: any;
      let previous: any;
      let baseSnapshot: Prisma.InputJsonObject | undefined;
      let approvedSnapshot: Prisma.InputJsonObject;
      let selectedFields: string[] | undefined;
      if (targetId) {
        selectedFields = checkedFields(
          dto.mergeDishId ? dto.mergeFields : current.changedFields,
        );
        if (parentDishId || current.parentUploadId)
          throw new BadRequestException('含父子关系的记录不能归并到其他菜品');
        await tx.$queryRaw`SELECT "id" FROM "dishes" WHERE "id" = ${targetId} FOR UPDATE`;
        previous = await tx.dish.findUnique({ where: { id: targetId } });
        if (!previous) throw new NotFoundException('目标菜品不存在');
        this.assertScope(previous, adminInfo);
        if (previous.canteenId !== current.canteenId)
          throw new BadRequestException('只能归并或补全同食堂菜品');
        if (previous.status !== 'online')
          throw new ConflictException('目标菜品已下架，请刷新后处理');
        if (dto.mergeDishId) {
          if (
            !dto.mergeDishUpdatedAt ||
            new Date(dto.mergeDishUpdatedAt).getTime() !==
              previous.updatedAt.getTime()
          )
            throw new ConflictException('归并目标资料已变化，请刷新后重新选择');
        } else {
          assertBaseline(previous, current.baseSnapshot, selectedFields);
        }
        baseSnapshot = contributionSnapshot(previous);
        const patch = changedDishData(current, previous, selectedFields);
        approvedSnapshot = Object.fromEntries(
          Object.entries(patch).map(([field, value]) => [field, value ?? null]),
        );
        dish = await tx.dish.update({
          where: { id: targetId },
          data: {
            ...patch,
            ...(patch.availableDates === null
              ? { availableDates: Prisma.DbNull }
              : {}),
          },
        });
      } else {
        if (current.approvedDishId) {
          await tx.$queryRaw`SELECT "id" FROM "dishes" WHERE "id" = ${current.approvedDishId} FOR UPDATE`;
          previous = await tx.dish.findUnique({
            where: { id: current.approvedDishId },
          });
          if (!previous)
            throw new ConflictException('原正式菜品已删除，无法恢复原发布');
          this.assertScope(previous, adminInfo);
          if (
            previous.status !== 'offline' ||
            previous.canteenId !== current.canteenId ||
            previous.parentDishId !== parentDishId
          )
            throw new ConflictException(
              '原正式菜品状态或归属已变化，请刷新后处理',
            );
          const draftAtRevocation = current.baseSnapshot as Prisma.JsonObject;
          const editedFields = CONTRIBUTION_FIELDS.filter(
            (field) =>
              !sameValue(current[field], draftAtRevocation[field], field),
          );
          assertBaseline(previous, current.approvedSnapshot, editedFields);
          const patch = changedDishData(current, previous, editedFields);
          dish = await tx.dish.update({
            where: { id: previous.id },
            data: {
              ...patch,
              status: 'online',
              ...(patch.availableDates === null
                ? { availableDates: Prisma.DbNull }
                : {}),
            },
          });
        } else {
          dish = await tx.dish.create({
            data: {
              ...changedDishData(current, { images: [] }, [
                ...CONTRIBUTION_FIELDS,
              ]),
              canteenId: current.canteenId,
              canteenName: current.canteenName,
              parentDishId,
              status: 'online',
              availableDates: current.availableDates ?? Prisma.DbNull,
              averageRating: 0,
              reviewCount: 0,
            } as Prisma.DishUncheckedCreateInput,
          });
        }
        approvedSnapshot = contributionSnapshot(dish);
      }
      await enqueueDishNotifications(tx, dish, previous);
      const revision = (current.revision ?? 1) + 1;
      await tx.dishUpload.update({
        where: { id },
        data: {
          status: 'approved',
          approvedDishId: dish.id,
          rejectReason: null,
          revision,
          targetDishId: targetId ?? null,
          approvedSnapshot,
          refreshPending: true,
          ...(baseSnapshot ? { baseSnapshot } : {}),
          ...(selectedFields ? { changedFields: selectedFields } : {}),
        },
      });
      await this.moderation?.complete(
        tx,
        'dishUpload',
        id,
        String(current.revision),
        true,
        current.images,
      );
      await this.resultNotification(tx, current, 'upload_approved', revision);
    });
    return { code: 200, message: '审核通过，菜品已入库', data: null };
  }

  async rejectUpload(
    id: string,
    reason: string,
    adminInfo: any,
    expectedRevision?: number,
  ) {
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('拒绝原因不能为空');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.dishUpload.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('上传记录不存在');
      this.assertScope(current, adminInfo);
      assertRevision(current, expectedRevision);
      if (!['pending', 'rejected'].includes(current.status))
        throw new BadRequestException(
          '该记录无法直接拒绝，已通过记录请先撤销审核',
        );
      await rejectContribution(tx, current, trimmed, this.notifications);
      await this.moderation?.complete(
        tx,
        'dishUpload',
        id,
        String(current.revision),
        false,
      );
    });
    return { code: 200, message: '已拒绝', data: null };
  }

  async revokeUpload(id: string, adminInfo: any, expectedRevision?: number) {
    let alreadyPending = false;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "dish_uploads" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.dishUpload.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('上传记录不存在');
      this.assertScope(current, adminInfo);
      assertRevision(current, expectedRevision);
      if (current.status === 'pending') {
        alreadyPending = true;
        return;
      }
      if (!['approved', 'rejected'].includes(current.status))
        throw new BadRequestException('该记录不能撤销审核');
      let refreshed = false;
      let snapshot: Prisma.InputJsonObject | undefined;
      if (current.status === 'approved' && current.approvedDishId) {
        await tx.$queryRaw`SELECT "id" FROM "dishes" WHERE "id" = ${current.approvedDishId} FOR UPDATE`;
        const dish = await tx.dish.findUnique({
          where: { id: current.approvedDishId },
        });
        if (dish) {
          this.assertScope(dish, adminInfo);
          if (current.targetDishId) {
            const approved = current.approvedSnapshot as Record<
              string,
              any
            > | null;
            const baseline = current.baseSnapshot as Record<string, any> | null;
            if (
              !approved ||
              !baseline ||
              Object.keys(approved).some(
                (field) => !sameValue(dish[field], approved[field], field),
              )
            )
              throw new ConflictException(
                '菜品已有后续修改，无法安全撤回本次贡献',
              );
            const patch = Object.fromEntries(
              Object.keys(approved).map((field) => [field, baseline[field]]),
            );
            const restored = await tx.dish.update({
              where: { id: dish.id },
              data: {
                ...patch,
                ...(patch.availableDates === null
                  ? { availableDates: Prisma.DbNull }
                  : {}),
              },
            });
            await enqueueDishNotifications(tx, restored, dish);
          } else {
            const childDish = await tx.dish.findFirst({
              where: { parentDishId: dish.id, status: 'online' },
              select: { id: true },
            });
            if (childDish)
              throw new BadRequestException('请先撤销或下架已上架子菜品');
            const incompatible = await tx.dishUpload.findFirst({
              where: {
                parentDishId: dish.id,
                canteenId: { not: current.canteenId },
              },
              select: { id: true },
            });
            if (incompatible)
              throw new BadRequestException(
                '子审核记录与原始上传不属于同一食堂，无法撤销',
              );
            await tx.dishUpload.updateMany({
              where: { parentDishId: dish.id },
              data: {
                parentDishId: null,
                parentUploadId: id,
                revision: { increment: 1 },
              },
            });
            if (this.moderation) {
              const children = await tx.dishUpload.findMany({
                where: { parentUploadId: id, status: 'pending' },
              });
              for (const child of children)
                await this.submitContentCheck(tx, child);
            }
            await withdrawDishNotifications(tx, [dish.id], 'offline');
            await tx.dish.update({
              where: { id: dish.id },
              data: { status: 'offline' },
            });
            snapshot = contributionSnapshot(dish);
          }
          refreshed = true;
        }
      }
      const revision = (current.revision ?? 1) + 1;
      const pending = await tx.dishUpload.update({
        where: { id },
        data: {
          status: 'pending',
          rejectReason: null,
          revision,
          ...(snapshot
            ? {
                baseSnapshot: contributionSnapshot(current),
                approvedSnapshot: snapshot,
              }
            : {}),
          ...(refreshed ? { refreshPending: true } : {}),
        },
      });
      await this.submitContentCheck(tx, pending);
      await this.resultNotification(tx, current, 'upload_revoked', revision);
    });
    return {
      code: 200,
      message: alreadyPending
        ? '已是待审核状态'
        : '已撤销审核，重置为待审核状态',
      data: null,
    };
  }

  private async submitContentCheck(
    tx: Prisma.TransactionClient,
    upload: DishUpload,
  ) {
    if (!this.moderation || !upload.userId) return;
    const policy = await this.moderation.policy(tx);
    await this.moderation.submit(tx, policy, {
      targetType: 'dishUpload',
      targetId: upload.id,
      userId: upload.userId,
      version: String(upload.revision),
      text: contributionModerationText(upload),
      images: upload.images,
    });
  }

  private mapToDishUploadDto(upload: any): DishUploadDto {
    return {
      id: upload.id,
      name: upload.name,
      nameEn: upload.nameEn ?? null,
      descriptionEn: upload.descriptionEn ?? null,
      tags: upload.tags,
      price: upload.price,
      calories: upload.calories ?? null,
      protein: upload.protein ?? null,
      carbohydrate: upload.carbohydrate ?? null,
      fat: upload.fat ?? null,

      priceUnit: upload.priceUnit,
      description: upload.description,
      images:
        this.moderationAssets?.previewImages(upload.images) ?? upload.images,
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
      floorId: upload.window?.floorId ?? null,
      floorLevel: upload.window?.floor?.level ?? null,
      floorName: upload.window?.floor?.name ?? null,
      availableMealTime: upload.availableMealTime,
      availableDates: upload.availableDates,
      status: upload.status,
      rejectReason: upload.rejectReason,
      approvedDishId: upload.approvedDishId,
      kind: upload.kind ?? 'create',
      revision: upload.revision ?? 1,
      targetDishId: upload.targetDishId ?? null,
      changedFields: upload.changedFields ?? [],
      baseSnapshot: upload.baseSnapshot ?? null,
      userId: upload.userId,
      adminId: upload.adminId,
      uploaderType: upload.userId ? 'user' : 'admin',
      uploaderName:
        (upload.userId ? upload.user?.nickname : upload.admin?.username) ||
        null,
      parentDishId: upload.parentDishId,
      parentUploadId: upload.parentUploadId || null,
      parentDishName:
        upload.parentDish?.name || upload.parentUpload?.name || null,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
  }
}
