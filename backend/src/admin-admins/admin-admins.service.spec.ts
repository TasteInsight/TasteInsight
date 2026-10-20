import { Test, TestingModule } from '@nestjs/testing';
import { AdminAdminsService } from './admin-admins.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const mockPrismaService = {
  admin: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  adminPermission: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  canteen: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  operationLog: { create: jest.fn() },
  $queryRaw: jest
    .fn()
    .mockImplementation(async (sql) =>
      sql?.text?.includes('WITH RECURSIVE') ? [{ id: sql.values[0] }] : [],
    ),
  $transaction: jest.fn((callback) =>
    callback({
      ...mockPrismaService,
      admin: {
        ...mockPrismaService.admin,
        findUnique: jest.fn(async ({ where }) => ({
          id: where.id,
          role: 'superadmin',
          createdBy: 'creator-id',
          managerId: 'creator-id',
          sessionVersion: 0,
          scope: 'GLOBAL',
          canteens: [],
          permissions: [],
          deletedAt: null,
        })),
      },
    }),
  ),
};

describe('AdminAdminsService', () => {
  let service: AdminAdminsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.canteen.findMany.mockImplementation(async ({ where }) =>
      where.id.in.map((id) => ({ id })),
    );
    mockPrismaService.admin.findMany.mockResolvedValue([]);
    mockPrismaService.admin.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAdminsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminAdminsService>(AdminAdminsService);
    prisma = mockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    'create',
    'remove',
    'updatePermissions',
    'handover',
    'changeSubAdminPassword',
    'changeOwnPassword',
  ])(
    'rejects %s from a session revoked after its authentication guard',
    async (action) => {
      const actor = {
        id: 'actor',
        role: 'superadmin',
        managerId: 'parent',
        createdBy: 'parent',
        scope: 'GLOBAL',
        canteens: [],
        permissions: [],
        deletedAt: null,
        sessionVersion: 1,
        password: 'hash',
      };
      prisma.admin.findUnique.mockResolvedValue(actor);
      if (action !== 'changeOwnPassword')
        prisma.$transaction.mockImplementationOnce((callback) =>
          callback({
            ...prisma,
            admin: {
              ...prisma.admin,
              findUnique: jest.fn(async ({ where }) => ({
                ...actor,
                id: where.id,
              })),
            },
          }),
        );
      const grant = {
        scope: 'GLOBAL' as const,
        canteenIds: [],
        permissions: ['log:view'],
      };
      const operations = {
        create: () =>
          service.create(
            'actor',
            'superadmin',
            grant,
            [],
            { ...grant, username: 'new', password: 'Personal123!' },
            0,
          ),
        remove: () => service.remove('actor', 'superadmin', 'target', 0),
        updatePermissions: () =>
          service.updatePermissions(
            'actor',
            'superadmin',
            grant,
            [],
            'target',
            grant,
            0,
          ),
        handover: () =>
          service.handover(
            'actor',
            'target',
            { newManagerId: 'replacement' },
            0,
          ),
        changeSubAdminPassword: () =>
          service.changeSubAdminPassword(
            'actor',
            'superadmin',
            'target',
            { newPassword: 'Personal123!' },
            0,
          ),
        changeOwnPassword: () =>
          service.changeOwnPassword(
            'actor',
            { currentPassword: 'Before123!', newPassword: 'Personal123!' },
            0,
          ),
      };
      await expect(operations[action]()).rejects.toThrow(UnauthorizedException);
      expect(prisma.admin.create).not.toHaveBeenCalled();
      expect(prisma.admin.update).not.toHaveBeenCalled();
      expect(prisma.admin.updateMany).not.toHaveBeenCalled();
    },
  );

  describe('findAll', () => {
    it('should return list of admins for superadmin', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          username: 'admin1',
          role: 'admin',
          scope: 'CANTEENS' as const,
          canteenIds: ['c1'],
          canteens: [{ canteenId: 'c1', canteen: { id: 'c1', name: 'c1' } }],
          createdBy: 'superadmin-id',
          managerId: 'superadmin-id',
          permissions: [{ permission: 'read' }],
          canteen: { id: 'c1', name: 'Canteen 1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.admin.findMany.mockResolvedValue(mockAdmins);
      prisma.admin.count.mockResolvedValue(1);

      const result = await service.findAll(
        'superadmin-id',
        'superadmin',
        1,
        20,
      );

      expect(result.code).toBe(200);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
      // superadmin should see all admins with createdBy not null
      expect(prisma.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            managerId: { not: null },
            OR: [{ deletedAt: null }, { reports: { some: {} } }],
          },
        }),
      );
    });

    it('should return list of admins created by admin', async () => {
      const mockAdmins = [
        {
          scope: 'GLOBAL' as const,
          canteenIds: [],
          canteens: [],
          id: 'subadmin-1',
          username: 'subadmin',
          role: 'admin',
          createdBy: 'admin-1',
          managerId: 'admin-1',
          permissions: [],
          canteen: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.admin.findMany.mockResolvedValue(mockAdmins);
      prisma.admin.count.mockResolvedValue(1);

      const result = await service.findAll('admin-1', 'admin', 1, 20);

      expect(result.code).toBe(200);
      expect(prisma.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            managerId: 'admin-1',
            OR: [{ deletedAt: null }, { reports: { some: {} } }],
          },
        }),
      );
    });
  });

  describe('create', () => {
    const createDto = {
      username: 'newadmin',
      password: 'Password123!',
      scope: 'CANTEENS' as const,
      canteenIds: ['canteen-1'],
      permissions: ['dish:view'],
    };

    it('should create a new admin', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'canteen-1',
        name: 'Test',
      });
      prisma.admin.create.mockResolvedValue({
        id: 'new-admin-id',
        username: 'newadmin',
        role: 'admin',
        scope: 'CANTEENS' as const,
        canteenIds: ['canteen-1'],
        canteens: [
          {
            canteenId: 'canteen-1',
            canteen: { id: 'canteen-1', name: 'canteen-1' },
          },
        ],
        createdBy: 'creator-id',
        managerId: 'creator-id',
        permissions: [{ permission: 'dish:view' }],
        canteen: { id: 'canteen-1', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        'creator-id',
        'superadmin',
        { scope: 'GLOBAL', canteenIds: [] },
        [],
        createDto,
        0,
      );

      expect(result.code).toBe(200);
      expect(result.data.username).toBe('newadmin');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
    });

    it('should throw BadRequestException if username exists (P2002 error)', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'canteen-1',
        name: 'Test',
      });
      prisma.admin.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create(
          'creator-id',
          'superadmin',
          { scope: 'GLOBAL', canteenIds: [] },
          [],
          createDto,
          0,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use creator canteenId if provided', async () => {
      prisma.canteen.findUnique.mockResolvedValue({
        id: 'creator-canteen',
        name: 'Creator Canteen',
      });
      prisma.admin.create.mockResolvedValue({
        id: 'new-admin-id',
        username: 'newadmin',
        role: 'admin',
        scope: 'CANTEENS' as const,
        canteenIds: ['creator-canteen'],
        canteens: [
          {
            canteenId: 'creator-canteen',
            canteen: { id: 'creator-canteen', name: 'creator-canteen' },
          },
        ],
        createdBy: 'creator-id',
        managerId: 'creator-id',
        permissions: [],
        canteen: { id: 'creator-canteen', name: 'Creator Canteen' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(
        'creator-id',
        'admin',
        { scope: 'CANTEENS', canteenIds: ['creator-canteen'] },
        ['dish:view'],
        {
          ...createDto,
          scope: 'CANTEENS' as const,
          canteenIds: ['creator-canteen'],
        },
        0,
      );

      expect(prisma.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: 'CANTEENS',
            canteens: { create: [{ canteenId: 'creator-canteen' }] },
          }),
        }),
      );
    });

    it('should throw ForbiddenException if canteen admin creates admin without canteenId', async () => {
      await expect(
        service.create(
          'creator-id',
          'admin',
          { scope: 'CANTEENS', canteenIds: ['creator-canteen'] },
          ['dish:view'],
          {
            ...createDto,
            scope: 'GLOBAL' as const,
            canteenIds: [],
          } as any,
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if canteen admin creates admin for different canteen', async () => {
      await expect(
        service.create(
          'creator-id',
          'admin',
          { scope: 'CANTEENS', canteenIds: ['creator-canteen'] },
          ['dish:view'],
          {
            ...createDto,
            scope: 'CANTEENS' as const,
            canteenIds: ['other-canteen'],
          },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unknown, incomplete, and non-owned permission grants', async () => {
      await expect(
        service.create(
          'creator-id',
          'superadmin',
          { scope: 'GLOBAL', canteenIds: [] },
          [],
          { ...createDto, permissions: ['unknown:permission'] },
          0,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(
          'creator-id',
          'superadmin',
          { scope: 'GLOBAL', canteenIds: [] },
          [],
          { ...createDto, permissions: ['comment:delete'] },
          0,
        ),
      ).rejects.toThrow('所授权限缺少依赖');

      await expect(
        service.create(
          'creator-id',
          'admin',
          { scope: 'GLOBAL', canteenIds: [] },
          ['dish:view'],
          { ...createDto, permissions: ['news:view'] },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it.each(['permissions', 'password'])(
      'cannot restore a retired account through %s changes',
      async (operation) => {
        prisma.admin.findUnique.mockImplementation(async ({ where }) =>
          where.deletedAt === null
            ? null
            : { id: 'retired', createdBy: 'creator', deletedAt: new Date() },
        );
        const action =
          operation === 'permissions'
            ? service.updatePermissions(
                'creator',
                'superadmin',
                { scope: 'GLOBAL', canteenIds: [] },
                [],
                'retired',
                { scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] },
                0,
              )
            : service.changeSubAdminPassword(
                'creator',
                'superadmin',
                'retired',
                { newPassword: 'Password123!' },
                0,
              );
        await expect(action).rejects.toThrow(NotFoundException);
        expect(prisma.admin.update).not.toHaveBeenCalled();
        expect(prisma.adminPermission.createMany).not.toHaveBeenCalled();
      },
    );
    it('retires an admin without deleting audit or news ownership', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
      });
      prisma.admin.delete.mockResolvedValue({});

      const result = await service.remove(
        'superadmin-id',
        'superadmin',
        'target-admin',
        0,
      );

      expect(result.code).toBe(200);
      expect(prisma.admin.updateMany).toHaveBeenCalledWith({
        where: { id: 'target-admin', deletedAt: null },
        data: { deletedAt: expect.any(Date), sessionVersion: { increment: 1 } },
      });
      expect(prisma.admin.delete).not.toHaveBeenCalled();
    });

    it('should delete admin created by self', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
        managerId: 'admin-1',
      });
      prisma.admin.delete.mockResolvedValue({});

      const result = await service.remove(
        'admin-1',
        'admin',
        'target-admin',
        0,
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('admin-1', 'admin', 'unknown', 0),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trying to delete admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'admin-1',
        role: 'admin',
        createdBy: null,
        managerId: null,
      });

      await expect(
        service.remove('other-admin', 'admin', 'admin-1', 0),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
      });

      await expect(
        service.remove('admin-1', 'admin', 'target-admin', 0),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it.each(['create', 'updatePermissions'] as const)(
    'rejects %s after its action permission was revoked while waiting for the lock',
    async (action) => {
      const actor = {
        id: 'actor',
        sessionVersion: 0,
        role: 'admin',
        scope: 'GLOBAL',
        canteens: [],
        permissions: [{ permission: 'dish:view' }],
        deletedAt: null,
      };
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target',
        createdBy: actor.id,
        managerId: actor.id,
      });
      prisma.$transaction.mockImplementationOnce((callback) =>
        callback({
          ...prisma,
          admin: {
            ...prisma.admin,
            findUnique: jest.fn().mockResolvedValue(actor),
          },
        }),
      );
      const previousPermissions = [
        'dish:view',
        'canteen:view',
        'admin:view',
        'admin:create',
        'admin:edit',
      ];
      const requested = {
        scope: 'CANTEENS' as const,
        canteenIds: ['c1'],
        permissions: ['dish:view'],
      };
      const operation =
        action === 'create'
          ? service.create(
              'actor',
              'admin',
              { scope: 'GLOBAL', canteenIds: [] },
              previousPermissions,
              { ...requested, username: 'new', password: 'Password123!' },
              0,
            )
          : service.updatePermissions(
              'actor',
              'admin',
              { scope: 'GLOBAL', canteenIds: [] },
              previousPermissions,
              'target',
              requested,
              0,
            );
      await expect(operation).rejects.toThrow(ForbiddenException);
      expect(prisma.admin.create).not.toHaveBeenCalled();
      expect(prisma.admin.update).not.toHaveBeenCalled();
    },
  );

  it('keeps a superadmin grant inside the target creator scope', async () => {
    prisma.admin.findUnique.mockResolvedValue({
      id: 'leaf',
      createdBy: 'parent',
      managerId: 'parent',
      manager: { scope: 'CANTEENS', canteens: [{ id: 'c1' }] },
    });
    await expect(
      service.updatePermissions(
        'root',
        'superadmin',
        { scope: 'GLOBAL', canteenIds: [] },
        [],
        'leaf',
        { scope: 'CANTEENS', canteenIds: ['c2'], permissions: ['dish:view'] },
        0,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.admin.update).not.toHaveBeenCalled();
  });

  describe('updatePermissions', () => {
    it('should update permissions as superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
      });
      prisma.adminPermission.deleteMany.mockResolvedValue({});
      prisma.adminPermission.createMany.mockResolvedValue({});

      const result = await service.updatePermissions(
        'superadmin-id',
        'superadmin',
        { scope: 'GLOBAL', canteenIds: [] },
        [],
        'target-admin',
        { scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] },
        0,
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          { scope: 'GLOBAL', canteenIds: [] },
          ['dish:view'],
          'unknown',
          { scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] },
          0,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
      });

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          { scope: 'GLOBAL', canteenIds: [] },
          ['dish:view'],
          'target-admin',
          { scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'superadmin',
        createdBy: null,
        managerId: null,
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
      });

      await expect(
        service.updatePermissions(
          'superadmin-id',
          'superadmin',
          { scope: 'GLOBAL', canteenIds: [] },
          [],
          'target-admin',
          { scope: 'GLOBAL', canteenIds: [], permissions: ['dish:view'] },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if canteen manager sets canteenId to null', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
        managerId: 'admin-1',
        scope: 'CANTEENS' as const,
        canteenIds: ['canteen-1'],
        canteens: [
          {
            canteenId: 'canteen-1',
            canteen: { id: 'canteen-1', name: 'canteen-1' },
          },
        ],
      });

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          { scope: 'CANTEENS', canteenIds: ['canteen-1'] },
          ['dish:view'],
          'target-admin',
          {
            permissions: ['dish:view'],
            scope: 'GLOBAL' as const,
            canteenIds: [],
          },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects permission escalation and incomplete dependency updates', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
        managerId: 'admin-1',
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
      });

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          { scope: 'GLOBAL', canteenIds: [] },
          ['admin:edit', 'dish:view'],
          'target-admin',
          { scope: 'GLOBAL', canteenIds: [], permissions: ['news:view'] },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          { scope: 'GLOBAL', canteenIds: [] },
          ['admin:edit', 'comment:delete'],
          'target-admin',
          { scope: 'GLOBAL', canteenIds: [], permissions: ['comment:delete'] },
          0,
        ),
      ).rejects.toThrow('所授权限缺少依赖');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('changeOwnPassword', () => {
    it('should change own password successfully', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
        sessionVersion: 0,
      });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password matches
        .mockResolvedValueOnce(false); // new password is different
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeOwnPassword(
        'admin-1',
        {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        },
        0,
      );

      expect(result.code).toBe(200);
      expect(prisma.admin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            password: 'hashed-password',
            sessionVersion: { increment: 1 },
            mustChangePassword: false,
          },
        }),
      );
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.changeOwnPassword(
          'unknown',
          {
            currentPassword: 'old',
            newPassword: 'new',
          },
          0,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if current password is wrong', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
        sessionVersion: 0,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changeOwnPassword(
          'admin-1',
          {
            currentPassword: 'wrong-password',
            newPassword: 'NewPassword123!',
          },
          0,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
        sessionVersion: 0,
      });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password matches
        .mockResolvedValueOnce(true); // new password same as old

      await expect(
        service.changeOwnPassword(
          'admin-1',
          {
            currentPassword: 'OldPassword123!',
            newPassword: 'OldPassword123!',
          },
          0,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeSubAdminPassword', () => {
    it('should change sub-admin password as superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
      });
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeSubAdminPassword(
        'superadmin-id',
        'superadmin',
        'target-admin',
        { newPassword: 'NewPassword123!' },
        0,
      );

      expect(result.code).toBe(200);
    });

    it('should change sub-admin password as creator', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
        managerId: 'admin-1',
      });
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeSubAdminPassword(
        'admin-1',
        'admin',
        'target-admin',
        { newPassword: 'NewPassword123!' },
        0,
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.changeSubAdminPassword(
          'admin-1',
          'admin',
          'unknown',
          {
            newPassword: 'NewPassword123!',
          },
          0,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        managerId: 'other-admin',
      });

      await expect(
        service.changeSubAdminPassword(
          'admin-1',
          'admin',
          'target-admin',
          {
            newPassword: 'NewPassword123!',
          },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        scope: 'GLOBAL' as const,
        canteenIds: [],
        canteens: [],
        id: 'target-admin',
        role: 'admin',
        createdBy: null,
        managerId: null,
      });

      await expect(
        service.changeSubAdminPassword(
          'superadmin-id',
          'superadmin',
          'target-admin',
          { newPassword: 'NewPassword123!' },
          0,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
