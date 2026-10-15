import { Test, TestingModule } from '@nestjs/testing';
import { CampusOAuthService } from '@/campus-identity/campus-oauth.service';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserIdentityService } from './user-identity.service';
import { VerificationChallengeService } from './verification-challenge.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
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

const mockIdentities = { wechat: jest.fn(), phone: jest.fn() };
const mockCampusOAuth = { startLogin: jest.fn(), login: jest.fn() };
const mockChallenges = { consume: jest.fn() };

const mockUserProfileService = {
  getUserProfile: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;
  let configService: typeof mockConfigService;
  let userProfileService: typeof mockUserProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CampusOAuthService, useValue: mockCampusOAuth },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserIdentityService, useValue: mockIdentities },
        { provide: VerificationChallengeService, useValue: mockChallenges },
        { provide: UserProfileService, useValue: mockUserProfileService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = mockPrismaService;
    jwtService = mockJwtService;
    configService = mockConfigService;
    userProfileService = mockUserProfileService;

    // Default config values
    configService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const configs: Record<string, string> = {
          NODE_ENV: 'test',
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
    mockIdentities.wechat.mockImplementation(() =>
      prisma.user.findUnique({ where: { id: 'user-1' } }),
    );
    mockUserProfileService.getUserProfile.mockImplementation(async (id) => ({
      data: await prisma.user.findUnique({ where: { id } }),
    }));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('user login', () => {
    it('signs tokens for the resolved identity and returns the profile projection', async () => {
      const user = { id: 'user-1', openId: null };
      const profile = {
        id: 'user-1',
        nickname: 'User',
        capabilities: { canContribute: false },
      };
      mockIdentities.wechat.mockResolvedValue(user);
      userProfileService.getUserProfile.mockResolvedValueOnce({
        data: profile,
      });
      const result = await service.wechatLogin('provider-code', 'app');
      expect(mockIdentities.wechat).toHaveBeenCalledWith(
        'provider-code',
        'app',
      );
      expect(result.data.user).toEqual(profile);
      expect(result.data.token.accessToken).toBe('mock-token');
    });

    it('does not issue a token for rejected identity proofs', async () => {
      mockIdentities.wechat.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.wechatLogin('bad-code')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('consumes a phone-login challenge before resolving the phone identity', async () => {
      mockChallenges.consume.mockResolvedValueOnce('+8613812345678');
      mockIdentities.phone.mockResolvedValueOnce({
        id: 'user-1',
        openId: null,
      });
      userProfileService.getUserProfile.mockResolvedValueOnce({
        data: { id: 'user-1' },
      });
      await service.phoneLogin('challenge', '123456');
      expect(mockChallenges.consume).toHaveBeenCalledWith(
        'PHONE_LOGIN',
        'challenge',
        '123456',
      );
      expect(mockIdentities.phone).toHaveBeenCalledWith('+8613812345678');
    });

    it('never resolves identities or signs tokens after an invalid OTP', async () => {
      mockChallenges.consume.mockRejectedValueOnce(new UnauthorizedException());
      await expect(
        service.phoneLogin('challenge', '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockIdentities.phone).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('adminLogin', () => {
    it('excludes retired administrators from login', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);
      await expect(service.adminLogin('retired', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.admin.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: 'retired', deletedAt: null },
        }),
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
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
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password',
        'hashed-password',
      );
      expect(result.data.admin).not.toHaveProperty('password');
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
      };
      prisma.admin.findUnique.mockResolvedValue(mockAdmin);

      const result = await service.refreshToken('admin-1', 'admin');

      expect(result.code).toBe(200);
      expect(result.data.token.accessToken).toBe('mock-token');
      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-1', deletedAt: null },
        omit: { password: true },
      });
      expect(result.data.user).not.toHaveProperty('password');
    });

    it('should not issue tokens when the account no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshToken('deleted-user', 'user'),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
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
    it('excludes retired accounts when refreshing administrator tokens', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);
      await expect(
        service.refreshToken('retired-admin', 'admin'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.admin.findUnique).toHaveBeenCalledWith({
        where: { id: 'retired-admin', deletedAt: null },
        omit: { password: true },
      });
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
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
    it('should preserve duration units and mark access and refresh token usage', async () => {
      const realJwtService = new JwtService();
      jwtService.signAsync.mockImplementation((payload, options) =>
        realJwtService.signAsync(payload, options),
      );
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          const configs: Record<string, string> = {
            JWT_SECRET: 'test-secret',
            JWT_REFRESH_SECRET: 'test-refresh-secret',
            JWT_EXPIRATION_TIME: '1h',
            NODE_ENV: 'test',
            JWT_REFRESH_EXPIRATION_TIME: '7d',
            ENABLE_MOCK_AUTH: 'true',
          };
          return configs[key] ?? defaultValue;
        },
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        openId: 'baseline_user_openid',
      });

      const result = await service.wechatLogin(
        'baseline_user_code_placeholder',
      );

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-1', type: 'user', tokenUse: 'access' },
        { secret: 'test-secret', expiresIn: '1h' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-1', type: 'user', tokenUse: 'refresh' },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
      const refreshPayload = realJwtService.decode<{
        iat: number;
        exp: number;
      }>(result.data.token.refreshToken);
      expect(refreshPayload.exp - refreshPayload.iat).toBe(7 * 24 * 60 * 60);
    });

    it('should throw InternalServerErrorException if JWT secrets are missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
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

    it('should reject an invalid JWT expiration configuration', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'NODE_ENV') return 'test';
          if (key === 'ENABLE_MOCK_AUTH') return 'true';
          if (key === 'JWT_SECRET') return 'test-secret';
          if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
          if (key === 'JWT_EXPIRATION_TIME') return 'forever';
          if (key === 'JWT_REFRESH_EXPIRATION_TIME') return '7d';
          return defaultValue;
        },
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        openId: 'baseline_user_openid',
      });

      await expect(
        service.wechatLogin('baseline_user_code_placeholder'),
      ).rejects.toThrow(InternalServerErrorException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
