import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma.service';
import { AdminLogsService } from './admin-logs.service';
import { AdminLogQueryDto } from './dto/admin-log-query.dto';

const mockPrismaService = {
  $transaction: jest.fn(async (callback) => callback(mockPrismaService)),
  $queryRaw: jest.fn(),
  admin: {
    findMany: jest.fn(),
  },
  operationLog: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AdminLogsService', () => {
  let service: AdminLogsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.admin.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminLogsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(AdminLogsService);
  });

  it('returns paginated logs with admin usernames and all supported filters', async () => {
    const createdAt = new Date('2026-08-12T12:00:00.000Z');
    mockPrismaService.operationLog.count.mockResolvedValue(1);
    mockPrismaService.operationLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        adminId: 'admin-1',
        admin: { username: 'alice' },
        action: 'dish:update',
        targetType: 'dish',
        targetId: 'dish-1',
        details: { fields: ['price'] },
        result: 'success',
        createdAt,
      },
    ]);

    const result = await service.findAll(
      {
        page: 2,
        pageSize: 10,
        adminId: 'admin-1',
        action: 'dish:update',
        startDate: '2026-08-01',
        endDate: '2026-08-12',
      },
      {
        id: 'superadmin-1',
        username: 'root',
        role: 'superadmin',
        scope: 'GLOBAL' as const,
        canteenIds: [],
        permissions: ['admin:view'],
      },
    );

    const expectedWhere = {
      adminId: 'admin-1',
      action: 'dish:update',
      createdAt: {
        gte: new Date('2026-08-01T00:00:00.000Z'),
        lte: new Date('2026-08-12T23:59:59.999Z'),
      },
    };
    expect(mockPrismaService.operationLog.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(mockPrismaService.operationLog.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      code: 200,
      message: 'success',
      data: {
        items: [
          {
            id: 'log-1',
            adminId: 'admin-1',
            adminUsername: 'alice',
            action: 'dish:update',
            targetType: 'dish',
            targetId: 'dish-1',
            details: { fields: ['price'] },
            result: 'success',
            createdAt,
          },
        ],
        meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
      },
    });
  });

  it('scopes a regular admin to self and all descendant admins', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'sub-admin-1' },
      { id: 'sub-admin-2' },
      { id: 'grandchild' },
    ]);
    mockPrismaService.operationLog.count.mockResolvedValue(0);
    mockPrismaService.operationLog.findMany.mockResolvedValue([]);

    await service.findAll(
      Object.assign(new AdminLogQueryDto(), {
        adminId: 'unrelated-admin',
        action: 'update',
      }),
      {
        id: 'admin-1',
        username: 'alice',
        role: 'admin',
        scope: 'CANTEENS' as const,
        canteenIds: ['canteen-1'],
        permissions: ['admin:view'],
      },
    );

    const expectedWhere = {
      AND: [
        {
          adminId: {
            in: ['admin-1', 'sub-admin-1', 'sub-admin-2', 'grandchild'],
          },
        },
        { adminId: 'unrelated-admin', action: 'update' },
      ],
    };
    expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: 'RepeatableRead',
      },
    );
    expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['admin-1'] }),
    );
    expect(mockPrismaService.operationLog.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(mockPrismaService.operationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere, skip: 0, take: 20 }),
    );
  });
});
