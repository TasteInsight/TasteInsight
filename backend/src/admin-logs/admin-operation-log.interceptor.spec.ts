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

  it.each([
    ['success', '/admin/dishes/batch-delete'],
    ['failure', '/admin/dishes/batch-delete'],
    ['success', '/admin/dishes/batch-delete/'],
    ['failure', '/admin/dishes/batch-delete/'],
  ] as const)('records batch targets for %s at %s', async (result, path) => {
    const ids = ['dish-a', 'dish-b'];
    const originalError = new Error('target is outside the admin scope');
    const completion = lastValueFrom(
      interceptor.intercept(
        createContext(
          { method: 'POST', path, params: {}, body: { ids, token: 'private' } },
          'batchDeleteDishes',
        ),
        {
          handle: () =>
            result === 'success'
              ? of({ code: 200 })
              : throwError(() => originalError),
        },
      ),
    );
    if (result === 'failure') {
      await expect(completion).rejects.toBe(originalError);
    } else {
      await expect(completion).resolves.toEqual({ code: 200 });
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'delete',
        targetId: '-',
        result,
        details: { method: 'POST', path, ids },
      }),
    });
    expect(JSON.stringify(prisma.operationLog.create.mock.calls)).not.toContain(
      'private',
    );
  });

  it.each([
    undefined,
    'not-an-array',
    [],
    [''],
    [42],
    [{ password: 'private' }],
    Array.from({ length: 101 }, (_, index) => `dish-${index}`),
    ['x'.repeat(129)],
  ])('omits malformed or unbounded batch targets: %p', async (ids) => {
    await expect(
      lastValueFrom(
        interceptor.intercept(
          createContext({
            method: 'POST',
            path: '/admin/dishes/batch-delete',
            body: { ids },
          }),
          { handle: () => throwError(() => new Error('invalid request')) },
        ),
      ),
    ).rejects.toThrow('invalid request');
    await new Promise((resolve) => setImmediate(resolve));
    expect(
      prisma.operationLog.create.mock.calls[0][0].data.details,
    ).not.toHaveProperty('ids');
  });

  it('keeps the complete batch at the supported audit bounds', async () => {
    const ids = Array.from({ length: 100 }, (_, index) =>
      `${index}`.padEnd(128, 'x'),
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(
          createContext({
            method: 'POST',
            path: '/admin/news/batch-delete',
            body: { ids },
          }),
          { handle: () => throwError(() => new Error('not found')) },
        ),
      ),
    ).rejects.toThrow('not found');
    await new Promise((resolve) => setImmediate(resolve));
    expect(
      prisma.operationLog.create.mock.calls[0][0].data.details.ids,
    ).toEqual(ids);
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
