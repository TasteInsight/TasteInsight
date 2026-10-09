import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { AdminCanteensService } from '@/admin-canteens/admin-canteens.service';
import { AdminConfigService } from '@/admin-config/admin-config.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { AdminUploadsService } from '@/admin-uploads/admin-uploads.service';
import { CommentsService } from '@/comments/comments.service';
import { BatchDishStatus } from '@/admin-dishes/dto/admin-dish-batch.dto';
import { AdminInfo } from '@/auth/decorators/current-admin.decorator';

describe('Administrator write boundaries (PostgreSQL)', () => {
  const prefix = `write-boundaries-${randomUUID()}`;
  const canteenIds: string[] = [];
  const adminIds: string[] = [];
  const userIds: string[] = [];
  let prisma: PrismaService;
  let control: PrismaService;
  let singleConnection: PrismaService;
  let twoConnections: PrismaService;
  let canteens: AdminCanteensService;

  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const client = (limit: number) => {
      const url = new URL(process.env.DATABASE_URL!);
      url.searchParams.set('connection_limit', String(limit));
      url.searchParams.set('pool_timeout', '2');
      return new PrismaService({
        datasources: { db: { url: url.toString() } },
      });
    };
    prisma = client(3);
    control = client(1);
    singleConnection = client(1);
    twoConnections = client(2);
    canteens = new AdminCanteensService(prisma, {} as any);
    await Promise.all(
      [prisma, control, singleConnection, twoConnections].map((db) =>
        db.$connect(),
      ),
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      await prisma.operationLog.deleteMany({
        where: { adminId: { in: adminIds } },
      });
      await prisma.dishUpload.updateMany({
        where: { canteenId: { in: canteenIds } },
        data: { parentUploadId: null },
      });
      await prisma.admin.deleteMany({ where: { id: { in: adminIds } } });
      await prisma.canteen.deleteMany({ where: { id: { in: canteenIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await Promise.all(
      [prisma, control, singleConnection, twoConnections]
        .filter(Boolean)
        .map((db) => db.$disconnect()),
    );
  });

  async function createCanteen() {
    const canteen = await prisma.canteen.create({
      data: {
        name: `${prefix}-${canteenIds.length}`,
        images: [],
        openingHours: [],
      },
    });
    canteenIds.push(canteen.id);
    return canteen;
  }

  async function createAdmin(canteenId: string | null, retired = false) {
    const admin = await control.admin.create({
      data: {
        username: `${prefix}-admin-${adminIds.length}`,
        password: 'unused-test-hash',
        canteenId,
        deletedAt: retired ? new Date() : null,
      },
    });
    adminIds.push(admin.id);
    return admin;
  }

  async function createReview() {
    const canteen = await createCanteen();
    const user = await prisma.user.create({
      data: {
        openId: `${prefix}-user-${userIds.length}`,
        nickname: 'Boundary test',
      },
    });
    userIds.push(user.id);
    const dish = await prisma.dish.create({
      data: {
        name: prefix,
        price: 1,
        tags: [],
        images: [],
        ingredients: [],
        allergens: [],
        canteenId: canteen.id,
        canteenName: canteen.name,
        windowName: 'window',
        availableMealTime: [],
      },
    });
    const review = await prisma.review.create({
      data: {
        dishId: dish.id,
        userId: user.id,
        rating: 5,
        images: [],
        status: 'approved',
      },
    });
    await prisma.adminConfig.create({
      data: {
        canteenId: canteen.id,
        items: {
          create: {
            key: 'comment.autoApprove',
            value: 'true',
            valueType: 'boolean',
          },
        },
      },
    });
    return { user, review };
  }

  it('creates a comment using one shared database connection', async () => {
    const { user, review } = await createReview();
    const service = new CommentsService(
      singleConnection,
      new AdminConfigService(singleConnection),
    );
    const result = await service.createComment(user.id, {
      reviewId: review.id,
      content: 'single pool',
    });
    expect(result.data).toMatchObject({ floor: 1, status: 'approved' });
  });

  it('serializes same-review comments without exhausting a two-connection shared pool', async () => {
    const { user, review } = await createReview();
    const service = new CommentsService(
      twoConnections,
      new AdminConfigService(twoConnections),
    );
    const results = await Promise.all(
      ['first', 'second'].map((content) =>
        service.createComment(user.id, { reviewId: review.id, content }),
      ),
    );
    expect(results.map((result) => result.data.floor).sort()).toEqual([1, 2]);
    expect(await prisma.comment.count({ where: { reviewId: review.id } })).toBe(
      2,
    );
  });

  it('rejects active administrator bindings without retiring or broadening the account', async () => {
    const canteen = await createCanteen();
    const admin = await createAdmin(canteen.id);
    await expect(canteens.remove(canteen.id)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      prisma.canteen.delete({ where: { id: canteen.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(
      await prisma.admin.findUnique({ where: { id: admin.id } }),
    ).toMatchObject({ canteenId: canteen.id, deletedAt: null });
  });

  it('retains retired accounts and their operation history when deleting the canteen', async () => {
    const canteen = await createCanteen();
    const admin = await createAdmin(canteen.id, true);
    const log = await prisma.operationLog.create({
      data: {
        adminId: admin.id,
        action: 'create',
        targetType: 'dish',
        targetId: prefix,
        result: 'success',
      },
    });
    await expect(canteens.remove(canteen.id)).resolves.toMatchObject({
      code: 200,
    });
    expect(
      await prisma.admin.findUnique({ where: { id: admin.id } }),
    ).toMatchObject({ canteenId: null, deletedAt: admin.deletedAt });
    expect(
      await prisma.operationLog.findUnique({ where: { id: log.id } }),
    ).not.toBeNull();
  });

  it('rejects deletion when an active binding commits after the service count', async () => {
    const canteen = await createCanteen();
    const counted = deferred();
    const proceed = deferred();
    const transaction = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(((
      callback,
    ) =>
      transaction(async (tx) => {
        const count = tx.admin.count.bind(tx.admin);
        tx.admin.count = (async (args) => {
          const result = await count(args);
          counted.resolve();
          await proceed.promise;
          return result;
        }) as typeof tx.admin.count;
        return callback(tx);
      })) as any);
    const deletion = canteens.remove(canteen.id);
    try {
      await counted.promise;
      const admin = await createAdmin(canteen.id);
      proceed.resolve();
      await expect(deletion).rejects.toThrow(ConflictException);
      expect(
        await prisma.admin.findUnique({ where: { id: admin.id } }),
      ).toMatchObject({ canteenId: canteen.id, deletedAt: null });
    } finally {
      proceed.resolve();
      spy.mockRestore();
    }
  });

  it('rejects a binding when canteen deletion wins the foreign-key race', async () => {
    const canteen = await createCanteen();
    const deleted = deferred();
    const proceed = deferred();
    const deletion = prisma.$transaction(async (tx) => {
      await tx.canteen.delete({ where: { id: canteen.id } });
      deleted.resolve();
      await proceed.promise;
    });
    await deleted.promise;
    const binding = createAdmin(canteen.id);
    proceed.resolve();
    await deletion;
    await expect(binding).rejects.toMatchObject({ code: 'P2003' });
  });

  it('enforces batch edit/create permissions and feeds parent-child uploads into normal approval', async () => {
    const canteen = await createCanteen();
    const window = await prisma.window.create({
      data: { canteenId: canteen.id, name: 'window', number: '1' },
    });
    const admin = await createAdmin(canteen.id);
    const adminInfo: AdminInfo = { ...admin, permissions: ['dish:create'] };
    const service = new AdminDishesService(prisma);
    const row = {
      name: 'parent',
      price: 9,
      canteenName: canteen.name,
      windowName: window.name,
      status: BatchDishStatus.VALID,
    };
    const result = await service.confirmBatchImport(
      { dishes: [{ ...row, subDishNames: ['child'] }] },
      adminInfo,
    );
    expect(result.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(await prisma.dish.count({ where: { canteenId: canteen.id } })).toBe(
      0,
    );
    const parent = await prisma.dishUpload.findFirstOrThrow({
      where: { canteenId: canteen.id, name: 'parent' },
    });
    const child = await prisma.dishUpload.findFirstOrThrow({
      where: { parentUploadId: parent.id, name: 'child' },
    });
    expect(parent.status).toBe('pending');
    expect(child.status).toBe('pending');
    const reviewer = { ...adminInfo, permissions: ['upload:approve'] };
    const uploads = new AdminUploadsService(prisma);
    await expect(uploads.approveUpload(child.id, reviewer)).rejects.toThrow(
      '请先审核通过父菜品',
    );
    await uploads.approveUpload(parent.id, reviewer);
    await uploads.approveUpload(child.id, reviewer);
    const formalParent = await prisma.dish.findFirstOrThrow({
      where: { canteenId: canteen.id, name: 'parent' },
    });
    const formalChild = await prisma.dish.findFirstOrThrow({
      where: { parentDishId: formalParent.id, name: 'child' },
    });
    expect(formalChild.status).toBe('online');

    const rejected = await service.confirmBatchImport(
      { dishes: [{ ...row, price: 99 }] },
      adminInfo,
    );
    expect(rejected.data).toMatchObject({
      successCount: 0,
      failCount: 1,
      errors: [{ type: 'permission' }],
    });
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: formalParent.id } }))
        .price,
    ).toBe(0);
    const edited = await service.confirmBatchImport(
      { dishes: [{ ...row, price: 99 }] },
      { ...adminInfo, permissions: ['dish:create', 'dish:edit'] },
    );
    expect(edited.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: formalParent.id } }))
        .price,
    ).toBe(99);

    const missingWindow = await service.confirmBatchImport(
      {
        dishes: [{ ...row, name: 'new dish', windowName: 'forbidden window' }],
      },
      adminInfo,
    );
    expect(missingWindow.data).toMatchObject({
      successCount: 0,
      failCount: 1,
      errors: [{ type: 'permission' }],
    });
    expect(
      await prisma.window.count({
        where: { canteenId: canteen.id, name: 'forbidden window' },
      }),
    ).toBe(0);
  });

  it('rolls back new resources and re-resolves them for the following row', async () => {
    const admin = await createAdmin(null);
    const adminInfo: AdminInfo = {
      ...admin,
      permissions: ['dish:create', 'canteen:create'],
    };
    const service = new AdminDishesService(prisma);
    const canteenName = `${prefix}-rollback`;
    const row = {
      name: 'dish',
      price: 5,
      canteenName,
      windowName: 'window',
      floorName: '一楼',
      status: BatchDishStatus.VALID,
    };
    const transaction = prisma.$transaction.bind(prisma);
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(((
      callback,
    ) =>
      transaction(async (tx) => {
        tx.dishUpload.create = (async () => {
          await tx.$executeRaw`SELECT 1 / 0`;
        }) as any;
        return callback(tx);
      })) as any);
    try {
      const result = await service.confirmBatchImport(
        { dishes: [row, row] },
        adminInfo,
      );
      expect(result.data).toMatchObject({
        successCount: 1,
        failCount: 1,
        errors: [{ index: 0 }],
      });
      const rows = await prisma.canteen.findMany({
        where: { name: canteenName },
        include: { windows: true, floors: true, dishUploads: true },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].windows).toHaveLength(1);
      expect(rows[0].floors).toHaveLength(1);
      expect(rows[0].dishUploads).toHaveLength(1);
      expect(rows[0].dishUploads[0].status).toBe('pending');
    } finally {
      spy.mockRestore();
      const ownedCanteens = await prisma.canteen.findMany({
        where: { name: canteenName },
        select: { id: true },
      });
      canteenIds.push(...ownedCanteens.map((canteen) => canteen.id));
    }
  });

  it('keeps one pending identity across parent, standalone and repeated child rows', async () => {
    const canteen = await createCanteen();
    const window = await prisma.window.create({
      data: { canteenId: canteen.id, name: 'window', number: '1' },
    });
    const admin = await createAdmin(canteen.id);
    const service = new AdminDishesService(prisma);
    const row = {
      name: 'parent',
      price: 9,
      canteenName: canteen.name,
      windowName: window.name,
      status: BatchDishStatus.VALID,
    };
    const result = await service.confirmBatchImport(
      {
        dishes: [
          { ...row, subDishNames: ['first-child', 'first-child'] },
          { ...row, price: 20 },
          { ...row, subDishNames: ['second-child', 'first-child'] },
        ],
      },
      { ...admin, permissions: ['dish:create'] },
    );
    expect(result.data).toMatchObject({ successCount: 3, failCount: 0 });
    const records = await prisma.dishUpload.findMany({
      where: { canteenId: canteen.id },
    });
    expect(records).toHaveLength(3);
    const parent = records.find((upload) => upload.name === 'parent')!;
    expect(parent.price).toBe(20);
    expect(
      records
        .filter((upload) => upload.id !== parent.id)
        .every((upload) => upload.parentUploadId === parent.id),
    ).toBe(true);
  });

  it('approves the pending fields committed after the reviewer pre-read', async () => {
    const canteen = await createCanteen();
    const window = await prisma.window.create({
      data: { canteenId: canteen.id, name: 'window', number: '1' },
    });
    const admin = await createAdmin(canteen.id);
    const adminInfo = { ...admin, permissions: ['dish:create'] };
    const row = {
      name: 'dish',
      price: 9,
      canteenName: canteen.name,
      windowName: window.name,
      status: BatchDishStatus.VALID,
    };
    const firstCommitted = deferred();
    const continueImport = deferred();
    const reviewerRead = deferred();
    const continueApproval = deferred();
    const transaction = prisma.$transaction.bind(prisma);
    const reviewTransaction = control.$transaction.bind(control);
    let rowNumber = 0;
    const importSpy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback) => {
        if (++rowNumber === 2) {
          firstCommitted.resolve();
          await continueImport.promise;
        }
        return transaction(callback);
      }) as any);
    const reviewSpy = jest
      .spyOn(control, '$transaction')
      .mockImplementationOnce((async (callback) => {
        reviewerRead.resolve();
        await continueApproval.promise;
        return reviewTransaction(callback);
      }) as any);
    const importing = new AdminDishesService(prisma).confirmBatchImport(
      { dishes: [row, { ...row, price: 20 }] },
      adminInfo,
    );
    let approval: Promise<unknown> | undefined;
    try {
      await firstCommitted.promise;
      const upload = await prisma.dishUpload.findFirstOrThrow({
        where: { canteenId: canteen.id },
      });
      approval = new AdminUploadsService(control).approveUpload(upload.id, {
        ...adminInfo,
        permissions: ['upload:approve'],
      });
      await reviewerRead.promise;
      continueImport.resolve();
      expect((await importing).data).toMatchObject({
        successCount: 2,
        failCount: 0,
      });
      continueApproval.resolve();
      await approval;
      expect(
        (
          await prisma.dish.findFirstOrThrow({
            where: { canteenId: canteen.id },
          })
        ).price,
      ).toBe(20);
      expect(
        await prisma.dishUpload.count({ where: { canteenId: canteen.id } }),
      ).toBe(1);
    } finally {
      continueImport.resolve();
      continueApproval.resolve();
      await Promise.allSettled([importing, approval]);
      importSpy.mockRestore();
      reviewSpy.mockRestore();
    }
  });

  it.each([false, true])(
    'requires edit for a batch record approved between rows (edit permission: %s)',
    async (canEdit) => {
      const canteen = await createCanteen();
      const window = await prisma.window.create({
        data: { canteenId: canteen.id, name: 'window', number: '1' },
      });
      const admin = await createAdmin(canteen.id);
      const adminInfo = {
        ...admin,
        permissions: canEdit ? ['dish:create', 'dish:edit'] : ['dish:create'],
      };
      const row = {
        name: 'dish',
        price: 9,
        canteenName: canteen.name,
        windowName: window.name,
        status: BatchDishStatus.VALID,
      };
      const firstCommitted = deferred();
      const proceed = deferred();
      const transaction = prisma.$transaction.bind(prisma);
      let rowNumber = 0;
      const spy = jest.spyOn(prisma, '$transaction').mockImplementation((async (
        callback,
      ) => {
        if (++rowNumber === 2) {
          firstCommitted.resolve();
          await proceed.promise;
        }
        return transaction(callback);
      }) as any);
      const importing = new AdminDishesService(prisma).confirmBatchImport(
        { dishes: [row, { ...row, price: 20 }] },
        adminInfo,
      );
      try {
        await firstCommitted.promise;
        const upload = await prisma.dishUpload.findFirstOrThrow({
          where: { canteenId: canteen.id },
        });
        await new AdminUploadsService(control).approveUpload(upload.id, {
          ...adminInfo,
          permissions: ['upload:approve'],
        });
        proceed.resolve();
        const result = await importing;
        expect(result.data).toMatchObject({
          successCount: canEdit ? 2 : 1,
          failCount: canEdit ? 0 : 1,
        });
        if (!canEdit) expect(result.data.errors[0].type).toBe('permission');
        expect(
          (
            await prisma.dish.findFirstOrThrow({
              where: { canteenId: canteen.id },
            })
          ).price,
        ).toBe(canEdit ? 20 : 9);
        expect(
          await prisma.dishUpload.count({ where: { canteenId: canteen.id } }),
        ).toBe(1);
      } finally {
        proceed.resolve();
        await Promise.allSettled([importing]);
        spy.mockRestore();
      }
    },
  );
});
