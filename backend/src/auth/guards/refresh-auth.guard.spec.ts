import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshAuthGuard } from './refresh-auth.guard';

describe('RefreshAuthGuard', () => {
  const request: { headers: { authorization: string }; user?: unknown } = {
    headers: { authorization: 'Bearer token' },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
  const configService = {
    get: jest.fn().mockReturnValue('refresh-secret'),
  } as unknown as ConfigService;
  const guard = new RefreshAuthGuard(jwtService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
    delete request.user;
  });

  it('verifies and accepts a refresh token payload', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'user',
      tokenUse: 'refresh',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token', {
      secret: 'refresh-secret',
    });
  });

  it('rejects an access token payload', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'user',
      tokenUse: 'access',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
