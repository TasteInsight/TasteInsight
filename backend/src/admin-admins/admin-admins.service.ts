import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
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

@Injectable()
export class AdminAdminsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 验证食堂ID是否存在（如果提供）
   */
  private async validateCanteenId(
    canteenId: string | null | undefined,
  ): Promise<void> {
    if (canteenId !== undefined && canteenId !== null) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
    }
  }

  /**
   * 获取当前管理员创建的子管理员列表
   */
  async findAll(
    adminId: string,
    role: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<AdminListResponseDto> {
    const skip = (page - 1) * pageSize;

    // 根据角色决定查询条件
    // superadmin 可以看到所有子管理员，普通管理员只能看到自己创建的
    const whereCondition =
      role === 'superadmin'
        ? { createdBy: { not: null } }
        : { createdBy: adminId };

    const [total, admins] = await Promise.all([
      this.prisma.admin.count({ where: whereCondition }),
      this.prisma.admin.findMany({
        where: whereCondition,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          permissions: true,
          canteen: true,
        },
      }),
    ]);

    const items: AdminDto[] = admins.map((admin) => ({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      canteenId: admin.canteenId,
      canteenName: admin.canteen?.name ?? null,
      createdBy: admin.createdBy,
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
    creatorCanteenId: string | null,
    createAdminDto: CreateAdminDto,
  ): Promise<AdminResponseDto> {
    const { username, password, canteenId, permissions, role } = createAdminDto;

    // 食堂管理员权限校验：
    // 1. 食堂管理员不能创建全校管理员（canteenId 为 null 或 undefined）
    // 2. 食堂管理员只能创建属于同一食堂的管理员
    if (creatorCanteenId) {
      if (!canteenId) {
        throw new ForbiddenException('您无权创建全校管理员');
      }
      if (canteenId !== creatorCanteenId) {
        throw new ForbiddenException('您只能创建所属食堂的管理员');
      }
    }

    // 验证食堂存在性
    await this.validateCanteenId(canteenId);

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 确定角色：如果提供了 role 则使用，否则默认为 'admin'
    // 不允许创建 superadmin 角色的子管理员
    const finalRole = role && role !== 'superadmin' ? role : 'admin';

    // 创建管理员及其权限，通过捕获数据库唯一约束错误来处理竞态条件
    try {
      const admin = await this.prisma.admin.create({
        data: {
          username,
          password: hashedPassword,
          role: finalRole,
          canteenId: canteenId || null,
          createdBy: creatorId,
          permissions: {
            create: permissions.map((permission) => ({ permission })),
          },
        },
        include: {
          permissions: true,
          canteen: true,
        },
      });

      return {
        code: 200,
        message: 'success',
        data: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          canteenId: admin.canteenId,
          canteenName: admin.canteen?.name ?? null,
          createdBy: admin.createdBy,
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
  ): Promise<{ code: number; message: string; data: null }> {
    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能删除自己创建的子管理员，superadmin 可以删除任何子管理员
    if (operatorRole !== 'superadmin' && targetAdmin.createdBy !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能删除非子管理员（即没有 createdBy 的管理员）
    if (!targetAdmin.createdBy) {
      throw new ForbiddenException('无法删除该管理员');
    }

    // 删除管理员（权限会因为 onDelete: Cascade 自动删除）
    await this.prisma.admin.delete({
      where: { id: targetId },
    });

    return {
      code: 200,
      message: '操作成功',
      data: null,
    };
  }

  /**
   * 更新子管理员权限
   */
  async updatePermissions(
    operatorId: string,
    operatorRole: string,
    operatorCanteenId: string | null,
    targetId: string,
    updatePermissionsDto: UpdatePermissionsDto,
  ): Promise<{ code: number; message: string; data: null }> {
    const { permissions, canteenId } = updatePermissionsDto;

    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能更新自己创建的子管理员权限，superadmin 可以更新任何子管理员权限
    if (operatorRole !== 'superadmin' && targetAdmin.createdBy !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能更新非子管理员的权限
    if (!targetAdmin.createdBy) {
      throw new ForbiddenException('无法更新该管理员的权限');
    }

    // 食堂管理员权限校验（更新管理范围时）
    if (operatorCanteenId && canteenId !== undefined) {
      // 食堂管理员不能将子管理员设置为全校管理员
      if (canteenId === null) {
        throw new ForbiddenException('您无权将管理员设置为全校管理员');
      }
      // 食堂管理员不能将子管理员分配到其他食堂
      if (canteenId !== operatorCanteenId) {
        throw new ForbiddenException('您只能管理所属食堂的管理员');
      }
    }

    // 验证食堂存在性
    await this.validateCanteenId(canteenId);

    // 使用事务更新权限
    await this.prisma.$transaction(async (tx) => {
      // 首先更新管理范围（食堂）
      if (canteenId !== undefined) {
        await tx.admin.update({
          where: { id: targetId },
          data: { canteenId: canteenId ?? null },
        });
      }

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
  ): Promise<{ code: number; message: string; data: null }> {
    const { currentPassword, newPassword } = changePasswordDto;

    // 查找当前管理员
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
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
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    return {
      code: 200,
      message: '密码修改成功',
      data: null,
    };
  }

  /**
   * 修改子管理员的密码
   * 只有创建该子管理员的管理员或 superadmin 可以修改
   */
  async changeSubAdminPassword(
    operatorId: string,
    operatorRole: string,
    targetId: string,
    changePasswordDto: ChangeSubAdminPasswordDto,
  ): Promise<{ code: number; message: string; data: null }> {
    const { newPassword } = changePasswordDto;

    // 查找目标管理员
    const targetAdmin = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });

    if (!targetAdmin) {
      throw new NotFoundException('子管理员不存在');
    }

    // 检查权限：只能修改自己创建的子管理员密码，superadmin 可以修改任何子管理员密码
    if (operatorRole !== 'superadmin' && targetAdmin.createdBy !== operatorId) {
      throw new ForbiddenException('权限不足');
    }

    // 不能修改非子管理员的密码（即没有 createdBy 的管理员）
    if (!targetAdmin.createdBy) {
      throw new ForbiddenException('无法修改该管理员的密码');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.prisma.admin.update({
      where: { id: targetId },
      data: { password: hashedPassword },
    });

    return {
      code: 200,
      message: '密码修改成功',
      data: null,
    };
  }
}
