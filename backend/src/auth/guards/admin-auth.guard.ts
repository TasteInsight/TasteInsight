import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma.service';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 检查是否为管理员类型的token
      if (payload.type !== 'admin') {
        throw new ForbiddenException('权限不足');
      }

      // 验证管理员是否存在
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        include: {
          permissions: true,
        },
      });

      if (!admin) {
        throw new UnauthorizedException('管理员不存在');
      }

      // 将管理员信息附加到请求对象
      request['admin'] = {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        canteenId: admin.canteenId,
        permissions: admin.permissions.map((p) => p.permission),
      };
    } catch (error) {
      const errorName = (error as Error)?.name ?? 'UnknownError';

      // 如果是我们主动抛出的异常，直接传递
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      const isExpectedJwtError = [
        'JsonWebTokenError',
        'TokenExpiredError',
      ].includes(errorName);

      if (!isExpectedJwtError) {
        this.logger.error(
          `JWT verification failed: ${errorName}`,
          (error as Error)?.stack,
        );
      }

      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
