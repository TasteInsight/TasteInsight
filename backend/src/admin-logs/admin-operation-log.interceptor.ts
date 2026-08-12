import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '@/prisma.service';

interface AuthenticatedAdminRequest {
  method: string;
  path: string;
  params?: { id?: string };
  admin?: { id?: string };
}

@Injectable()
export class AdminOperationLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminOperationLogInterceptor.name);
  private readonly readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedAdminRequest>();

    if (!this.shouldAudit(request)) {
      return next.handle();
    }

    const baseLog = {
      adminId: request.admin!.id!,
      action: this.normalizeAction(context.getHandler().name, request.method),
      targetType: context.getClass().name,
      details: {
        method: request.method,
        path: request.path,
      },
    };

    return next.handle().pipe(
      tap({
        next: (response) => {
          const responseId = this.getResponseId(response);
          void this.persistLog({
            ...baseLog,
            targetId: request.params?.id || responseId || '-',
            result: 'success',
          });
        },
        error: () => {
          void this.persistLog({
            ...baseLog,
            targetId: request.params?.id || '-',
            result: 'failure',
          });
        },
      }),
    );
  }

  private shouldAudit(request: AuthenticatedAdminRequest): boolean {
    return (
      request.path.startsWith('/admin') &&
      !this.readMethods.has(request.method.toUpperCase()) &&
      typeof request.admin?.id === 'string' &&
      request.admin.id.length > 0
    );
  }

  private getResponseId(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const data = (response as { data?: unknown }).data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const id = (data as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }

  private normalizeAction(handlerName: string, method: string): string {
    const normalizedHandler = handlerName.toLowerCase();
    if (normalizedHandler.includes('confirmbatchimport')) {
      return 'create';
    }

    for (const action of ['approve', 'reject', 'delete', 'create', 'update']) {
      if (normalizedHandler.includes(action)) {
        return action;
      }
    }

    const updateKeywords = [
      'publish',
      'revoke',
      'handle',
      'enable',
      'disable',
      'complete',
      'refresh',
      'password',
      'permissions',
    ];
    if (updateKeywords.some((keyword) => normalizedHandler.includes(keyword))) {
      return 'update';
    }

    const methodActions: Record<string, string> = {
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return methodActions[method.toUpperCase()] || handlerName;
  }

  private async persistLog(data: {
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    details: { method: string; path: string };
    result: 'success' | 'failure';
  }): Promise<void> {
    try {
      await this.prisma.operationLog.create({ data });
    } catch (error) {
      this.logger.warn(
        `Failed to persist admin operation log: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
