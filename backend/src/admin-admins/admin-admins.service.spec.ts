import { Test, TestingModule } from '@nestjs/testing';
import { AdminAdminsService } from './admin-admins.service';
import { PrismaService } from '@/prisma.service';
import {
  NotFoundException,
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
  },
  adminPermission: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  canteen: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

describe('AdminAdminsService', () => {
  let service: AdminAdminsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

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

  describe('findAll', () => {
    it('should return list of admins for superadmin', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          username: 'admin1',
          role: 'admin',
          canteenId: 'c1',
          createdBy: 'superadmin-id',
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
          where: { createdBy: { not: null } },
        }),
      );
    });

    it('should return list of admins created by admin', async () => {
      const mockAdmins = [
        {
          id: 'subadmin-1',
          username: 'subadmin',
          role: 'admin',
          createdBy: 'admin-1',
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
          where: { createdBy: 'admin-1' },
        }),
      );
    });
  });

  describe('create', () => {
    const createDto = {
      username: 'newadmin',
      password: 'Password123!',
      canteenId: 'canteen-1',
      permissions: ['read', 'write'],
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
        canteenId: 'canteen-1',
        createdBy: 'creator-id',
        permissions: [{ permission: 'read' }, { permission: 'write' }],
        canteen: { id: 'canteen-1', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create('creator-id', null, createDto);

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
        service.create('creator-id', null, createDto),
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
        canteenId: 'creator-canteen',
        createdBy: 'creator-id',
        permissions: [],
        canteen: { id: 'creator-canteen', name: 'Creator Canteen' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create('creator-id', 'creator-canteen', {
        ...createDto,
        canteenId: 'creator-canteen',
      });

      expect(prisma.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canteenId: 'creator-canteen',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if canteen admin creates admin without canteenId', async () => {
      await expect(
        service.create('creator-id', 'creator-canteen', {
          ...createDto,
          canteenId: undefined,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if canteen admin creates admin for different canteen', async () => {
      await expect(
        service.create('creator-id', 'creator-canteen', {
          ...createDto,
          canteenId: 'other-canteen',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete admin as superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
      });
      prisma.admin.delete.mockResolvedValue({});

      const result = await service.remove(
        'superadmin-id',
        'superadmin',
        'target-admin',
      );

      expect(result.code).toBe(200);
      expect(prisma.admin.delete).toHaveBeenCalledWith({
        where: { id: 'target-admin' },
      });
    });

    it('should delete admin created by self', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
      });
      prisma.admin.delete.mockResolvedValue({});

      const result = await service.remove('admin-1', 'admin', 'target-admin');

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('admin-1', 'admin', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if trying to delete admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
        createdBy: null,
      });

      await expect(
        service.remove('other-admin', 'admin', 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
      });

      await expect(
        service.remove('admin-1', 'admin', 'target-admin'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePermissions', () => {
    it('should update permissions as superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        canteenId: null,
      });
      prisma.adminPermission.deleteMany.mockResolvedValue({});
      prisma.adminPermission.createMany.mockResolvedValue({});

      const result = await service.updatePermissions(
        'superadmin-id',
        'superadmin',
        null,
        'target-admin',
        { permissions: ['read', 'write'] },
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePermissions('admin-1', 'admin', null, 'unknown', {
          permissions: ['read'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
        canteenId: null,
      });

      await expect(
        service.updatePermissions('admin-1', 'admin', null, 'target-admin', {
          permissions: ['read'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'superadmin',
        createdBy: null,
        canteenId: null,
      });

      await expect(
        service.updatePermissions(
          'superadmin-id',
          'superadmin',
          null,
          'target-admin',
          { permissions: ['read'] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if canteen manager sets canteenId to null', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
        canteenId: 'canteen-1',
      });

      await expect(
        service.updatePermissions(
          'admin-1',
          'admin',
          'canteen-1',
          'target-admin',
          { permissions: ['read'], canteenId: null },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('changeOwnPassword', () => {
    it('should change own password successfully', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
      });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password matches
        .mockResolvedValueOnce(false); // new password is different
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeOwnPassword('admin-1', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(result.code).toBe(200);
      expect(prisma.admin.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.changeOwnPassword('unknown', {
          currentPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if current password is wrong', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changeOwnPassword('admin-1', {
          currentPassword: 'wrong-password',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'admin-1',
        password: 'old-hashed-password',
      });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password matches
        .mockResolvedValueOnce(true); // new password same as old

      await expect(
        service.changeOwnPassword('admin-1', {
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeSubAdminPassword', () => {
    it('should change sub-admin password as superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
      });
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeSubAdminPassword(
        'superadmin-id',
        'superadmin',
        'target-admin',
        { newPassword: 'NewPassword123!' },
      );

      expect(result.code).toBe(200);
    });

    it('should change sub-admin password as creator', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'admin-1',
      });
      prisma.admin.update.mockResolvedValue({});

      const result = await service.changeSubAdminPassword(
        'admin-1',
        'admin',
        'target-admin',
        { newPassword: 'NewPassword123!' },
      );

      expect(result.code).toBe(200);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.changeSubAdminPassword('admin-1', 'admin', 'unknown', {
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not creator and not superadmin', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: 'other-admin',
      });

      await expect(
        service.changeSubAdminPassword('admin-1', 'admin', 'target-admin', {
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for admin without createdBy', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 'target-admin',
        role: 'admin',
        createdBy: null,
      });

      await expect(
        service.changeSubAdminPassword(
          'superadmin-id',
          'superadmin',
          'target-admin',
          { newPassword: 'NewPassword123!' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
