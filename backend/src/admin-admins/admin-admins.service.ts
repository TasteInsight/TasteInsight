import { grantSnapshot, logAdminChange } from '@/admin-logs/admin-audit';
import { AdminCanteenScope, isGlobalScope } from '@/auth/admin-scope';
import {
  lockAdminHierarchy,
  selfAndDescendantAdminIds,
  bumpAdminHierarchyVersions,
} from '@/auth/admin-hierarchy';
import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { HandoverAdminDto } from './dto/handover-admin.dto';
import {
  ChangeOwnPasswordDto,
  ChangeSubAdminPasswordDto,
} from './dto/change-password.dto';
import {
  AdminListResponseDto,
  AdminResponseDto,
  AdminDto,
} from './dto/admin-response.dto';
import * as bcrypt from 'bcrypt';
import {
  ALL_PERMISSIONS,
  PERMISSION_DEPENDENCIES,
  GLOBAL_ONLY_PERMISSIONS,
} from '@/auth/permissions.constants';

const ALL_PERMISSION_SET = new Set(ALL_PERMISSIONS);

@Injectable()
export class AdminAdminsService {
  constructor(private prisma: PrismaService) {}

  private normalizeRoleName(role?: string): string {
    const name = role?.trim() || 'admin';
    if (['superadmin', 'super_admin'].includes(name)) {
      throw new BadRequestException('该角色名称由系统保留，请选择其他名称');
    }
    return name;
  }

  private validatePermissionScope(
    scope: 'GLOBAL' | 'CANTEENS',
    permissions: readonly string[],
  ) {
    if (
      scope === 'CANTEENS' &&
      permissions.some((permission) =>
        GLOBAL_ONLY_PERMISSIONS.includes(permission),
      )
    ) {
      throw new BadRequestException(
        '学生身份审核、社区管理和推荐实验权限仅可分配给全局管理范围',
      );
    }
  }

  private validatePermissionGrant(
    operatorRole: string,
    operatorPermissions: readonly string[],
    requestedPermissions: readonly string[],
  ): void {
    const duplicatePermissions = requestedPermissions.filter(
      (permission, index) => requestedPermissions.indexOf(permission) !== index,
    );
    if (duplicatePermissions.length > 0) {
      throw new BadRequestException('权限列表包含重复项');
    }

    const unknownPermissions = requestedPermissions.filter(
      (permission) => !ALL_PERMISSION_SET.has(permission),
    );
    if (unknownPermissions.length > 0) {
      throw new BadRequestException(
        `包含未知权限：${unknownPermissions.join(', ')}`,
      );
    }

    if (operatorRole !== 'superadmin') {
      const operatorPermissionSet = new Set(operatorPermissions);
      const unauthorizedPermissions = requestedPermissions.filter(
        (permission) => !operatorPermissionSet.has(permission),
      );
      if (unauthorizedPermissions.length > 0) {
        throw new ForbiddenException(
          `不能授予您未拥有的权限：${unauthorizedPermissions.join(', ')}`,
        );
      }
    }

    const requestedPermissionSet = new Set(requestedPermissions);
    const requiredPermissions = new Set<string>();
    const visit = (permission: string) => {
      for (const dependency of PERMISSION_DEPENDENCIES[permission] ?? []) {
        if (requiredPermissions.has(dependency)) continue;
        requiredPermissions.add(dependency);
        visit(dependency);
      }
    };
    requestedPermissions.forEach(visit);

    const missingDependencies = [...requiredPermissions].filter(
      (permission) => !requestedPermissionSet.has(permission),
    );
    if (missingDependencies.length > 0) {
      throw new BadRequestException(
        `所授权限缺少依赖：${missingDependencies.join(', ')}`,
      );
    }
  }

  private async validateScopeGrant(
    operator: AdminCanteenScope,
    requested: AdminCanteenScope,
  ): Promise<void> {
    if (requested.scope === 'GLOBAL' && requested.canteenIds.length) {
      throw new BadRequestException('全局范围无需指定食堂');
    }
    if (requested.scope === 'CANTEENS' && !requested.canteenIds.length) {
      throw new BadRequestException('请至少选择一个食堂');
    }
    this.assertScopeSubset(operator, requested);
    if (requested.canteenIds.length) {
      const canteens = await this.prisma.canteen.findMany({
        where: { id: { in: requested.canteenIds } },
        select: { id: true },
      });
      if (canteens.length !== requested.canteenIds.length) {
        throw new BadRequestException('指定的食堂不存在');
      }
    }
  }

  private assertScopeSubset(
    parent: AdminCanteenScope,
    child: AdminCanteenScope,
  ): void {
    if (
      !isGlobalScope(parent) &&
      (child.scope === 'GLOBAL' ||
        child.canteenIds.some((id) => !parent.canteenIds.includes(id)))
    ) {
      throw new ForbiddenException('授权范围必须包含在上级管理范围内');
    }
  }

  private async lockAdmin(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM admins WHERE id = ${id} FOR UPDATE`;
    const admin = await tx.admin.findUnique({
      where: { id },
      include: { canteens: { select: { canteenId: true } }, permissions: true },
    });
    if (!admin) throw new ForbiddenException('管理员不存在');
    return {
      ...admin,
      canteenIds: admin.canteens.map((canteen) => canteen.canteenId),
    };
  }

  private async lockActor(
    tx: Prisma.TransactionClient,
    id: string,
    authenticatedSessionVersion: number,
  ) {
    const actor = await this.lockAdmin(tx, id);
    if (
      actor.deletedAt ||
      actor.sessionVersion !== authenticatedSessionVersion
    ) {
      throw new UnauthorizedException('登录会话已失效，请重新登录');
    }
    if (actor.mustChangePassword) {
      throw new ForbiddenException({
        code: 'ADMIN_PASSWORD_CHANGE_REQUIRED',
        message: '请先修改初始密码',
      });
    }
    return actor;
  }

  private async restrictSubAdminGrants(
    tx: Prisma.TransactionClient,
    parentId: string,
    parentScope: AdminCanteenScope,
    parentPermissions: readonly string[],
  ): Promise<void> {
    const children = await tx.admin.findMany({
      where: { managerId: parentId },
      include: { canteens: { select: { canteenId: true } }, permissions: true },
    });
    for (const child of children) {
      const scope = isGlobalScope(parentScope) ? child.scope : 'CANTEENS';
      const canteenIds = isGlobalScope(parentScope)
        ? child.canteens.map((canteen) => canteen.canteenId)
        : child.scope === 'GLOBAL'
          ? parentScope.canteenIds
          : child.canteens
              .map((canteen) => canteen.canteenId)
              .filter((id) => parentScope.canteenIds.includes(id));
      const permissions = child.permissions
        .map((item) => item.permission)
        .filter((permission) => parentPermissions.includes(permission));
      await tx.admin.update({
        where: { id: child.id },
        data: {
          scope,
          canteens: {
            deleteMany: {},
            create: canteenIds.map((canteenId) => ({ canteenId })),
          },
          permissions: { deleteMany: { permission: { notIn: permissions } } },
        },
      });
      await this.restrictSubAdminGrants(
        tx,
        child.id,
        { scope, canteenIds },
        permissions,
      );
    }
  }

  /**
   * 获取当前管理员管理的子管理员列表
   */
  async findAll(
    adminId: string,
    role: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<AdminListResponseDto> {
    const skip = (page - 1) * pageSize;

    // 按当前管理关系查询
    // superadmin 可以查看全部子管理员，普通管理员查看直属下属
    const whereCondition =
      role === 'superadmin'
        ? { managerId: { not: null } }
        : { managerId: adminId };
    const where = {
      ...whereCondition,
      OR: [{ deletedAt: null }, { reports: { some: {} } }],
    };

    const [total, admins] = await Promise.all([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { reports: true } },
          permissions: true,
          canteens: {
            select: { canteen: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);

    const items: AdminDto[] = admins.map((admin) => ({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      scope: admin.scope,
      canteenIds: admin.canteens.map((entry) => entry.canteen.id),
      canteens: admin.canteens.map((entry) => entry.canteen),
      createdBy: admin.createdBy,
      managerId: admin.managerId,
      deletedAt: admin.deletedAt,
      directReportCount: admin._count?.reports ?? 0,
      permissions: admin.permissions.map((p) => p.permission),
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
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

  /**
   * 创建子管理员
   */
  async create(
    creatorId: string,
    creatorRole: string,
    creatorScope: AdminCanteenScope,
    creatorPermissions: readonly string[],
    createAdminDto: CreateAdminDto,
    authenticatedSessionVersion: number,
  ): Promise<AdminResponseDto> {
    const { username, password, scope, canteenIds, permissions, role } =
      createAdminDto;

    if (permissions.length === 0) {
      throw new BadRequestException('权限列表不能为空');
    }
    const finalRole = this.normalizeRoleName(role);

    this.validatePermissionGrant(creatorRole, creatorPermissions, permissions);

    await this.validateScopeGrant(creatorScope, { scope, canteenIds });
    this.validatePermissionScope(scope, permissions);

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建管理员及其权限，通过捕获数据库唯一约束错误来处理竞态条件
    try {
      const admin = await this.prisma.$transaction(async (tx) => {
        await lockAdminHierarchy(tx);
        const creator = await this.lockActor(
          tx,
          creatorId,
          authenticatedSessionVersion,
        );
        if (creator.deletedAt) throw new ForbiddenException('管理员已停用');
        if (
          creator.role !== 'superadmin' &&
          !creator.permissions.some(
            (item) => item.permission === 'admin:create',
          )
        )
          throw new ForbiddenException('缺少创建管理员权限');
        this.assertScopeSubset(creator, { scope, canteenIds });
        this.validatePermissionGrant(
          creator.role,
          creator.permissions.map((item) => item.permission),
          permissions,
        );
        const created = await tx.admin.create({
          data: {
            username,
            password: hashedPassword,
            role: finalRole,
            mustChangePassword: true,
            scope,
            canteens: {
              create: canteenIds.map((canteenId) => ({ canteenId })),
            },
            createdBy: creatorId,
            managerId: creatorId,
            permissions: {
              create: permissions.map((permission) => ({ permission })),
            },
          },
          include: {
            permissions: true,
            canteens: {
              select: { canteen: { select: { id: true, name: true } } },
            },
          },
        });
        await bumpAdminHierarchyVersions(tx, [creatorId]);
        await logAdminChange(tx, creatorId, 'admin:create', created.id, {
          after: { scope, canteenIds, permissions, role: finalRole },
        });
        return created;
      });

      return {
        code: 200,
        message: 'success',
        data: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          scope: admin.scope,
          canteenIds: admin.canteens.map((entry) => entry.canteen.id),
          canteens: admin.canteens.map((entry) => entry.canteen),
          createdBy: admin.createdBy,
          managerId: admin.managerId,
          permissions: admin.permissions.map((p) => p.permission),
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      };
    } catch (error: any) {
      // 处理 Prisma 唯一约束违规错误 (P2002)
      if (error?.code === 'P2002') {
        throw new BadRequestException('用户名已存在');
      }
      throw error;
    }
  }

  /**
   * 删除子管理员
   */
  async remove(
    operatorId: string,
    operatorRole: string,
    targetId: string,
    authenticatedSessionVersion: number,
  ): Promise<{ code: number; message: string; data: null }> {
    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId, deletedAt: null },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能删除直属子管理员，superadmin 可以删除任何子管理员
    if (operatorRole !== 'superadmin' && targetAdmin.managerId !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能删除非子管理员（即没有上级的管理员）
    if (!targetAdmin.managerId) {
      throw new ForbiddenException('无法删除该管理员');
    }

    // 保留审计、新闻和管理员层级的归属，认证入口排除已删除账号。
    await this.prisma.$transaction(async (tx) => {
      await lockAdminHierarchy(tx);
      const operator = await this.lockActor(
        tx,
        operatorId,
        authenticatedSessionVersion,
      );
      if (
        operator.deletedAt ||
        (operator.role !== 'superadmin' &&
          !operator.permissions.some(
            (item) => item.permission === 'admin:delete',
          ))
      ) {
        throw new ForbiddenException('缺少停用管理员权限');
      }
      const target = await this.lockAdmin(tx, targetId);
      if (
        target.deletedAt ||
        !target.managerId ||
        (operator.role !== 'superadmin' && target.managerId !== operatorId)
      ) {
        throw new ForbiddenException('无法停用该管理员');
      }
      if (await tx.admin.count({ where: { managerId: targetId } })) {
        throw new BadRequestException('请先选择新负责人并移交下属管理员');
      }
      await tx.admin.updateMany({
        where: { id: targetId, deletedAt: null },
        data: { deletedAt: new Date(), sessionVersion: { increment: 1 } },
      });
      await bumpAdminHierarchyVersions(tx, [target.managerId]);
      await logAdminChange(tx, operatorId, 'admin:retire', targetId, {
        affectedAdminIds: [targetId],
      });
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  async handover(
    operatorId: string,
    sourceId: string,
    { newManagerId, retireSource = false }: HandoverAdminDto,
    authenticatedSessionVersion: number,
  ): Promise<{ code: number; message: string; data: null }> {
    await this.prisma.$transaction(async (tx) => {
      await lockAdminHierarchy(tx);
      const operator = await this.lockActor(
        tx,
        operatorId,
        authenticatedSessionVersion,
      );
      const source = await this.lockAdmin(tx, sourceId);
      const recipient = await this.lockAdmin(tx, newManagerId);
      const can = (permission: string) =>
        operator.role === 'superadmin' ||
        operator.permissions.some((item) => item.permission === permission);
      if (
        operator.deletedAt ||
        !can('admin:edit') ||
        (retireSource && !can('admin:delete'))
      ) {
        throw new ForbiddenException('缺少移交或停用管理员权限');
      }
      if (
        !source.managerId ||
        sourceId === operatorId ||
        (operator.role !== 'superadmin' && source.managerId !== operatorId)
      ) {
        throw new ForbiddenException('只能移交所管理账号的下属');
      }
      if (
        recipient.deletedAt ||
        (operator.role !== 'superadmin' &&
          recipient.id !== operatorId &&
          recipient.managerId !== operatorId)
      ) {
        throw new ForbiddenException('新负责人必须为您本人或所管理的有效账号');
      }
      const descendants = await selfAndDescendantAdminIds(tx, sourceId);
      if (descendants.includes(newManagerId)) {
        throw new BadRequestException('新负责人须位于待移交的下属层级之外');
      }
      const moving = await tx.admin.findMany({
        where: { id: { in: descendants.filter((id) => id !== sourceId) } },
        include: {
          canteens: { select: { canteenId: true } },
          permissions: true,
        },
      });
      const reports = moving.filter((report) => report.managerId === sourceId);
      if (!reports.length)
        throw new BadRequestException('该管理员暂无下属可移交');
      const recipientPermissions = new Set(
        recipient.permissions.map((item) => item.permission),
      );
      for (const report of moving) {
        this.assertScopeSubset(recipient, {
          scope: report.scope,
          canteenIds: report.canteens.map((item) => item.canteenId),
        });
        if (
          recipient.role !== 'superadmin' &&
          report.permissions.some(
            (item) => !recipientPermissions.has(item.permission),
          )
        ) {
          throw new BadRequestException(
            `新负责人的权限须覆盖下属“${report.username}”的现有权限`,
          );
        }
      }
      const reportIds = reports.map((report) => report.id);
      await tx.admin.updateMany({
        where: { id: { in: reportIds } },
        data: { managerId: newManagerId },
      });
      await bumpAdminHierarchyVersions(tx, [sourceId, newManagerId]);
      await logAdminChange(tx, operatorId, 'admin:handover', sourceId, {
        previousManagerId: sourceId,
        newManagerId,
        directReportIds: reportIds,
        affectedAdminIds: descendants.filter((id) => id !== sourceId),
        retireSource,
      });
      if (retireSource && !source.deletedAt) {
        await tx.admin.update({
          where: { id: sourceId },
          data: { deletedAt: new Date(), sessionVersion: { increment: 1 } },
        });
        await logAdminChange(tx, operatorId, 'admin:retire', sourceId, {
          affectedAdminIds: [sourceId],
        });
      }
    });
    return { code: 200, message: '移交成功', data: null };
  }

  /**
   * 更新子管理员权限
   */
  async updatePermissions(
    operatorId: string,
    operatorRole: string,
    operatorScope: AdminCanteenScope,
    operatorPermissions: readonly string[],
    targetId: string,
    updatePermissionsDto: UpdatePermissionsDto,
    authenticatedSessionVersion: number,
  ): Promise<{ code: number; message: string; data: null }> {
    const { permissions, scope, canteenIds } = updatePermissionsDto;
    const role =
      updatePermissionsDto.role === undefined
        ? undefined
        : this.normalizeRoleName(updatePermissionsDto.role);
    this.validatePermissionScope(scope, permissions);

    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId, deletedAt: null },
      include: {
        manager: {
          select: { scope: true, canteens: { select: { canteenId: true } } },
        },
      },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能更新直属子管理员权限，superadmin 可以更新任何子管理员权限
    if (operatorRole !== 'superadmin' && targetAdmin.managerId !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能更新非子管理员的权限
    if (!targetAdmin.managerId) {
      throw new ForbiddenException('无法更新该管理员的权限');
    }

    if (targetAdmin.manager)
      this.assertScopeSubset(
        {
          scope: targetAdmin.manager.scope,
          canteenIds: targetAdmin.manager.canteens.map(
            (canteen) => canteen.canteenId,
          ),
        },
        { scope, canteenIds },
      );
    await this.validateScopeGrant(operatorScope, { scope, canteenIds });

    this.validatePermissionGrant(
      operatorRole,
      operatorPermissions,
      permissions,
    );

    // 使用事务更新权限
    await this.prisma.$transaction(async (tx) => {
      await lockAdminHierarchy(tx);
      const operator = await this.lockActor(
        tx,
        operatorId,
        authenticatedSessionVersion,
      );
      const target = await this.lockAdmin(tx, targetId);
      if (target.deletedAt || !target.managerId) {
        throw new ForbiddenException('无法更新该管理员的权限');
      }
      if (operator.role !== 'superadmin' && target.managerId !== operatorId) {
        throw new ForbiddenException('权限不足');
      }
      const parent =
        target.managerId === operatorId
          ? operator
          : await this.lockAdmin(tx, target.managerId);
      if (operator.deletedAt) throw new ForbiddenException('管理员已停用');
      if (
        operator.role !== 'superadmin' &&
        !operator.permissions.some((item) => item.permission === 'admin:edit')
      )
        throw new ForbiddenException('缺少编辑管理员权限');
      this.assertScopeSubset(operator, { scope, canteenIds });
      this.validatePermissionGrant(
        operator.role,
        operator.permissions.map((item) => item.permission),
        permissions,
      );
      this.assertScopeSubset(parent, { scope, canteenIds });
      this.validatePermissionGrant(
        parent.role,
        parent.permissions.map((item) => item.permission),
        permissions,
      );
      const before = { ...grantSnapshot(target), role: target.role };
      await tx.admin.update({
        where: { id: targetId },
        data: {
          scope,
          ...(role === undefined ? {} : { role }),
          canteens: {
            deleteMany: {},
            create: canteenIds.map((canteenId) => ({ canteenId })),
          },
        },
      });
      await this.restrictSubAdminGrants(
        tx,
        targetId,
        { scope, canteenIds },
        permissions,
      );

      // 删除现有权限
      await tx.adminPermission.deleteMany({
        where: { adminId: targetId },
      });

      // 创建新权限
      await tx.adminPermission.createMany({
        data: permissions.map((permission) => ({
          adminId: targetId,
          permission,
        })),
      });
      await logAdminChange(tx, operatorId, 'admin:permissions', targetId, {
        before,
        after: { scope, canteenIds, permissions, role: role ?? target.role },
        affectedAdminIds: await selfAndDescendantAdminIds(tx, targetId),
      });
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  /**
   * 管理员修改自己的密码
   */
  async changeOwnPassword(
    adminId: string,
    changePasswordDto: ChangeOwnPasswordDto,
    authenticatedSessionVersion: number,
  ): Promise<{ code: number; message: string; data: null }> {
    const { currentPassword, newPassword } = changePasswordDto;

    // 查找当前管理员
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId, deletedAt: null },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    if (admin.sessionVersion !== authenticatedSessionVersion) {
      throw new UnauthorizedException('登录会话已失效，请重新登录');
    }

    // 验证当前密码
    const isPasswordMatching = await bcrypt.compare(
      currentPassword,
      admin.password,
    );

    if (!isPasswordMatching) {
      throw new BadRequestException('当前密码错误');
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.admin.updateMany({
        where: {
          id: adminId,
          deletedAt: null,
          sessionVersion: authenticatedSessionVersion,
        },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
          mustChangePassword: false,
        },
      });
      if (!changed.count) throw new ConflictException('密码已更新，请重新登录');
      await logAdminChange(tx, adminId, 'admin:password:change', adminId, {});
    });

    return {
      code: 200,
      message: '密码修改成功',
      data: null,
    };
  }

  /**
   * 修改子管理员的密码
   * 只有该子管理员的直属上级或 superadmin 可以修改
   */
  async changeSubAdminPassword(
    operatorId: string,
    operatorRole: string,
    targetId: string,
    changePasswordDto: ChangeSubAdminPasswordDto,
    authenticatedSessionVersion: number,
  ): Promise<{ code: number; message: string; data: null }> {
    const { newPassword } = changePasswordDto;

    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId, deletedAt: null },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能修改直属子管理员密码，superadmin 可以修改任何子管理员密码
    if (operatorRole !== 'superadmin' && targetAdmin.managerId !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能修改非子管理员的密码（即没有上级的管理员）
    if (!targetAdmin.managerId) {
      throw new ForbiddenException('无法修改该管理员的密码');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.prisma.$transaction(async (tx) => {
      await lockAdminHierarchy(tx);
      const operator = await this.lockActor(
        tx,
        operatorId,
        authenticatedSessionVersion,
      );
      const target = await this.lockAdmin(tx, targetId);
      if (
        operator.deletedAt ||
        target.deletedAt ||
        !target.managerId ||
        (operator.role !== 'superadmin' &&
          (target.managerId !== operatorId ||
            !operator.permissions.some(
              (item) => item.permission === 'admin:edit',
            )))
      ) {
        throw new ForbiddenException('无法重置该管理员的密码');
      }
      await tx.admin.update({
        where: { id: targetId },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
          mustChangePassword: true,
        },
      });
      await logAdminChange(
        tx,
        operatorId,
        'admin:password:reset',
        targetId,
        {},
      );
    });

    return {
      code: 200,
      message: '密码修改成功',
      data: null,
    };
  }
}
