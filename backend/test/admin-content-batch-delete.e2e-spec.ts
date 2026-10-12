import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('Atomic administrator content deletion (PostgreSQL)', () => {
  const prefix = `batch-${randomUUID()}`;
  let app: INestApplication;
  let db: PrismaService;
  const admins: string[] = [];
  const users: string[] = [];
  const canteens: string[] = [];
  let globalToken: string;
  let scopedToken: string;
  let readerToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    for (const suffix of ['a', 'b']) {
      canteens.push(
        (
          await db.canteen.create({
            data: { name: `${prefix}-${suffix}`, openingHours: [], images: [] },
          })
        ).id,
      );
    }
    for (let i = 0; i < 3; i++)
      users.push(
        (await db.user.create({ data: { nickname: `${prefix}-${i}` } })).id,
      );
    const jwt = app.get(JwtService);
    const secret = app.get(ConfigService).get<string>('JWT_SECRET');
    const admin = async (
      role: string,
      canteenId: string | null,
      permissions: string[],
    ) => {
      const row = await db.admin.create({
        data: {
          username: `${prefix}-${admins.length}`,
          password: 'unused-token-fixture',
          role,
          canteenId,
          permissions: {
            create: permissions.map((permission) => ({ permission })),
          },
        },
      });
      admins.push(row.id);
      return jwt.sign(
        { sub: row.id, type: 'admin', tokenUse: 'access' },
        { secret },
      );
    };
    globalToken = await admin('superadmin', null, []);
    scopedToken = await admin('admin', canteens[0], [
      'dish:view',
      'dish:delete',
      'news:view',
      'news:delete',
      'review:approve',
      'review:delete',
      'comment:approve',
      'comment:delete',
    ]);
    readerToken = await admin('admin', null, ['dish:view']);
  });

  afterAll(async () => {
    if (db) {
      await db.dishUpload.updateMany({
        where: { canteenId: { in: canteens } },
        data: { parentDishId: null, parentUploadId: null },
      });
      await db.dishUpload.deleteMany({
        where: { canteenId: { in: canteens } },
      });
      await db.news.deleteMany({ where: { createdBy: { in: admins } } });
      await db.operationLog.deleteMany({ where: { adminId: { in: admins } } });
      await db.admin.deleteMany({ where: { id: { in: admins } } });
      await db.canteen.deleteMany({ where: { id: { in: canteens } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  const dish = (canteenId = canteens[0], parentDishId?: string) =>
    db.dish.create({
      data: {
        name: prefix,
        price: 10,
        canteenId,
        canteenName: prefix,
        windowName: '窗口',
        parentDishId,
      },
    });
  const remove = (kind: string, ids: string[], token = globalToken) =>
    request(app.getHttpServer())
      .post(`/admin/${kind}/batch-delete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids });

  it('validates the entire batch and retains all rows for missing or duplicate IDs', async () => {
    const row = await dish();
    await remove('dishes', []).expect(400);
    await remove('dishes', [row.id, row.id]).expect(400);
    await remove('dishes', [row.id, 'does-not-exist']).expect(404);
    await remove(
      'dishes',
      Array.from({ length: 101 }, (_, i) => `id-${i}`),
    ).expect(400);
    expect(await db.dish.findUnique({ where: { id: row.id } })).not.toBeNull();
  });

  it('checks permission and every canteen before deleting any selected dish', async () => {
    const own = await dish();
    const other = await dish(canteens[1]);
    await remove('dishes', [own.id], readerToken).expect(403);
    await remove('dishes', [own.id, other.id], scopedToken).expect(403);
    expect(
      await db.dish.count({ where: { id: { in: [own.id, other.id] } } }),
    ).toBe(2);
  });

  it('rejects a batch containing a parent without partially deleting independent rows', async () => {
    const parent = await dish();
    await dish(canteens[0], parent.id);
    const independent = await dish();
    await remove('dishes', [parent.id, independent.id]).expect(400);
    expect(
      await db.dish.count({
        where: { id: { in: [parent.id, independent.id] } },
      }),
    ).toBe(2);
  });

  it('preserves upload history and reparents pending children in a set-based deletion', async () => {
    const one = await dish();
    const two = await dish();
    const source = await db.dishUpload.create({
      data: {
        name: prefix,
        price: 10,
        canteenId: canteens[0],
        canteenName: prefix,
        windowName: '窗口',
        status: 'approved',
        approvedDishId: one.id,
      },
    });
    const pending = await db.dishUpload.create({
      data: {
        name: prefix,
        price: 10,
        canteenId: canteens[0],
        canteenName: prefix,
        windowName: '窗口',
        parentDishId: one.id,
      },
    });
    const result = await remove('dishes', [one.id, two.id], scopedToken).expect(
      200,
    );
    expect(result.body.data.deletedCount).toBe(2);
    expect(
      await db.dish.count({ where: { id: { in: [one.id, two.id] } } }),
    ).toBe(0);
    expect(
      await db.dishUpload.findUnique({ where: { id: pending.id } }),
    ).toMatchObject({
      parentDishId: null,
      parentUploadId: source.id,
      status: 'pending',
    });
    expect(
      await db.dishUpload.findUnique({ where: { id: source.id } }),
    ).toMatchObject({ approvedDishId: null, status: 'approved' });
  });

  it('rolls back incompatible upload hierarchies for the whole batch', async () => {
    const row = await dish();
    const second = await dish();
    await db.dishUpload.create({
      data: {
        name: prefix,
        price: 10,
        canteenId: canteens[0],
        canteenName: prefix,
        windowName: '窗口',
        parentDishId: row.id,
      },
    });
    await remove('dishes', [row.id, second.id]).expect(400);
    expect(
      await db.dish.count({ where: { id: { in: [row.id, second.id] } } }),
    ).toBe(2);
  });

  it('soft-deletes reviews, retracts thread notifications and recomputes remaining ratings atomically', async () => {
    const row = await dish();
    const first = await db.review.create({
      data: {
        dishId: row.id,
        userId: users[0],
        rating: 5,
        images: [],
        status: 'approved',
      },
    });
    const second = await db.review.create({
      data: {
        dishId: row.id,
        userId: users[1],
        rating: 3,
        images: [],
        status: 'approved',
      },
    });
    const third = await db.review.create({
      data: {
        dishId: row.id,
        userId: users[2],
        rating: 1,
        images: [],
        status: 'rejected',
      },
    });
    const notification = await db.notification.create({
      data: {
        userId: users[0],
        actorId: users[1],
        type: 'like',
        targetType: 'review',
        targetId: first.id,
        dedupeKey: `${prefix}-${first.id}`,
      },
    });
    await db.notificationOutbox.create({
      data: { notificationId: notification.id },
    });
    await remove('reviews', [first.id, 'absent']).expect(404);
    expect(
      (await db.review.findUniqueOrThrow({ where: { id: first.id } }))
        .deletedAt,
    ).toBeNull();
    const removed = await remove('reviews', [first.id, third.id]).expect(200);
    expect(removed.body.data.deletedCount).toBe(2);
    expect(
      (await db.review.findUniqueOrThrow({ where: { id: first.id } }))
        .deletedAt,
    ).toBeInstanceOf(Date);
    expect(
      (await db.review.findUniqueOrThrow({ where: { id: second.id } }))
        .deletedAt,
    ).toBeNull();
    expect(await db.dish.findUnique({ where: { id: row.id } })).toMatchObject({
      reviewCount: 1,
      averageRating: 3,
    });
    expect(
      (
        await db.notification.findUniqueOrThrow({
          where: { id: notification.id },
        })
      ).withdrawnAt,
    ).toBeInstanceOf(Date);
    expect(
      await db.notificationOutbox.findUnique({
        where: { notificationId: notification.id },
      }),
    ).toMatchObject({ status: 'cancelled' });
  });

  it('deletes selected replies without deleting their child replies', async () => {
    const row = await dish();
    const review = await db.review.create({
      data: {
        dishId: row.id,
        userId: users[0],
        rating: 5,
        images: [],
        status: 'approved',
      },
    });
    const parent = await db.comment.create({
      data: {
        reviewId: review.id,
        userId: users[1],
        content: '父回复',
        status: 'approved',
      },
    });
    const child = await db.comment.create({
      data: {
        reviewId: review.id,
        userId: users[2],
        parentCommentId: parent.id,
        content: '子回复',
        status: 'approved',
      },
    });
    await remove('comments', [parent.id]).expect(200);
    expect(
      (await db.comment.findUniqueOrThrow({ where: { id: parent.id } }))
        .deletedAt,
    ).toBeInstanceOf(Date);
    expect(
      (await db.comment.findUniqueOrThrow({ where: { id: child.id } }))
        .deletedAt,
    ).toBeNull();
  });

  it('deletes news in one batch only after all scope checks pass', async () => {
    const one = await db.news.create({
      data: {
        title: prefix,
        content: '正文',
        canteenId: canteens[0],
        createdBy: admins[0],
      },
    });
    const two = await db.news.create({
      data: {
        title: prefix,
        content: '正文',
        canteenId: canteens[1],
        createdBy: admins[0],
      },
    });
    await remove('news', [one.id, two.id], scopedToken).expect(403);
    expect(
      await db.news.count({ where: { id: { in: [one.id, two.id] } } }),
    ).toBe(2);
    expect(
      (await remove('news', [one.id, two.id]).expect(200)).body.data
        .deletedCount,
    ).toBe(2);
  });

  it('retracts discussion notifications before hard dish deletion cascades', async () => {
    const row = await dish();
    const review = await db.review.create({
      data: {
        dishId: row.id,
        userId: users[0],
        rating: 5,
        images: [],
        status: 'approved',
      },
    });
    const notification = await db.notification.create({
      data: {
        userId: users[0],
        actorId: users[1],
        type: 'like',
        targetType: 'review',
        targetId: review.id,
        dedupeKey: `${prefix}-${review.id}`,
      },
    });
    await remove('dishes', [row.id]).expect(200);
    expect(
      (
        await db.notification.findUniqueOrThrow({
          where: { id: notification.id },
        })
      ).withdrawnAt,
    ).toBeInstanceOf(Date);
    expect(await db.review.findUnique({ where: { id: review.id } })).toBeNull();
  });
});
