import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { MealTime } from '@/common/enums';

describe('MealPlansController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testUserId: string;
  let testDishId1: string;
  let testDishId2: string;
  let testMealPlanId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // 获取测试用户登录token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });

    userAccessToken = loginResponse.body.data.token.accessToken;
    testUserId = loginResponse.body.data.user.id;

    // 获取测试菜品ID
    const dish1 = await prisma.dish.findFirst({ where: { name: '宫保鸡丁' } });
    testDishId1 = dish1?.id || '';
    const dish2 = await prisma.dish.findFirst({ where: { name: '清蒸鲈鱼' } });
    testDishId2 = dish2?.id || '';
  });

  afterAll(async () => {
    // 清理测试过程中创建的 meal plans
    await prisma.mealPlan.deleteMany({ where: { userId: testUserId } });
    await app.close();
  });

  describe('/meal-plans (GET)', () => {
    it('should return meal plans for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/meal-plans')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer()).get('/meal-plans');

      expect(response.status).toBe(401);
    });
  });

  describe('/meal-plans (POST)', () => {
    it('should create a meal plan', async () => {
      const createData = {
        startDate: '2025-12-01',
        endDate: '2025-12-01',
        mealTime: MealTime.BREAKFAST,
        dishes: [testDishId1, testDishId2],
      };

      const response = await request(app.getHttpServer())
        .post('/meal-plans')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createData);

      expect(response.status).toBe(201);
      expect(response.body.code).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.dishes).toEqual([testDishId1, testDishId2]);

      testMealPlanId = response.body.data.id;
    });

    it('should deduplicate dishes', async () => {
      const createData = {
        startDate: '2023-12-02',
        endDate: '2023-12-02',
        mealTime: MealTime.LUNCH,
        dishes: [testDishId1, testDishId1, testDishId2],
      };

      const response = await request(app.getHttpServer())
        .post('/meal-plans')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(createData);

      expect(response.status).toBe(201);
      expect(response.body.data.dishes).toEqual([testDishId1, testDishId2]);
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        startDate: 'invalid-date',
        endDate: '2023-12-01',
        mealTime: MealTime.BREAKFAST,
        dishes: [],
      };

      const response = await request(app.getHttpServer())
        .post('/meal-plans')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('/meal-plans/:id (PATCH)', () => {
    it('should update a meal plan', async () => {
      const updateData = {
        dishes: [testDishId2],
      };

      const response = await request(app.getHttpServer())
        .patch(`/meal-plans/${testMealPlanId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data.dishes).toEqual([testDishId2]);
    });

    it('should return 404 for non-existent meal plan', async () => {
      const response = await request(app.getHttpServer())
        .patch('/meal-plans/invalid-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ dishes: [] });

      expect(response.status).toBe(404);
    });
  });

  describe('/meal-plans/:id (DELETE)', () => {
    it('should delete a meal plan', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/meal-plans/${testMealPlanId}`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
    });

    it('should return 404 for non-existent meal plan', async () => {
      const response = await request(app.getHttpServer())
        .delete('/meal-plans/invalid-id')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(404);
    });
  });
});
