import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UserProfileService } from '@/user-profile/user-profile.service';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  admin: {
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockHttpService = {
  get: jest.fn(),
};

const mockUserProfileService = {
  createUser: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;
  let configService: typeof mockConfigService;
  let httpService: typeof mockHttpService;
  let userProfileService: typeof mockUserProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: UserProfileService, useValue: mockUserProfileService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = mockPrismaService;
    jwtService = mockJwtService;
    configService = mockConfigService;
    httpService = mockHttpService;
    userProfileService = mockUserProfileService;

    // Default config values
    configService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const configs: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_EXPIRATION_TIME: '3600',
          JWT_REFRESH_EXPIRATION_TIME: '604800',
          ENABLE_MOCK_AUTH: 'false',
          WECHAT_APPID: 'test-appid',
          WECHAT_SECRET: 'test-secret',
        };
        return configs[key] ?? defaultValue;
      },
    );

    jwtService.signAsync.mockResolvedValue('mock-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('wechatLogin', () => {
    it('should login with baseline_user_code when mock auth is enabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'true';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        return null;
      });

      const mockUser = { id: 'user-1', openId: 'baseline_user_openid' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.wechatLogin(
        'baseline_user_code_placeholder',
      );

      expect(result.code).toBe(200);
      expect(result.data.user).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { openId: 'baseline_user_openid' },
      });
    });

    it('should login with secondary_user_code when mock auth is enabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'true';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        return null;
      });

      const mockUser = { id: 'user-2', openId: 'secondary_user_openid' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.wechatLogin(
        'secondary_user_code_placeholder',
      );

      expect(result.code).toBe(200);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { openId: 'secondary_user_openid' },
      });
    });

    it('should login with mock_ prefix code when mock auth is enabled', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'true';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        return null;
      });

      prisma.user.findUnique.mockResolvedValue(null);
      const mockNewUser = {
        id: 'new-user',
        openId: 'mock_openid_for_mock_test',
      };
      userProfileService.createUser.mockResolvedValue(mockNewUser);

      const result = await service.wechatLogin('mock_test');

      expect(result.code).toBe(200);
      expect(userProfileService.createUser).toHaveBeenCalledWith(
        'mock_openid_for_mock_test',
      );
    });

    it('should create new user if not found', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'true';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        return null;
      });

      prisma.user.findUnique.mockResolvedValue(null);
      const mockNewUser = { id: 'new-user', openId: 'baseline_user_openid' };
      userProfileService.createUser.mockResolvedValue(mockNewUser);

      const result = await service.wechatLogin(
        'baseline_user_code_placeholder',
      );

      expect(result.code).toBe(200);
      expect(userProfileService.createUser).toHaveBeenCalledWith(
        'baseline_user_openid',
      );
    });

    it('should call wechat API for real code', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'false';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        if (key === 'WECHAT_APPID') return 'test-appid';
        if (key === 'WECHAT_SECRET') return 'test-secret';
        return null;
      });

      httpService.get.mockReturnValue(
        of({ data: { openid: 'real-openid', session_key: 'key' } }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        openId: 'real-openid',
      });

      const result = await service.wechatLogin('real-code');

      expect(result.code).toBe(200);
      expect(httpService.get).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if wechat returns error', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'false';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        if (key === 'WECHAT_APPID') return 'test-appid';
        if (key === 'WECHAT_SECRET') return 'test-secret';
        return null;
      });

      httpService.get.mockReturnValue(
        of({ data: { errcode: 40029, errmsg: 'invalid code' } }),
      );

      await expect(service.wechatLogin('invalid-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException if wechat config is missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'false';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        if (key === 'WECHAT_APPID') return undefined;
        if (key === 'WECHAT_SECRET') return undefined;
        return null;
      });

      await expect(service.wechatLogin('some-code')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException if wechat API fails', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'false';
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        if (key === 'WECHAT_APPID') return 'test-appid';
        if (key === 'WECHAT_SECRET') return 'test-secret';
        return null;
      });

      httpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.wechatLogin('some-code')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('adminLogin', () => {
    it('should login admin successfully', async () => {
      const mockAdmin = {
        id: 'admin-1',
        username: 'admin',
        password: 'hashed-password',
        role: 'admin',
        permissions: [{ permission: 'read' }],
        canteen: { name: 'Test Canteen' },
      };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.adminLogin('admin', 'password');

      expect(result.code).toBe(200);
      expect(result.data.admin.username).toBe('admin');
      expect(result.data.permissions).toEqual(['read']);
      expect(result.data.admin.canteenName).toBe('Test Canteen');
    });

    it('should return all permissions for superadmin', async () => {
      const mockAdmin = {
        id: 'admin-1',
        username: 'superadmin',
        password: 'hashed-password',
        role: 'superadmin',
        permissions: [],
        canteen: null,
      };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.adminLogin('superadmin', 'password');

      expect(result.code).toBe(200);
      expect(result.data.permissions.length).toBeGreaterThan(0);
      expect(result.data.admin.canteenName).toBe(null);
    });

    it('should throw UnauthorizedException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(service.adminLogin('unknown', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const mockAdmin = {
        id: 'admin-1',
        username: 'admin',
        password: 'hashed-password',
        role: 'admin',
        permissions: [],
        canteen: null,
      };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.adminLogin('admin', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token for user', async () => {
      const mockUser = { id: 'user-1', openId: 'test-openid' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refreshToken('user-1', 'user');

      expect(result.code).toBe(200);
      expect(result.data.token.accessToken).toBe('mock-token');
      expect(result.data.user).toEqual(mockUser);
    });

    it('should refresh token for admin', async () => {
      const mockAdmin = {
        id: 'admin-1',
        username: 'admin',
        password: 'hashed-password',
      };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);

      const result = await service.refreshToken('admin-1', 'admin');

      expect(result.code).toBe(200);
      expect(result.data.token.accessToken).toBe('mock-token');
      // Password should be removed
      expect(result.data.user).not.toHaveProperty('password');
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      const mockUser = { id: 'user-1', openId: 'test-openid' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('unknown');

      expect(result).toBeNull();
    });
  });

  describe('validateAdmin', () => {
    it('should return admin if found', async () => {
      const mockAdmin = { id: 'admin-1', username: 'admin' };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);

      const result = await service.validateAdmin('admin-1');

      expect(result).toEqual(mockAdmin);
    });

    it('should return null if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      const result = await service.validateAdmin('unknown');

      expect(result).toBeNull();
    });
  });

  describe('_generateTokens', () => {
    it('should throw InternalServerErrorException if JWT secrets are missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'ENABLE_MOCK_AUTH') return 'true';
        if (key === 'JWT_SECRET') return undefined;
        if (key === 'JWT_REFRESH_SECRET') return undefined;
        if (key === 'JWT_EXPIRATION_TIME') return '3600';
        if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '604800';
        return null;
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        openId: 'baseline_user_openid',
      });

      await expect(
        service.wechatLogin('baseline_user_code_placeholder'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
