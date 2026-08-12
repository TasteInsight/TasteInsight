import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';

describe('AdminAuthGuard', () => {
  const request: { headers: { authorization: string }; admin?: unknown } = {
    headers: { authorization: 'Bearer token' },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
  const configService = {
    get: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;
  const prisma = {
    admin: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const guard = new AdminAuthGuard(jwtService, configService, prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    delete request.admin;
  });

  it('rejects a non-access admin token payload', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'admin-1',
      type: 'admin',
      tokenUse: 'refresh',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });
});
