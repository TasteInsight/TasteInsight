import { AdminDishesService } from './admin-dishes.service';
import { BatchDishStatus } from './dto/admin-dish-batch.dto';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';

describe('Batch dish write permissions and review', () => {
  const creator: AdminInfo = {
    id: 'admin',
    username: 'creator',
    role: 'admin',
    canteenId: null,
    permissions: ['dish:create'],
  };
  const item = {
    name: 'new dish',
    price: 12,
    canteenName: 'canteen',
    windowName: 'window',
    status: BatchDishStatus.VALID,
  };

  function fixture() {
    const canteen = { id: 'canteen', name: 'canteen' };
    const window = {
      id: 'window',
      name: 'window',
      number: '1',
      canteenId: canteen.id,
      canteen,
      floor: null,
    };
    const dishes = new Map<string, any>();
    const uploads = new Map<string, any>();
    const prisma: any = {
      $queryRaw: jest.fn(async () => []),
      canteen: {
        findMany: jest.fn(async () => [canteen]),
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => canteen),
        create: jest.fn(async ({ data }) => ({ ...data, id: 'new-canteen' })),
      },
      floor: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ ...data, id: 'new-floor' })),
      },
      window: {
        findMany: jest.fn(async () => [window]),
        findUnique: jest.fn(async () => window),
        findFirst: jest.fn(async () => null),
        count: jest.fn(async () => 1),
        create: jest.fn(async ({ data }) => ({ ...data, id: 'new-window' })),
      },
      dish: {
        findFirst: jest.fn(
          async ({ where }) =>
            [...dishes.values()].find((dish) =>
              Object.entries(where).every(
                ([key, value]) => dish[key] === value,
              ),
            ) ?? null,
        ),
        findUnique: jest.fn(async ({ where }) => dishes.get(where.id) ?? null),
        update: jest.fn(async ({ where, data }) => {
          const dish = { ...dishes.get(where.id), ...data };
          dishes.set(where.id, dish);
          return dish;
        }),
        create: jest.fn(async ({ data }) => {
          const dish = { ...data, id: `dish-${dishes.size}` };
          dishes.set(dish.id, dish);
          return dish;
        }),
      },
      dishUpload: {
        findUnique: jest.fn(async ({ where }) => uploads.get(where.id) ?? null),
        update: jest.fn(async ({ where, data }) => {
          const upload = { ...uploads.get(where.id), ...data };
          uploads.set(where.id, upload);
          return upload;
        }),
        create: jest.fn(async ({ data }) => {
          const upload = { ...data, id: `upload-${uploads.size}` };
          uploads.set(upload.id, upload);
          return upload;
        }),
      },
    };
    prisma.$transaction = jest.fn(async (callback) => {
      const dishSnapshot = new Map(
        [...dishes].map(([id, row]) => [id, { ...row }]),
      );
      const uploadSnapshot = new Map(
        [...uploads].map(([id, row]) => [id, { ...row }]),
      );
      try {
        return await callback(prisma);
      } catch (error) {
        dishes.clear();
        uploads.clear();
        dishSnapshot.forEach((row, id) => dishes.set(id, row));
        uploadSnapshot.forEach((row, id) => uploads.set(id, row));
        throw error;
      }
    });
    const service = new AdminDishesService(prisma);
    const existing = () =>
      dishes.set('existing', {
        id: 'existing',
        name: item.name,
        price: 4,
        status: 'offline',
        canteenId: canteen.id,
        windowId: window.id,
        parentDishId: null,
      });
    return { prisma, service, dishes, uploads, existing };
  }

  it('submits new dishes to pending review without publishing even with approval permission', async () => {
    const { service, prisma, uploads } = fixture();
    const result = await service.confirmBatchImport(
      { dishes: [item] },
      {
        ...creator,
        permissions: ['dish:create', 'upload:approve'],
      },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect([...uploads.values()]).toEqual([
      expect.objectContaining({
        name: item.name,
        adminId: creator.id,
        status: 'pending',
      }),
    ]);
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });

  it('rejects a create-only overwrite of an existing formal dish', async () => {
    const { service, prisma, existing } = fixture();
    existing();
    const result = await service.confirmBatchImport(
      { dishes: [item] },
      creator,
    );
    expect(result.data).toMatchObject({
      successCount: 0,
      failCount: 1,
      errors: [{ index: 0, type: 'permission' }],
    });
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('allows an authorized update while preserving the existing publication state', async () => {
    const { service, dishes, existing } = fixture();
    existing();
    const result = await service.confirmBatchImport(
      { dishes: [item] },
      {
        ...creator,
        permissions: ['dish:create', 'dish:edit'],
      },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(dishes.get('existing')).toMatchObject({
      price: 12,
      status: 'offline',
    });
  });

  it('rechecks the formal dish scope after waiting for its write lock', async () => {
    const { service, prisma, dishes, existing } = fixture();
    existing();
    prisma.$queryRaw.mockImplementation(async () => {
      dishes.get('existing').canteenId = 'other-canteen';
      return [];
    });
    const result = await service.confirmBatchImport(
      { dishes: [item] },
      {
        ...creator,
        canteenId: 'canteen',
        permissions: ['dish:create', 'dish:edit'],
      },
    );
    expect(result.data).toMatchObject({
      successCount: 0,
      failCount: 1,
      errors: [{ type: 'permission' }],
    });
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('creates a pending parent and links pending children to that upload', async () => {
    const { service, prisma, uploads } = fixture();
    const result = await service.confirmBatchImport(
      { dishes: [{ ...item, subDishNames: ['child one', 'child two'] }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    const [parent, ...children] = [...uploads.values()];
    expect(parent).toMatchObject({ name: item.name, status: 'pending' });
    expect(children).toHaveLength(2);
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'child one',
          parentUploadId: parent.id,
          status: 'pending',
        }),
        expect.objectContaining({
          name: 'child two',
          parentUploadId: parent.id,
          status: 'pending',
        }),
      ]),
    );
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });

  it('uses an existing parent as a reference without requiring edit or changing its metadata', async () => {
    const { service, prisma, uploads, existing } = fixture();
    existing();
    const result = await service.confirmBatchImport(
      { dishes: [{ ...item, subDishNames: ['new child'] }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect([...uploads.values()]).toEqual([
      expect.objectContaining({
        name: 'new child',
        parentDishId: 'existing',
        status: 'pending',
      }),
    ]);
    expect(prisma.dish.update).not.toHaveBeenCalled();
  });

  it('reuses a pending parent created by an earlier standalone row', async () => {
    const { service, uploads } = fixture();
    const result = await service.confirmBatchImport(
      { dishes: [item, { ...item, subDishNames: ['new child'] }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 2, failCount: 0 });
    expect([...uploads.values()]).toHaveLength(2);
    expect([...uploads.values()][1]).toMatchObject({
      parentUploadId: 'upload-0',
    });
  });

  it.each(['children-first', 'standalone-first'])(
    'keeps one parent identity with %s rows',
    async (order) => {
      const { service, uploads } = fixture();
      const children = { ...item, subDishNames: ['first-child'] };
      const standalone = { ...item, price: 20 };
      const result = await service.confirmBatchImport(
        {
          dishes: [
            ...(order === 'children-first'
              ? [children, standalone]
              : [standalone, children]),
            { ...item, subDishNames: ['second-child'] },
          ],
        },
        creator,
      );
      expect(result.data).toMatchObject({ successCount: 3, failCount: 0 });
      const parents = [...uploads.values()].filter(
        (upload) => upload.name === item.name,
      );
      expect(parents).toHaveLength(1);
      expect(parents[0]).toMatchObject({ price: 20, status: 'pending' });
      expect(
        [...uploads.values()].filter((upload) => upload.name !== item.name),
      ).toEqual([
        expect.objectContaining({
          parentUploadId: parents[0].id,
          name: 'first-child',
        }),
        expect.objectContaining({
          parentUploadId: parents[0].id,
          name: 'second-child',
        }),
      ]);
    },
  );

  it('merges consecutive standalone rows into the pending identity created by this batch', async () => {
    const { service, uploads } = fixture();
    const result = await service.confirmBatchImport(
      { dishes: [item, { ...item, price: 20 }, { ...item, price: 30 }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 3, failCount: 0 });
    expect([...uploads.values()]).toEqual([
      expect.objectContaining({ name: item.name, price: 30 }),
    ]);
  });

  it('merges the same child in one row and across rows without merging different parents', async () => {
    const { service, uploads } = fixture();
    const result = await service.confirmBatchImport(
      {
        dishes: [
          { ...item, subDishNames: ['child', 'child'] },
          { ...item, price: 20, subDishNames: ['child'] },
          { ...item, name: 'other parent', subDishNames: ['child'] },
        ],
      },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 3, failCount: 0 });
    expect(uploads.size).toBe(4);
    const firstParent = [...uploads.values()].find(
      (upload) => upload.name === item.name,
    );
    const firstChildren = [...uploads.values()].filter(
      (upload) => upload.parentUploadId === firstParent.id,
    );
    expect(firstChildren).toEqual([
      expect.objectContaining({ name: 'child', price: 20 }),
    ]);
  });

  it('does not merge pending uploads from a different import request by name', async () => {
    const { service, uploads } = fixture();
    await service.confirmBatchImport({ dishes: [item] }, creator);
    await service.confirmBatchImport(
      { dishes: [{ ...item, price: 20 }] },
      creator,
    );
    expect([...uploads.values()].map((upload) => upload.price)).toEqual([
      12, 20,
    ]);
  });

  it('uses the same case-sensitive dish-name identity as formal dish lookup', async () => {
    const { service, uploads } = fixture();
    const result = await service.confirmBatchImport(
      {
        dishes: [
          { ...item, name: 'Dish A' },
          { ...item, name: 'dish a' },
        ],
      },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 2, failCount: 0 });
    expect([...uploads.values()].map((upload) => upload.name)).toEqual([
      'Dish A',
      'dish a',
    ]);
  });

  it.each([false, true])(
    'rechecks a cached upload approved while waiting for its lock (edit permission: %s)',
    async (canEdit) => {
      const { service, prisma, uploads, dishes } = fixture();
      let approved = false;
      prisma.$queryRaw.mockImplementation(async (_query, id) => {
        if (id === 'upload-0' && !approved) {
          approved = true;
          const upload = uploads.get(id);
          Object.assign(upload, {
            status: 'approved',
            approvedDishId: 'formal',
          });
          dishes.set('formal', {
            ...upload,
            id: 'formal',
            parentDishId: null,
            status: 'online',
          });
        }
        return [];
      });
      const result = await service.confirmBatchImport(
        { dishes: [item, { ...item, price: 20 }] },
        {
          ...creator,
          permissions: canEdit ? ['dish:create', 'dish:edit'] : ['dish:create'],
        },
      );
      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'upload-0',
      );
      expect(result.data).toMatchObject({
        successCount: canEdit ? 2 : 1,
        failCount: canEdit ? 0 : 1,
      });
      expect(uploads.size).toBe(1);
      expect(prisma.dishUpload.update).not.toHaveBeenCalled();
      if (canEdit) expect(dishes.get('formal').price).toBe(20);
      else {
        expect(result.data.errors[0].type).toBe('permission');
        expect(prisma.dish.update).not.toHaveBeenCalled();
      }
    },
  );

  it('does not overwrite a moderation rejection on a cached pending upload', async () => {
    const { service, prisma, uploads } = fixture();
    prisma.$queryRaw.mockImplementation(async (_query, id) => {
      if (id === 'upload-0') uploads.get(id).status = 'rejected';
      return [];
    });
    const result = await service.confirmBatchImport(
      { dishes: [item, { ...item, price: 20 }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 1 });
    expect(uploads.size).toBe(1);
    expect(prisma.dishUpload.update).not.toHaveBeenCalled();
  });

  it('does not reuse newly created pending identities from a rolled-back parent-child row', async () => {
    const { service, prisma, uploads } = fixture();
    const create = prisma.dishUpload.create.getMockImplementation();
    prisma.dishUpload.create.mockImplementation(async (args) => {
      if (args.data.name === 'failing-child') throw new Error('write failed');
      return create(args);
    });
    const result = await service.confirmBatchImport(
      {
        dishes: [
          { ...item, subDishNames: ['child', 'failing-child'] },
          { ...item, subDishNames: ['child'] },
        ],
      },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 1 });
    expect([...uploads.values()]).toEqual([
      expect.objectContaining({ id: 'upload-0', name: item.name }),
      expect.objectContaining({ name: 'child', parentUploadId: 'upload-0' }),
    ]);
    expect(prisma.dishUpload.create).toHaveBeenCalledTimes(5);
  });

  it('does not publish resource cache entries from a rolled-back row', async () => {
    const { service, prisma } = fixture();
    prisma.dishUpload.create.mockRejectedValueOnce(new Error('write failed'));
    const row = {
      ...item,
      canteenName: 'new canteen',
      windowName: 'new window',
    };
    const result = await service.confirmBatchImport(
      { dishes: [row, row] },
      {
        ...creator,
        permissions: ['dish:create', 'canteen:create'],
      },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 1 });
    expect(prisma.canteen.create).toHaveBeenCalledTimes(2);
    expect(prisma.window.create).toHaveBeenCalledTimes(2);
  });

  it('permits floors as part of creating a new canteen without requiring edit', async () => {
    const { service, prisma } = fixture();
    const result = await service.confirmBatchImport(
      {
        dishes: [
          {
            ...item,
            canteenName: 'new canteen',
            windowName: 'new window',
            floorName: 'new floor',
          },
        ],
      },
      { ...creator, permissions: ['dish:create', 'canteen:create'] },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(prisma.floor.create).toHaveBeenCalled();
  });

  it.each([
    ['canteen', { canteenName: 'new canteen' }],
    ['window', { windowName: 'new window' }],
  ])(
    'does not create an unauthorized %s during import',
    async (resource, changes) => {
      const { service, prisma } = fixture();
      const result = await service.confirmBatchImport(
        { dishes: [{ ...item, ...changes }] },
        creator,
      );
      expect(result.data).toMatchObject({
        successCount: 0,
        failCount: 1,
        errors: [{ type: 'permission' }],
      });
      expect(prisma[resource].create).not.toHaveBeenCalled();
    },
  );

  it('uses an existing window location without creating an unused floor', async () => {
    const { service, prisma } = fixture();
    const result = await service.confirmBatchImport(
      { dishes: [{ ...item, floorName: 'unused floor' }] },
      creator,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(prisma.floor.create).not.toHaveBeenCalled();
  });

  it('allows creating a window and its floor with canteen:create', async () => {
    const { service, prisma } = fixture();
    const result = await service.confirmBatchImport(
      {
        dishes: [
          {
            ...item,
            windowName: 'new window',
            floorName: 'new floor',
          },
        ],
      },
      { ...creator, permissions: ['dish:create', 'canteen:create'] },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(prisma.floor.create).toHaveBeenCalled();
    expect(prisma.window.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ floorId: 'new-floor' }),
      }),
    );
  });

  it('permits related resources when their create and edit permissions are present', async () => {
    const { service, prisma } = fixture();
    const result = await service.confirmBatchImport(
      {
        dishes: [
          {
            ...item,
            canteenName: 'new canteen',
            windowName: 'new window',
            floorName: 'new floor',
          },
        ],
      },
      {
        ...creator,
        permissions: ['dish:create', 'canteen:create', 'canteen:edit'],
      },
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(prisma.canteen.create).toHaveBeenCalled();
    expect(prisma.window.create).toHaveBeenCalled();
    expect(prisma.floor.create).toHaveBeenCalled();
    expect(prisma.dishUpload.create).toHaveBeenCalled();
  });
});
