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
  AdminListResponseDto,
  AdminResponseDto,
  AdminDto,
} from './dto/admin-response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAdminsService {
  constructor(private prisma: PrismaService) {}

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
      role === 'superadmin' ? { createdBy: { not: null } } : { createdBy: adminId };

    const [total, admins] = await Promise.all([
      this.prisma.admin.count({ where: whereCondition }),
      this.prisma.admin.findMany({
        where: whereCondition,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          permissions: true,
        },
      }),
    ]);

    const items: AdminDto[] = admins.map((admin) => ({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      canteenId: admin.canteenId,
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
    createAdminDto: CreateAdminDto,
  ): Promise<AdminResponseDto> {
    const { username, password, canteenId, permissions } = createAdminDto;

    // 检查用户名是否已存在
    const existingAdmin = await this.prisma.admin.findUnique({
      where: { username },
    });
    if (existingAdmin) {
      throw new BadRequestException('用户名已存在');
    }

    // 如果传入了 canteenId，验证食堂是否存在
    if (canteenId) {
      const canteen = await this.prisma.canteen.findUnique({
        where: { id: canteenId },
      });
      if (!canteen) {
        throw new BadRequestException('指定的食堂不存在');
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建管理员及其权限
    const admin = await this.prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: 'admin',
        canteenId: canteenId || null,
        createdBy: creatorId,
        permissions: {
          create: permissions.map((permission) => ({ permission })),
        },
      },
      include: {
        permissions: true,
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
        createdBy: admin.createdBy,
        permissions: admin.permissions.map((p) => p.permission),
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    };
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
    targetId: string,
    updatePermissionsDto: UpdatePermissionsDto,
  ): Promise<{ code: number; message: string; data: null }> {
    const { permissions } = updatePermissionsDto;

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

    // 使用事务更新权限
    await this.prisma.$transaction(async (tx) => {
      // 1. 删除现有权限
      await tx.adminPermission.deleteMany({
        where: { adminId: targetId },
      });

      // 2. 创建新权限
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
}
