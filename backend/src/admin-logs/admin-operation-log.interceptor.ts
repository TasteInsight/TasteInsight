import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap, catchError } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AUDIT_IN_TRANSACTION } from './admin-audit';
import { PrismaService } from '@/prisma.service';
import {
  BATCH_DELETE_MAX_IDS,
  BATCH_DELETE_MAX_ID_LENGTH,
} from '@/common/dto/batch-delete.dto';

interface AuthenticatedAdminRequest {
  method: string;
  path: string;
  params?: { id?: string };
  body?: { ids?: unknown };
  admin?: { id?: string };
  operationLogAttempted?: boolean;
}

@Injectable()
export class AdminOperationLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminOperationLogInterceptor.name);
  private readonly readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector = new Reflector(),
  ) {}

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
        ...this.getBatchTargets(request),
      },
    };

    return next.handle().pipe(
      mergeMap(async (response) => {
        if (
          this.reflector.getAllAndOverride(AUDIT_IN_TRANSACTION, [
            context.getHandler(),
            context.getClass(),
          ])
        )
          return response;
        request.operationLogAttempted = true;
        const responseId = this.getResponseId(response);
        await this.persistLog({
          ...baseLog,
          targetId: request.params?.id || responseId || '-',
          result:
            typeof (response as { code?: number })?.code === 'number' &&
            (response as { code: number }).code >= 400
              ? 'failure'
              : 'success',
        });
        return response;
      }),
      catchError(async (error) => {
        request.operationLogAttempted = true;
        await this.persistLog({
          ...baseLog,
          targetId: request.params?.id || '-',
          result: 'failure',
        });
        throw error;
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

  private getBatchTargets(request: AuthenticatedAdminRequest): {
    ids?: string[];
  } {
    const ids = request.body?.ids;
    // Interceptors run before DTO pipes, including for rejected request bodies.
    if (
      !/\/batch-delete\/?$/.test(request.path) ||
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > BATCH_DELETE_MAX_IDS ||
      !ids.every(
        (id): id is string =>
          typeof id === 'string' &&
          id.length > 0 &&
          id.length <= BATCH_DELETE_MAX_ID_LENGTH,
      )
    ) {
      return {};
    }
    return { ids: [...ids] };
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
    if (normalizedHandler.includes('publish')) return 'publish';
    if (normalizedHandler.includes('revoke')) return 'revoke';
    if (normalizedHandler.includes('permissions')) return 'permissions';
    if (normalizedHandler.includes('password')) return 'password';
    if (normalizedHandler.includes('disable')) return 'disable';
    if (normalizedHandler.includes('enable')) return 'enable';
    if (normalizedHandler.includes('complete')) return 'complete';
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
    details: { method: string; path: string; ids?: string[] };
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
