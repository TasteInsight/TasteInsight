import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('Administrator-maintained per-serving nutrition (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let uploadId: string;
  let dishId: string;
  let windowId: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' })
      .expect(200);
    token = login.body.data.token.accessToken;
    windowId = (await prisma.window.findFirstOrThrow()).id;
  });
  afterAll(async () => {
    if (uploadId)
      await prisma.dishUpload.deleteMany({ where: { id: uploadId } });
    if (dishId) await prisma.dish.deleteMany({ where: { id: dishId } });
    await app?.close();
  });
  it('publishes, reads, partially updates and clears values through existing authenticated routes', async () => {
    const created = await request(app.getHttpServer())
      .post('/admin/dishes')
      .auth(token, { type: 'bearer' })
      .send({
        name: '营养闭环测试菜品',
        windowId,
        price: 12,
        calories: 0,
        protein: 18.25,
        carbohydrate: null,
      })
      .expect(201);
    uploadId = created.body.data.id;
    expect(created.body.data).toMatchObject({
      calories: 0,
      protein: 18.25,
      carbohydrate: null,
      fat: null,
    });
    await request(app.getHttpServer())
      .post(`/admin/dishes/uploads/${uploadId}/approve`)
      .auth(token, { type: 'bearer' })
      .send({ revision: 1 })
      .expect(200);
    dishId = (
      await prisma.dishUpload.findUniqueOrThrow({ where: { id: uploadId } })
    ).approvedDishId!;
    const read = () =>
      request(app.getHttpServer()).get(`/dishes/${dishId}`).expect(200);
    expect((await read()).body.data).toMatchObject({
      calories: 0,
      protein: 18.25,
      carbohydrate: null,
      fat: null,
    });
    await request(app.getHttpServer())
      .put(`/admin/dishes/${dishId}`)
      .auth(token, { type: 'bearer' })
      .send({ fat: 0, carbohydrate: 24.5 })
      .expect(200);
    expect((await read()).body.data).toMatchObject({
      calories: 0,
      protein: 18.25,
      carbohydrate: 24.5,
      fat: 0,
    });
    await request(app.getHttpServer())
      .put(`/admin/dishes/${dishId}`)
      .auth(token, { type: 'bearer' })
      .send({ calories: null, protein: null, carbohydrate: null, fat: null })
      .expect(200);
    expect((await read()).body.data).toMatchObject({
      calories: null,
      protein: null,
      carbohydrate: null,
      fat: null,
    });
    for (const value of [-1, '123', 'Infinity']) {
      await request(app.getHttpServer())
        .put(`/admin/dishes/${dishId}`)
        .auth(token, { type: 'bearer' })
        .send({ calories: value })
        .expect(400);
    }
    await request(app.getHttpServer())
      .put(`/admin/dishes/${dishId}`)
      .send({ calories: 99 })
      .expect(401);
    expect(
      (await prisma.dish.findUniqueOrThrow({ where: { id: dishId } })).calories,
    ).toBeNull();
  });
});
