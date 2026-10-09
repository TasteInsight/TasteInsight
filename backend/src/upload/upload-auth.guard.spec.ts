import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { UploadAuthGuard } from './upload-auth.guard';

describe('UploadAuthGuard', () => {
  const config = { get: () => 'access-secret' };
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { admin: { findUnique: jest.fn() } };
  const request = { headers: { authorization: 'Bearer proof' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new UploadAuthGuard(
    new AuthGuard(jwt as any, config as any),
    new AdminAuthGuard(jwt as any, config as any, prisma as any),
  );

  beforeEach(() => jest.clearAllMocks());

  it.each(['user', 'admin'])(
    'accepts an active %s access token',
    async (type) => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'account',
        type,
        tokenUse: 'access',
      });
      prisma.admin.findUnique.mockResolvedValue({
        id: 'account',
        permissions: [],
        canteenId: null,
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    },
  );

  it.each(['user', 'admin'])('rejects %s refresh tokens', async (type) => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'account',
      type,
      tokenUse: 'refresh',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a retired administrator access token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'retired',
      type: 'admin',
      tokenUse: 'access',
    });
    prisma.admin.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'retired', deletedAt: null } }),
    );
  });
});
