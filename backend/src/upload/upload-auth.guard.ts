import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { Reflector } from '@nestjs/core';
import {
  AUTH_REALM_KEY,
  AuthRealm,
} from '@/auth/decorators/auth-realm.decorator';

@Injectable()
export class UploadAuthGuard implements CanActivate {
  constructor(
    private readonly userGuard: AuthGuard,
    private readonly adminGuard: AdminAuthGuard,
    private readonly reflector: Reflector = new Reflector(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const realm = this.reflector.getAllAndOverride<AuthRealm>(AUTH_REALM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (realm === 'user') return this.userGuard.canActivate(context);
    if (realm === 'admin') return this.adminGuard.canActivate(context);

    try {
      return await this.userGuard.canActivate(context);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      return this.adminGuard.canActivate(context);
    }
  }
}
