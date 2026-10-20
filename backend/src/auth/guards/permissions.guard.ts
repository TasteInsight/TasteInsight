import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { GLOBAL_ONLY_PERMISSIONS } from '../permissions.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin) {
      throw new ForbiddenException('权限不足');
    }

    // 检查是否拥有所需的任一权限
    const hasPermission = requiredPermissions.some(
      (permission) =>
        (admin.role === 'superadmin' ||
          admin.permissions.includes(permission)) &&
        (!GLOBAL_ONLY_PERMISSIONS.includes(permission) ||
          admin.scope === 'GLOBAL'),
    );

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
