import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('Saved dish summaries (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let canteenId: string;
  let dishId: string;
  let token: string;
  let otherId: string;
  let otherToken: string;
  let planId: string;
  const own = (path: string, auth = token) =>
    request(app.getHttpServer()).get(path).auth(auth, { type: 'bearer' });
  const publicPlans = () =>
    request(app.getHttpServer()).get(`/users/${userId}/meal-plans`);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    userId = (await prisma.user.create({ data: { nickname: '摘要测试用户' } }))
      .id;
    otherId = (await prisma.user.create({ data: { nickname: '其他用户' } })).id;
    const jwt = new JwtService();
    const sign = (sub: string) =>
      jwt.sign(
        { sub, type: 'user', tokenUse: 'access' },
        {
          secret: app.get(ConfigService).getOrThrow('JWT_SECRET'),
          expiresIn: '1h',
        },
      );
    token = sign(userId);
    otherToken = sign(otherId);
    await prisma.studentVerification.create({
      data: {
        userId,
        method: 'manual',
        status: 'VERIFIED',
        expiresAt: new Date('2099-12-31'),
      },
    });
    await prisma.userSetting.upsert({
      where: { userId },
      create: { userId, showMealPlans: true },
      update: { showMealPlans: true },
    });
    const canteen = await prisma.canteen.create({
      data: {
        name: '摘要测试食堂',
        images: [],
        openingHours: [],
      },
    });
    canteenId = canteen.id;
    dishId = (
      await prisma.dish.create({
        data: {
          name: '摘要测试菜品',
          images: [],
          tags: [],
          ingredients: [],
          allergens: [],
          canteenId,
          canteenName: canteen.name,
          windowName: '测试窗口',
          price: 10.01,
          priceUnit: '元/100g',
          status: 'online',
          availableMealTime: ['lunch'],
          calories: 0,
          protein: null,
          carbohydrate: 12.5,
          fat: null,
        },
      })
    ).id;
    await request(app.getHttpServer())
      .post(`/dishes/${dishId}/favorite`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    await own(`/dishes/${dishId}`).expect(200);
    const saved = await request(app.getHttpServer())
      .post('/meal-plans')
      .auth(token, { type: 'bearer' })
      .send({
        startDate: '2099-10-05',
        endDate: '2099-10-05',
        mealTime: 'lunch',
        dishes: [dishId],
        isPublic: true,
      })
      .expect(201);
    planId = saved.body.data.id;
  });
  afterAll(async () => {
    if (userId)
      await prisma.user.deleteMany({
        where: { id: { in: [userId, otherId] } },
      });
    if (canteenId)
      await prisma.canteen.deleteMany({ where: { id: canteenId } });
    await app?.close();
  });

  it.each([
    { price: 10.01, priceUnit: '元/100g', status: 'offline' },
    { price: 0, priceUnit: null, status: 'online' },
  ])(
    'keeps current source fields in favorites, history and public saved plans: %j',
    async (source) => {
      await prisma.dish.update({ where: { id: dishId }, data: source });
      const detail = (await own(`/dishes/${dishId}`).expect(200)).body.data;
      expect(detail).toMatchObject(source);
      const nutrition = {
        calories: 0,
        protein: null,
        carbohydrate: 12.5,
        fat: null,
      };
      for (const path of ['/user/favorites', '/user/history']) {
        const response = await own(path).expect(200);
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0]).toMatchObject({
          dishId,
          dishPrice: detail.price,
          priceUnit: detail.priceUnit,
          status: detail.status,
          ...nutrition,
        });
      }
      const response = await publicPlans().expect(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].dishes).toHaveLength(1);
      expect(response.body.data.items[0].dishes[0]).toMatchObject({
        id: dishId,
        ...source,
        ...nutrition,
      });
      const batch = await request(app.getHttpServer())
        .post('/dishes/by-ids')
        .auth(token, { type: 'bearer' })
        .send({ ids: [dishId] })
        .expect(200);
      expect(batch.body.data.items).toHaveLength(1);
      expect(batch.body.data.items[0]).toMatchObject({
        id: dishId,
        ...source,
        ...nutrition,
      });
      const guest = await request(app.getHttpServer())
        .post('/dishes/by-ids')
        .send({ ids: [dishId] })
        .expect(200);
      expect(guest.body.data.items).toHaveLength(
        source.status === 'online' ? 1 : 0,
      );
      const saved = await own('/meal-plans').expect(200);
      expect(saved.body.data.items[0].dishes).toEqual([dishId]);
    },
  );

  it('retains authenticated ownership and public visibility boundaries', async () => {
    for (const path of ['/user/favorites', '/user/history', '/meal-plans']) {
      await request(app.getHttpServer()).get(path).expect(401);
      expect((await own(path, otherToken).expect(200)).body.data.items).toEqual(
        [],
      );
    }
    await prisma.mealPlan.update({
      where: { id: planId },
      data: { isPublic: false },
    });
    expect((await publicPlans().expect(200)).body.data.items).toEqual([]);
    await prisma.mealPlan.update({
      where: { id: planId },
      data: { isPublic: true },
    });
    await prisma.userSetting.update({
      where: { userId },
      data: { showMealPlans: false },
    });
    expect((await publicPlans().expect(200)).body.data.items).toEqual([]);
    await prisma.userSetting.update({
      where: { userId },
      data: { showMealPlans: true },
    });
    await prisma.studentVerification.update({
      where: { userId },
      data: { expiresAt: new Date(0) },
    });
    expect((await publicPlans().expect(200)).body.data.items).toEqual([]);
    await request(app.getHttpServer())
      .get(`/users/${userId}/meal-plans?unexpected=true`)
      .expect(400);
  });
});
