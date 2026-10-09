import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const request: { headers: { authorization: string }; user?: unknown } = {
    headers: { authorization: 'Bearer token' },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
  const configService = {
    get: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;
  const guard = new AuthGuard(jwtService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
    delete request.user;
  });

  it('accepts an access token and attaches its payload', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'user',
      tokenUse: 'access',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: 'user-1',
      type: 'user',
      tokenUse: 'access',
    });
  });

  it('rejects a refresh token payload', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'user',
      tokenUse: 'refresh',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an admin access token on user routes', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'admin-1',
      type: 'admin',
      tokenUse: 'access',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
