import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AdminOperationLogInterceptor } from './admin-operation-log.interceptor';

describe('AdminOperationLogInterceptor', () => {
  const prisma = {
    operationLog: { create: jest.fn() },
  } as any;
  const interceptor = new AdminOperationLogInterceptor(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.operationLog.create.mockResolvedValue({});
  });

  function createContext(
    requestOverrides: Record<string, unknown> = {},
    handlerName = 'updateDish',
    controllerName = 'AdminDishesController',
  ): ExecutionContext {
    const request = {
      method: 'PATCH',
      path: '/admin/dishes/dish-1/status',
      params: { id: 'dish-1' },
      admin: { id: 'admin-1' },
      body: { password: 'must-never-be-logged', token: 'secret-token' },
      ...requestOverrides,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({ name: handlerName }),
      getClass: () => ({ name: controllerName }),
    } as unknown as ExecutionContext;
  }

  it('records a successful authenticated admin mutation without its body', async () => {
    const context = createContext();
    const next = {
      handle: () => of({ code: 200, data: { id: 'response-id' } }),
    };

    await lastValueFrom(interceptor.intercept(context, next));
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: {
        adminId: 'admin-1',
        action: 'update',
        targetType: 'AdminDishesController',
        targetId: 'dish-1',
        details: {
          method: 'PATCH',
          path: '/admin/dishes/dish-1/status',
        },
        result: 'success',
      },
    });
    const serialized = JSON.stringify(
      prisma.operationLog.create.mock.calls[0][0],
    );
    expect(serialized).not.toContain('must-never-be-logged');
    expect(serialized).not.toContain('secret-token');
  });

  it('normalizes approval handler names for exact UI filtering', async () => {
    await lastValueFrom(
      interceptor.intercept(
        createContext({}, 'approveUpload', 'AdminUploadsController'),
        { handle: () => of({ code: 200 }) },
      ),
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'approve' }),
      }),
    );
  });

  it.each([
    ['publishNews', 'update'],
    ['revokeUpload', 'update'],
    ['handleReport', 'update'],
    ['enableExperiment', 'update'],
    ['disableExperiment', 'update'],
    ['completeExperiment', 'update'],
    ['refreshDishEmbedding', 'update'],
    ['changeOwnPassword', 'update'],
    ['updatePermissions', 'update'],
    ['confirmBatchImport', 'create'],
  ])('normalizes %s to %s', async (handlerName, expectedAction) => {
    await lastValueFrom(
      interceptor.intercept(createContext({}, handlerName), {
        handle: () => of({ code: 200 }),
      }),
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: expectedAction }),
      }),
    );
  });

  it('records failures but preserves the original business error', async () => {
    const originalError = new Error('business failed');
    const next: CallHandler = {
      handle: () => throwError(() => originalError),
    };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toBe(originalError);
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ result: 'failure' }),
      }),
    );
  });

  it('does not change a success result when log persistence fails', async () => {
    prisma.operationLog.create.mockRejectedValue(new Error('log unavailable'));
    const response = { code: 200, data: { id: 'response-id' } };

    await expect(
      lastValueFrom(
        interceptor.intercept(createContext({ params: {} }), {
          handle: () => of(response),
        }),
      ),
    ).resolves.toBe(response);
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetId: 'response-id' }),
      }),
    );
  });

  it.each([
    [{ method: 'GET' }, 'read request'],
    [{ path: '/dishes/dish-1' }, 'non-admin path'],
    [{ admin: undefined }, 'request without an authenticated admin'],
  ])('does not log a %s', async (requestOverrides, _description) => {
    await lastValueFrom(
      interceptor.intercept(createContext(requestOverrides), {
        handle: () => of({ code: 200 }),
      }),
    );

    expect(prisma.operationLog.create).not.toHaveBeenCalled();
  });
});
