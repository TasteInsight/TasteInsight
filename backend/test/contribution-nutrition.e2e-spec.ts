import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('Contribution nutrition lifecycle (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: string;
  let admin: string;
  let canteen: { id: string; name: string };
  const uploads: string[] = [];
  const dishes: string[] = [];
  const api = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token: string,
    body?: object,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .auth(token, { type: 'bearer' })
      .send(body);
  const own = async (id: string) =>
    (await api('get', `/user/uploads/${id}`, user).expect(200)).body.data;
  const read = async (id: string) =>
    (await api('get', `/dishes/${id}`, user).expect(200)).body.data;
  const decide = async (
    id: string,
    action: 'approve' | 'revoke',
    extra = {},
    status = 200,
  ) =>
    api('post', `/admin/dishes/uploads/${id}/${action}`, admin, {
      revision: (await own(id)).revision,
      ...extra,
    }).expect(status);
  const create = async (extra: object = {}) => {
    const dto = {
      clientRequestId: randomUUID(),
      name: `营养验收-${randomUUID()}`,
      price: 9,
      canteenId: canteen.id,
      canteenName: canteen.name,
      availableMealTime: ['lunch'],
      ...extra,
    };
    const res = await api('post', '/dishes/upload', user, dto).expect(201);
    uploads.push(res.body.data.id);
    return { id: res.body.data.id as string, dto };
  };
  const contribute = async (
    id: string,
    values: object,
    fields = Object.keys(values),
  ) => {
    const res = await api('post', '/dishes/upload', user, {
      targetDishId: id,
      targetDishUpdatedAt: (await read(id)).updatedAt,
      changedFields: fields,
      ...values,
    }).expect(201);
    uploads.push(res.body.data.id);
    return res.body.data.id as string;
  };
  const publish = async (nutrition: object) => {
    const draft = await create(nutrition);
    await decide(draft.id, 'approve');
    const id: string = (await own(draft.id)).approvedDishId;
    dishes.push(id);
    return id;
  };
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
    prisma = app.get(PrismaService);
    const login = await api('post', '/auth/wechat/login', '', {
      code: 'baseline_user_code_placeholder',
    }).expect(200);
    user = login.body.data.token.accessToken;
    const manager = await api('post', '/auth/admin/login', '', {
      username: 'testadmin',
      password: 'password123',
    }).expect(200);
    admin = manager.body.data.token.accessToken;
    canteen = await prisma.canteen.findFirstOrThrow();
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.dishUpload.deleteMany({ where: { id: { in: uploads } } });
      await prisma.dish.deleteMany({ where: { id: { in: dishes } } });
    }
    await app?.close();
  });

  it('validates and publishes user nutrition through editing, rejection, resubmission, revoke and reapproval', async () => {
    const record = await create({
      calories: 0,
      protein: 18.25,
      carbohydrate: null,
      fat: 4,
    });
    expect(await own(record.id)).toMatchObject({
      calories: 0,
      protein: 18.25,
      carbohydrate: null,
      fat: 4,
    });
    const history = (
      await api('get', '/user/uploads?page=1&pageSize=50', user).expect(200)
    ).body.data.items;
    expect(history.find((item: any) => item.id === record.id)).toMatchObject({
      calories: 0,
      protein: 18.25,
      carbohydrate: null,
      fat: 4,
    });
    for (const value of [-1, '12', 'Infinity']) {
      await api('post', '/dishes/upload', user, {
        ...record.dto,
        clientRequestId: randomUUID(),
        calories: value,
      }).expect(400);
      await api('put', `/user/uploads/${record.id}`, user, {
        ...record.dto,
        revision: 1,
        calories: value,
      }).expect(400);
    }
    await api('post', '/dishes/upload', user, {
      ...record.dto,
      clientRequestId: randomUUID(),
      approvedDishId: 'forbidden',
    }).expect(400);
    await api('post', '/dishes/upload', user, {
      targetDishId: 'dish',
      changedFields: ['status'],
      status: 'online',
    }).expect(400);
    await api('post', '/dishes/upload', user, {
      ...record.dto,
      protein: 19,
    }).expect(409);
    await api('put', `/user/uploads/${record.id}`, user, {
      ...record.dto,
      revision: 1,
      protein: 0,
    }).expect(200);
    await api('post', `/admin/dishes/uploads/${record.id}/reject`, admin, {
      revision: 2,
      reason: '核对分量',
    }).expect(200);
    let draft = await own(record.id);
    expect(draft).toMatchObject({
      calories: 0,
      protein: 0,
      status: 'rejected',
    });
    await api('put', `/user/uploads/${record.id}`, user, {
      ...record.dto,
      revision: draft.revision,
      carbohydrate: 22.5,
    }).expect(200);
    draft = await own(record.id);
    await api('patch', `/admin/dishes/uploads/${record.id}`, admin, {
      revision: draft.revision,
      protein: 20,
      fat: null,
    }).expect(200);
    await api('post', `/admin/dishes/uploads/${record.id}/approve`, admin, {
      revision: draft.revision,
    }).expect(409);
    await decide(record.id, 'approve');
    const published = await own(record.id);
    const id = published.approvedDishId;
    dishes.push(id);
    expect(await read(id)).toMatchObject({
      calories: 0,
      protein: 20,
      carbohydrate: 22.5,
      fat: null,
    });
    await api('put', `/admin/dishes/${id}`, user, { calories: 99 }).expect(403);
    await api('put', `/user/uploads/${record.id}`, user, {
      ...record.dto,
      revision: published.revision,
    }).expect(400);
    await decide(record.id, 'revoke');
    await api('patch', `/admin/dishes/uploads/${record.id}`, admin, {
      revision: (await own(record.id)).revision,
      protein: 0,
    }).expect(200);
    await decide(record.id, 'approve');
    expect((await own(record.id)).approvedDishId).toBe(id);
    expect(await read(id)).toMatchObject({
      calories: 0,
      protein: 0,
      carbohydrate: 22.5,
      fat: null,
    });
    const notifications = await prisma.notification.findMany({
      where: { targetId: record.id },
    });
    expect(notifications.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        'upload_approved',
        'upload_rejected',
        'upload_revoked',
      ]),
    );
  });

  it('applies declared nutrition fields and safely rejects changed approval and revocation baselines', async () => {
    const id = await publish({
      calories: 200,
      protein: 20,
      carbohydrate: 30,
      fat: 10,
    });
    const unrelated = await contribute(
      id,
      { description: '补充分量', calories: null },
      ['description'],
    );
    await decide(unrelated, 'approve');
    expect(await read(id)).toMatchObject({
      calories: 200,
      protein: 20,
      carbohydrate: 30,
      fat: 10,
    });
    const correction = await contribute(id, { calories: 0, protein: null });
    expect((await own(correction)).baseSnapshot).toMatchObject({
      calories: 200,
      protein: 20,
    });
    expect(await read(id)).toMatchObject({ calories: 200, protein: 20 });
    await decide(correction, 'approve');
    expect(await read(id)).toMatchObject({
      calories: 0,
      protein: null,
      carbohydrate: 30,
      fat: 10,
    });
    await decide(correction, 'revoke');
    expect(await read(id)).toMatchObject({ calories: 200, protein: 20 });
    await decide(correction, 'approve');
    const conflict = await contribute(id, { fat: 0 });
    await api('put', `/admin/dishes/${id}`, admin, { fat: 9 }).expect(200);
    await decide(conflict, 'approve', {}, 409);
    await api('put', `/admin/dishes/${id}`, admin, { calories: 250 }).expect(
      200,
    );
    await decide(correction, 'revoke', {}, 409);
    expect(await read(id)).toMatchObject({ calories: 250, fat: 9 });
  });

  it('merges and rolls back selected nutrition without clearing unselected values, and retains drafts after deletion', async () => {
    const id = await publish({
      calories: 300,
      protein: 20,
      carbohydrate: 30,
      fat: 10,
    });
    const blank = await create({ description: '补充配料' });
    await decide(blank.id, 'approve', {
      mergeDishId: id,
      mergeDishUpdatedAt: (await read(id)).updatedAt,
      mergeFields: ['description'],
    });
    expect(await read(id)).toMatchObject({
      calories: 300,
      protein: 20,
      carbohydrate: 30,
      fat: 10,
    });
    const duplicate = await create({ calories: 0, protein: null });
    await decide(duplicate.id, 'approve', {
      mergeDishId: id,
      mergeDishUpdatedAt: (await read(id)).updatedAt,
      mergeFields: ['calories', 'protein'],
    });
    expect(await read(id)).toMatchObject({
      calories: 0,
      protein: null,
      carbohydrate: 30,
      fat: 10,
    });
    await decide(duplicate.id, 'revoke');
    expect(await read(id)).toMatchObject({
      calories: 300,
      protein: 20,
      carbohydrate: 30,
      fat: 10,
    });
    await decide(duplicate.id, 'approve');
    await api('put', `/admin/dishes/${id}`, admin, { fat: 9 }).expect(200);
    await decide(duplicate.id, 'revoke');
    expect(await read(id)).toMatchObject({
      calories: 300,
      protein: 20,
      fat: 9,
    });
    await decide(duplicate.id, 'approve');
    await api('delete', `/admin/dishes/${id}`, admin).expect(200);
    expect(await own(duplicate.id)).toMatchObject({
      calories: 0,
      protein: null,
      approvedDishId: null,
    });
    await decide(duplicate.id, 'revoke');
    await decide(duplicate.id, 'approve', {}, 404);
  });
});
