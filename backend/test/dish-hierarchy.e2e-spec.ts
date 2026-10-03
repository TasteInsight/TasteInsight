import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { Prisma } from '@prisma/client';

describe('Dish hierarchy and approval ownership (e2e)', () => {
  jest.setTimeout(30000);
  const prefix = `hierarchy-${randomUUID()}`;
  const password = 'HierarchyFixture@123';
  const adminIds: string[] = [];
  const dishIds: string[] = [];
  const uploadIds: string[] = [];
  let app: INestApplication;
  let prisma: PrismaService;
  let globalToken: string;
  let canteenToken: string;
  let canteenA: string;
  let canteenB: string;
  let windowA: string;
  let windowB: string;

  const login = async (username: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username, password })
      .expect(200);
    return response.body.data.token.accessToken;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const [first, second] = await Promise.all([
      prisma.canteen.findFirstOrThrow({ where: { name: '第一食堂' } }),
      prisma.canteen.findFirstOrThrow({ where: { name: '第二食堂' } }),
    ]);
    canteenA = first.id;
    canteenB = second.id;
    windowA = (
      await prisma.window.findFirstOrThrow({ where: { canteenId: canteenA } })
    ).id;
    windowB = (
      await prisma.window.findFirstOrThrow({ where: { canteenId: canteenB } })
    ).id;
    const hashedPassword = await bcrypt.hash(password, 10);
    for (const [suffix, role, canteenId] of [
      ['global', 'superadmin', null],
      ['local', 'admin', canteenA],
    ] as const) {
      const id = `${prefix}-${suffix}`;
      await prisma.admin.create({
        data: {
          id,
          username: id,
          password: hashedPassword,
          role,
          canteenId,
          permissions: {
            create: ['dish:view', 'dish:edit', 'upload:approve'].map(
              (permission) => ({ permission }),
            ),
          },
        },
      });
      adminIds.push(id);
    }
    globalToken = await login(`${prefix}-global`);
    canteenToken = await login(`${prefix}-local`);
  });

  afterAll(async () => {
    try {
      if (prisma) {
        const approved = await prisma.dishUpload.findMany({
          where: { id: { in: uploadIds } },
          select: { approvedDishId: true },
        });
        const ownDishIds = [
          ...new Set([
            ...dishIds,
            ...approved.flatMap(({ approvedDishId }) =>
              approvedDishId ? [approvedDishId] : [],
            ),
          ]),
        ];
        await prisma.$transaction(async (tx) => {
          if (adminIds.length) {
            // Audit inserts take admin FK locks; lock fixture owners before cleanup.
            await tx.$queryRaw`SELECT "id" FROM "admins" WHERE "id" IN (${Prisma.join(adminIds)}) FOR UPDATE`;
          }
          await tx.operationLog.deleteMany({
            where: { adminId: { in: adminIds } },
          });
          await tx.dishUpload.deleteMany({ where: { id: { in: uploadIds } } });
          await tx.dishEmbedding.deleteMany({
            where: { dishId: { in: ownDishIds } },
          });
          await tx.dish.deleteMany({ where: { id: { in: ownDishIds } } });
          await tx.admin.deleteMany({ where: { id: { in: adminIds } } });
        });
      }
    } finally {
      await app?.close();
    }
  });

  const createDish = async (
    canteenId: string,
    parentDishId: string | null = null,
  ) => {
    const window = await prisma.window.findUniqueOrThrow({
      where: { id: canteenId === canteenA ? windowA : windowB },
      include: { canteen: true },
    });
    const id = `${prefix}-dish-${randomUUID()}`;
    await prisma.dish.create({
      data: {
        id,
        name: id,
        price: 10,
        tags: [],
        images: [],
        ingredients: [],
        allergens: [],
        availableMealTime: ['lunch'],
        canteenId,
        canteenName: window.canteen.name,
        windowId: window.id,
        windowName: window.name,
        parentDishId,
      },
    });
    dishIds.push(id);
    return id;
  };

  const updateDish = (id: string, data: object, token = globalToken) =>
    request(app.getHttpServer())
      .put(`/admin/dishes/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  const createUpload = async (windowId: string, parentDishId?: string) => {
    const response = await request(app.getHttpServer())
      .post('/admin/dishes')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({
        name: `${prefix}-upload-${randomUUID()}`,
        price: 10,
        windowId,
        parentDishId,
      })
      .expect(201);
    uploadIds.push(response.body.data.id);
    return response.body.data.id as string;
  };

  const createApprovedDish = async () => {
    const uploadId = await createUpload(windowA);
    await request(app.getHttpServer())
      .post(`/admin/dishes/uploads/${uploadId}/approve`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(200);
    const source = await prisma.dishUpload.findUniqueOrThrow({
      where: { id: uploadId },
    });
    expect(source.approvedDishId).not.toBeNull();
    dishIds.push(source.approvedDishId!);
    return { uploadId, dishId: source.approvedDishId! };
  };

  it('rejects cross-canteen parents through both scoped and global admin APIs', async () => {
    const dish = await createDish(canteenA);
    const parent = await createDish(canteenB);
    await updateDish(dish, { parentDishId: parent }, canteenToken).expect(403);
    await updateDish(dish, { parentDishId: parent }).expect(400);
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: dish } }))
        .parentDishId,
    ).toBeNull();
  });

  it('rejects self and descendant parents without changing the persisted tree', async () => {
    const parent = await createDish(canteenA);
    const child = await createDish(canteenA, parent);
    const grandchild = await createDish(canteenA, child);
    await updateDish(parent, { parentDishId: parent }).expect(400);
    await updateDish(parent, { parentDishId: grandchild }).expect(400);
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: parent } }))
        .parentDishId,
    ).toBeNull();
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: child } }))
        .parentDishId,
    ).toBe(parent);
  });

  it('allows explicit detach and migration while rejecting migration of retained relations', async () => {
    const parent = await createDish(canteenA);
    const child = await createDish(canteenA, parent);
    await updateDish(child, { windowId: windowB }).expect(400);
    await updateDish(parent, { windowId: windowB }).expect(400);
    await updateDish(child, { parentDishId: null, windowId: windowB }).expect(
      200,
    );
    expect(
      await prisma.dish.findUniqueOrThrow({ where: { id: child } }),
    ).toMatchObject({
      parentDishId: null,
      canteenId: canteenB,
      windowId: windowB,
    });
  });

  it('never commits a cycle or returns 500 for opposing concurrent reparent requests', async () => {
    const first = await createDish(canteenA);
    const second = await createDish(canteenA);
    const responses = await Promise.all([
      updateDish(first, { parentDishId: second }),
      updateDish(second, { parentDishId: first }),
    ]);
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => [400, 409].includes(response.status)),
    ).toHaveLength(1);
    const [firstDish, secondDish] = await Promise.all([
      prisma.dish.findUniqueOrThrow({ where: { id: first } }),
      prisma.dish.findUniqueOrThrow({ where: { id: second } }),
    ]);
    expect(
      firstDish.parentDishId === second && secondDish.parentDishId === first,
    ).toBe(false);
  });

  it('checks current formal-dish scope when revoking a migrated source upload', async () => {
    const { uploadId, dishId } = await createApprovedDish();
    await updateDish(dishId, { windowId: windowB }).expect(200);
    await request(app.getHttpServer())
      .post(`/admin/dishes/uploads/${uploadId}/revoke`)
      .set('Authorization', `Bearer ${canteenToken}`)
      .expect(403);
    expect(
      await prisma.dish.findUniqueOrThrow({ where: { id: dishId } }),
    ).toMatchObject({ canteenId: canteenB });
    expect(
      await prisma.dishUpload.findUniqueOrThrow({ where: { id: uploadId } }),
    ).toMatchObject({
      canteenId: canteenA,
      status: 'approved',
      approvedDishId: dishId,
    });
    await request(app.getHttpServer())
      .post(`/admin/dishes/uploads/${uploadId}/revoke`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(200);
    expect(await prisma.dish.findUnique({ where: { id: dishId } })).toBeNull();
    expect(
      await prisma.dishUpload.findUniqueOrThrow({ where: { id: uploadId } }),
    ).toMatchObject({
      canteenId: canteenA,
      status: 'pending',
      approvedDishId: null,
    });
  });

  it('preserves child identity instead of converting it to a source upload in another canteen', async () => {
    const { uploadId, dishId } = await createApprovedDish();
    await updateDish(dishId, { windowId: windowB }).expect(200);
    const childId = await createUpload(windowB, dishId);
    await request(app.getHttpServer())
      .post(`/admin/dishes/uploads/${uploadId}/revoke`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/admin/dishes/${dishId}`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(400);
    expect(
      await prisma.dishUpload.findUniqueOrThrow({ where: { id: childId } }),
    ).toMatchObject({
      canteenId: canteenB,
      parentDishId: dishId,
      parentUploadId: null,
    });
    expect(
      await prisma.dishUpload.findUniqueOrThrow({ where: { id: uploadId } }),
    ).toMatchObject({
      canteenId: canteenA,
      status: 'approved',
      approvedDishId: dishId,
    });
    expect(
      await prisma.dish.findUniqueOrThrow({ where: { id: dishId } }),
    ).toMatchObject({ canteenId: canteenB });
  });
});
