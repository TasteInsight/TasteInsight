import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';

@Injectable()
export class UploadAuthGuard implements CanActivate {
  constructor(
    private readonly userGuard: AuthGuard,
    private readonly adminGuard: AdminAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.userGuard.canActivate(context);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      return this.adminGuard.canActivate(context);
    }
  }
}
