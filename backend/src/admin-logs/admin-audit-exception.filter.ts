import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { PrismaService } from '@/prisma.service';

@Catch(HttpException)
export class AdminAuditExceptionFilter
  implements ExceptionFilter<HttpException>
{
  private readonly logger = new Logger(AdminAuditExceptionFilter.name);
  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly prisma: PrismaService,
  ) {}

  async catch(exception: HttpException, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest();
    if (
      exception.getStatus() === 403 &&
      req.admin?.id &&
      !req.operationLogAttempted &&
      req.path.startsWith('/admin')
    ) {
      req.operationLogAttempted = true;
      await this.prisma.operationLog
        .create({
          data: {
            adminId: req.admin.id,
            action: 'access_denied',
            targetType: 'authorization',
            targetId: req.params?.id || req.params?.userId || '-',
            result: 'failure',
            details: { method: req.method, path: req.path },
          },
        })
        .catch((error) =>
          this.logger.warn(
            `Failed to persist authorization audit: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }
    new BaseExceptionFilter(this.adapter.httpAdapter).catch(exception, host);
  }
}
