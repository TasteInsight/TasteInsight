import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { AUTH_REALM_KEY, AuthRealm } from '../decorators/auth-realm.decorator';

@Injectable()
export class RefreshAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector = new Reflector(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const realm = this.reflector.getAllAndOverride<AuthRealm>(
        AUTH_REALM_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        payload.tokenUse !== 'refresh' ||
        !['user', 'admin'].includes(payload.type) ||
        (realm !== undefined && realm !== 'combined' && payload.type !== realm)
      ) {
        throw new UnauthorizedException();
      }

      request['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
