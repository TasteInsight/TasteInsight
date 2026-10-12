import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma.service';
import { OptionalAuthGuard } from './optional-auth.guard';
import { StudentGuard } from './student.guard';
import { isCurrentStudent } from '../student-status';

describe('identity guards', () => {
  const request: {
    headers: { authorization?: string };
    user?: { sub: string; type: string };
  } = { headers: {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { studentVerification: { findUnique: jest.fn() } };
  const optional = new OptionalAuthGuard(
    jwt as unknown as JwtService,
    new ConfigService({ JWT_SECRET: 'secret' }),
  );
  const student = new StudentGuard(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    delete request.user;
  });

  it('allows an absent token and removes stale identity without verification', async () => {
    request.user = { sub: 'stale', type: 'user' };
    expect(await optional.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });
  it.each(['', 'Basic foo', 'Bearer expired'])(
    'rejects supplied invalid authorization %s instead of becoming anonymous',
    async (authorization) => {
      request.headers.authorization = authorization;
      jwt.verifyAsync.mockRejectedValue(new UnauthorizedException());
      await expect(optional.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );
  it('rejects refresh payloads on optional routes', async () => {
    request.headers.authorization = 'Bearer refresh';
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user',
      type: 'user',
      tokenUse: 'refresh',
    });
    await expect(optional.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('requires verified authentication before testing student eligibility', async () => {
    await expect(student.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.studentVerification.findUnique).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'REJECTED', 'REVOKED'])(
    'does not grant %s eligibility',
    async (status) => {
      request.user = { sub: 'user', type: 'user' };
      prisma.studentVerification.findUnique.mockResolvedValue({
        status,
        expiresAt: new Date(Date.now() + 60000),
      });
      await expect(student.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it('reads current eligibility on each request, including revocation', async () => {
    request.user = { sub: 'user', type: 'user' };
    prisma.studentVerification.findUnique
      .mockResolvedValueOnce({
        status: 'VERIFIED',
        expiresAt: new Date(Date.now() + 60000),
      })
      .mockResolvedValueOnce({ status: 'REVOKED', expiresAt: null });
    expect(await student.canActivate(context)).toBe(true);
    await expect(student.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.studentVerification.findUnique).toHaveBeenCalledTimes(2);
  });
  it('treats expiry as an authorization boundary without a scheduled job', () => {
    const now = new Date();
    expect(isCurrentStudent({ status: 'VERIFIED', expiresAt: now }, now)).toBe(
      false,
    );
    expect(isCurrentStudent({ status: 'VERIFIED', expiresAt: null }, now)).toBe(
      false,
    );
    expect(isCurrentStudent(null, now)).toBe(false);
  });
});
