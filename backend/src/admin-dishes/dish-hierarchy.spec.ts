import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminDishesService } from './admin-dishes.service';
import { AdminUpdateDishDto } from './dto/admin-dish.dto';
import { validate } from 'class-validator';
import { BatchDishStatus } from './dto/admin-dish-batch.dto';

describe('Formal dish hierarchy updates', () => {
  const admin = {
    id: 'admin',
    username: 'admin',
    role: 'superadmin',
    canteenId: null,
    permissions: [],
  };

  const fixture = () => {
    const dishes = new Map<string, any>([
      ['dish', { id: 'dish', canteenId: 'a', parentDishId: null }],
      ['parent', { id: 'parent', canteenId: 'a', parentDishId: null }],
      ['other', { id: 'other', canteenId: 'b', parentDishId: null }],
    ]);
    const uploads = new Map<string, any>();
    const windows = new Map(
      ['a', 'b'].map((canteenId) => [
        `window-${canteenId}`,
        {
          id: `window-${canteenId}`,
          name: `window-${canteenId}`,
          canteenId,
          canteen: { id: canteenId, name: canteenId },
          floor: null,
        },
      ]),
    );
    const matches = (row: any, where: any): boolean =>
      Object.entries(where).every(([key, value]: [string, any]) => {
        if (key === 'OR') return value.some((part: any) => matches(row, part));
        if (key === 'parentUpload') {
          const parent = uploads.get(row.parentUploadId);
          return Boolean(parent && matches(parent, value));
        }
        if (value && typeof value === 'object' && 'not' in value)
          return row[key] !== value.not;
        return row[key] === value;
      });
    const readDish = (id: string) => {
      const dish = dishes.get(id);
      return dish ? { ...dish } : null;
    };
    const prisma: any = {
      dish: {
        findUnique: jest.fn(async ({ where }) => readDish(where.id)),
        findFirst: jest.fn(async ({ where }) => {
          const dish = [...dishes.values()].find((row) => matches(row, where));
          return dish ? { ...dish } : null;
        }),
        update: jest.fn(async ({ where, data }) => {
          Object.assign(dishes.get(where.id), data);
          return readDish(where.id);
        }),
      },
      dishUpload: {
        findUnique: jest.fn(async ({ where }) => uploads.get(where.id)),
        create: jest.fn(async ({ data }) => ({ ...data, id: 'new-upload' })),
        findFirst: jest.fn(async ({ where }) => {
          const upload = [...uploads.values()].find((row) =>
            matches(row, where),
          );
          return upload ? { ...upload } : null;
        }),
      },
      window: {
        findUnique: jest.fn(async ({ where }) => windows.get(where.id)),
      },
      $queryRaw: jest.fn(async () => []),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    return {
      dishes,
      uploads,
      prisma,
      service: new AdminDishesService(prisma),
    };
  };

  it('rejects a canteen-scoped editor linking a parent outside their scope', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.updateAdminDish(
        'dish',
        { parentDishId: 'other' },
        { ...admin, role: 'admin', canteenId: 'a' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('rejects cross-canteen parents even for a global administrator', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.updateAdminDish('dish', { parentDishId: 'other' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('rejects self-parenting', async () => {
    const { service } = fixture();
    await expect(
      service.updateAdminDish('dish', { parentDishId: 'dish' }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a descendant as parent without imposing a depth limit', async () => {
    const { service, dishes } = fixture();
    let ancestor = 'dish';
    for (let depth = 0; depth < 20; depth++) {
      const id = `descendant-${depth}`;
      dishes.set(id, { id, canteenId: 'a', parentDishId: ancestor });
      ancestor = id;
    }
    await expect(
      service.updateAdminDish('dish', { parentDishId: ancestor }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a deep valid same-canteen ancestor chain', async () => {
    const { service, dishes } = fixture();
    let parentId = 'parent';
    for (let depth = 0; depth < 20; depth++) {
      const id = `ancestor-${depth}`;
      dishes.get(parentId).parentDishId = id;
      dishes.set(id, { id, canteenId: 'a', parentDishId: null });
      parentId = id;
    }
    await service.updateAdminDish('dish', { parentDishId: 'parent' }, admin);
    expect(dishes.get('dish').parentDishId).toBe('parent');
  });

  it('preserves an existing parent on an unrelated edit', async () => {
    const { service, dishes } = fixture();
    dishes.get('dish').parentDishId = 'parent';
    await service.updateAdminDish('dish', { name: 'Updated' }, admin);
    expect(dishes.get('dish')).toMatchObject({
      name: 'Updated',
      parentDishId: 'parent',
    });
  });

  it('accepts null in the update contract for explicitly detaching a parent', async () => {
    const dto = Object.assign(new AdminUpdateDishDto(), { parentDishId: null });
    expect(await validate(dto)).toEqual([]);
    const { service, dishes } = fixture();
    dishes.get('dish').parentDishId = 'parent';
    await service.updateAdminDish('dish', dto, admin);
    expect(dishes.get('dish').parentDishId).toBeNull();
  });

  it('rejects moving a child away from its retained parent', async () => {
    const { service, dishes } = fixture();
    dishes.get('dish').parentDishId = 'parent';
    await expect(
      service.updateAdminDish('dish', { windowId: 'window-b' }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a child to detach and move in the same update', async () => {
    const { service, dishes } = fixture();
    dishes.get('dish').parentDishId = 'parent';
    await service.updateAdminDish(
      'dish',
      { parentDishId: null, windowId: 'window-b' },
      admin,
    );
    expect(dishes.get('dish')).toMatchObject({
      parentDishId: null,
      canteenId: 'b',
    });
  });

  it('allows moving and reparenting to the destination canteen together', async () => {
    const { service, dishes } = fixture();
    await service.updateAdminDish(
      'dish',
      { parentDishId: 'other', windowId: 'window-b' },
      admin,
    );
    expect(dishes.get('dish')).toMatchObject({
      parentDishId: 'other',
      canteenId: 'b',
    });
  });

  it('rejects moving a parent away from its formal child', async () => {
    const { service, dishes } = fixture();
    dishes.get('dish').parentDishId = 'parent';
    await expect(
      service.updateAdminDish('parent', { windowId: 'window-b' }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(['pending', 'rejected', 'approved'])(
    'rejects moving a parent away from a %s child upload referencing its dish',
    async (status) => {
      const { service, uploads } = fixture();
      uploads.set('child', {
        id: 'child',
        status,
        canteenId: 'a',
        parentDishId: 'parent',
      });
      await expect(
        service.updateAdminDish('parent', { windowId: 'window-b' }, admin),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects moving an approved parent away from children linked through its upload', async () => {
    const { service, uploads } = fixture();
    uploads.set('source', { id: 'source', approvedDishId: 'parent' });
    uploads.set('child', {
      id: 'child',
      canteenId: 'a',
      parentUploadId: 'source',
    });
    await expect(
      service.updateAdminDish('parent', { windowId: 'window-b' }, admin),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechecks parent canteen after acquiring its row lock', async () => {
    const { service, dishes, prisma } = fixture();
    prisma.$queryRaw.mockImplementation(async (_query: unknown, id: string) => {
      if (id === 'parent') dishes.get('parent').canteenId = 'b';
      return [];
    });
    await expect(
      service.updateAdminDish('dish', { parentDishId: 'parent' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('rechecks the edited dish scope after acquiring its row lock', async () => {
    const { service, dishes, prisma } = fixture();
    prisma.$queryRaw.mockImplementation(async () => {
      dishes.get('dish').canteenId = 'b';
      return [];
    });
    await expect(
      service.updateAdminDish(
        'dish',
        { name: 'Updated' },
        { ...admin, role: 'admin', canteenId: 'a' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40P01' } }])(
    'surfaces a conflicting hierarchy transaction as a retryable conflict',
    async (error) => {
      const { service, prisma } = fixture();
      prisma.$transaction.mockRejectedValue(error);
      await expect(
        service.updateAdminDish('dish', { parentDishId: 'parent' }, admin),
      ).rejects.toThrow(ConflictException);
      expect(prisma.dish.update).not.toHaveBeenCalled();
    },
  );

  it('rejects an absent parent before attempting an update', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.updateAdminDish('dish', { parentDishId: 'missing' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('rejects an empty parent ID while keeping null as the detach contract', async () => {
    const dto = Object.assign(new AdminUpdateDishDto(), { parentDishId: '' });
    expect(await validate(dto)).toEqual([
      expect.objectContaining({ property: 'parentDishId' }),
    ]);
  });

  it.each(['dish', 'upload'])(
    'rechecks a moved formal parent before creating a child linked by %s',
    async (source) => {
      const { service, dishes, uploads, prisma } = fixture();
      uploads.set('source', {
        id: 'source',
        canteenId: 'a',
        adminId: admin.id,
        approvedDishId: 'parent',
      });
      prisma.$queryRaw.mockImplementation(
        async (_query: unknown, id: string) => {
          if (id === 'parent') dishes.get('parent').canteenId = 'b';
          return [];
        },
      );
      await expect(
        service.createAdminDish(
          {
            name: 'child',
            price: 1,
            windowId: 'window-a',
            ...(source === 'dish'
              ? { parentDishId: 'parent' }
              : { parentUploadId: 'source' }),
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dishUpload.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a batch child if its parent moved after lookup but before the update lock', async () => {
    const { service, dishes, prisma } = fixture();
    Object.assign(dishes.get('parent'), {
      name: 'parent',
      windowId: 'window-a',
    });
    prisma.canteen = { findMany: async () => [{ id: 'a', name: 'a' }] };
    prisma.floor = { findMany: async () => [] };
    prisma.window.findMany = async () => [
      { id: 'window-a', canteenId: 'a', name: 'window-a', number: '1' },
    ];
    prisma.dish.create = jest.fn();
    prisma.dish.update.mockImplementation(async ({ where, data }) => {
      const row = dishes.get(where.id);
      row.canteenId = 'b';
      Object.assign(row, data);
      return { ...row };
    });
    const result = await service.confirmBatchImport(
      {
        dishes: [
          {
            name: 'parent',
            price: 1,
            canteenName: 'a',
            windowName: 'window-a',
            subDishNames: ['child'],
            status: BatchDishStatus.VALID,
          },
        ],
      },
      admin,
    );
    expect(result.data).toMatchObject({ successCount: 0, failCount: 1 });
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });
});
