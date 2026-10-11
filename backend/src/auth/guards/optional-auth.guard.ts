import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.headers.authorization === undefined) {
      delete request.user;
      return true;
    }
    return super.canActivate(context);
  }
}
