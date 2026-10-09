import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import { AdminLogQueryDto } from './dto/admin-log-query.dto';
import { AdminLogListResponseDto } from './dto/admin-log-response.dto';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AdminLogQueryDto,
    admin: AdminInfo,
  ): Promise<AdminLogListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const queryFilters: Prisma.OperationLogWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate
                ? { gte: this.parseDateBoundary(query.startDate, false) }
                : {}),
              ...(query.endDate
                ? { lte: this.parseDateBoundary(query.endDate, true) }
                : {}),
            },
          }
        : {}),
    };
    let where = queryFilters;
    if (admin.role !== 'superadmin') {
      const directSubAdmins = await this.prisma.admin.findMany({
        where: { createdBy: admin.id },
        select: { id: true },
      });
      const allowedAdminIds = [
        admin.id,
        ...directSubAdmins.map((item) => item.id),
      ];
      where = {
        AND: [{ adminId: { in: allowedAdminIds } }, queryFilters],
      };
    }

    const [total, logs] = await Promise.all([
      this.prisma.operationLog.count({ where }),
      this.prisma.operationLog.findMany({
        where,
        include: { admin: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      code: 200,
      message: 'success',
      data: {
        items: logs.map((log) => ({
          id: log.id,
          adminId: log.adminId,
          adminUsername: log.admin.username,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          details: log.details,
          result: log.result,
          createdAt: log.createdAt,
        })),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  private parseDateBoundary(value: string, endOfDay: boolean): Date {
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T23:59:59.999Z`);
    }
    return new Date(value);
  }
}
