import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { ToolRegistryService } from '@/ai-chat/tools/tool-registry.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { CACHE_CONFIG } from '@/recommendation/constants/recommendation.constants';
import { campusDate, storedMealDate } from '@/common/utils/campus-date';
const range = (startDate: string, endDate = startDate) => ({
  startDate,
  endDate,
});

describe('Supply dates and AI meal-plan confirmation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tools: ToolRegistryService;
  let userId: string;
  let dishId: string;
  let otherId: string;
  let token: string;
  const dates = {
    startDate: '2099-10-05',
    endDate: '2099-10-07',
    mealTime: 'lunch',
  };
  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/meal-plans')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const draft = (extra = {}) =>
    tools.executeTool(
      'create_meal_plan',
      {
        ...dates,
        dishIds: [dishId],
        totalBudget: 10,
        ...extra,
      },
      { userId, sessionId: 'validity', scene: 'meal_planner' },
    );

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
    tools = app.get(ToolRegistryService);
    const user = await prisma.user.create({
      data: { nickname: '规划验收用户' },
    });
    userId = user.id;
    token = new JwtService().sign(
      { sub: userId, type: 'user', tokenUse: 'access' },
      {
        secret: app.get(ConfigService).getOrThrow('JWT_SECRET'),
        expiresIn: '1h',
      },
    );
    const canteens = await prisma.canteen.findMany({ take: 2 });
    expect(canteens).toHaveLength(2);
    const create = (canteen: (typeof canteens)[number]) =>
      prisma.dish.create({
        data: {
          name: '规划验收菜品',
          tags: ['规划验收'],
          images: [],
          ingredients: ['鸡肉'],
          allergens: ['花生'],
          price: 10,
          canteenId: canteen.id,
          canteenName: canteen.name,
          windowName: '验收窗口',
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });
    dishId = (await create(canteens[0])).id;
    otherId = (await create(canteens[1])).id;
  });

  beforeEach(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { allergens: [] },
    });
    await prisma.userPreference.deleteMany({ where: { userId } });
    await prisma.dish.update({
      where: { id: dishId },
      data: {
        status: 'online',
        availableMealTime: ['lunch'],
        price: 10,
        availableDates: Prisma.DbNull,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.delete({ where: { id: userId } });
      await prisma.dish.deleteMany({
        where: { id: { in: [dishId, otherId] } },
      });
    }
    await app?.close();
  });

  it('accepts inclusive endpoints and a union of adjacent ranges, and rejects a gap', async () => {
    await prisma.dish.update({
      where: { id: dishId },
      data: {
        availableDates: [
          range('2099-10-06', '2099-10-07'),
          range('2099-10-05'),
        ],
      },
    });
    const plan = await draft();
    await post(plan.confirmAction.body).expect(201);
    await prisma.dish.update({
      where: { id: dishId },
      data: { availableDates: [range('2099-10-05'), range('2099-10-07')] },
    });
    await expect(draft()).rejects.toThrow('供应');
    await post(plan.confirmAction.body).expect(201);
  });

  it.each(['offline', 'meal-time', 'supply-dates', 'price', 'price-decrease'])(
    'saves the same dish ID after %s changes',
    async (change) => {
      const plan = await draft();
      const count = await prisma.mealPlan.count({ where: { userId } });
      if (change === 'offline')
        await prisma.dish.update({
          where: { id: dishId },
          data: { status: 'offline' },
        });
      if (change === 'meal-time')
        await prisma.dish.update({
          where: { id: dishId },
          data: { availableMealTime: ['dinner'] },
        });
      if (change === 'supply-dates')
        await prisma.dish.update({
          where: { id: dishId },
          data: { availableDates: [range('2099-10-05')] },
        });
      if (change === 'price')
        await prisma.dish.update({
          where: { id: dishId },
          data: { price: 10.01 },
        });
      if (change === 'price-decrease')
        await prisma.dish.update({ where: { id: dishId }, data: { price: 9 } });
      const response = await post(plan.confirmAction.body).expect(201);
      expect(response.body.data.dishes).toEqual([dishId]);
      expect(await prisma.mealPlan.count({ where: { userId } })).toBe(
        count + 1,
      );
      const current = await request(app.getHttpServer())
        .post('/dishes/by-ids')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [dishId] })
        .expect(200);
      expect(current.body.data.items).toHaveLength(1);
      expect(current.body.data.items[0]).toMatchObject({
        id: dishId,
        ...(change === 'offline' ? { status: 'offline' } : {}),
        ...(change === 'price' ? { price: 10.01 } : {}),
        ...(change === 'price-decrease' ? { price: 9 } : {}),
      });
      if (change !== 'price-decrease')
        await expect(draft()).rejects.toThrow(/供应|预算|忌口/);
    },
  );

  it.each(['allergens', 'avoid-ingredients'])(
    'rejects a pending plan after current %s changes without saving it',
    async (change) => {
      const plan = await draft();
      const count = await prisma.mealPlan.count({ where: { userId } });
      await request(app.getHttpServer())
        .put('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(
          change === 'allergens'
            ? { allergens: ['Peanuts'] }
            : { preferences: { avoidIngredients: ['鸡肉'] } },
        )
        .expect(200);
      const response = await post(plan.confirmAction.body).expect(400);
      expect(response.body.code).toBe('DIETARY_CONFLICT');
      expect(await prisma.mealPlan.count({ where: { userId } })).toBe(count);
      await expect(draft()).rejects.toThrow('忌口');
    },
  );

  it('checks same-canteen intent and allows an explicit cross-canteen draft', async () => {
    await expect(
      draft({ dishIds: [dishId, otherId], totalBudget: 20 }),
    ).rejects.toThrow('同一个食堂');
    const plan = await draft({
      dishIds: [dishId, otherId],
      totalBudget: 20,
      allowCrossCanteen: true,
    });
    await post(plan.confirmAction.body).expect(201);
  });

  it('saves during a concurrent supply update without holding confirmation locks', async () => {
    const plan = await draft();
    let unlock!: () => void;
    let acquired!: () => void;
    const held = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const release = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const writer = prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id: dishId },
        data: { status: 'offline' },
      });
      acquired();
      await release;
    });
    await held;
    try {
      const response = await post(plan.confirmAction.body)
        .timeout({ response: 2000 })
        .expect(201);
      expect(response.body.data.dishes).toEqual([dishId]);
    } finally {
      unlock();
      await writer;
    }
  });

  it('clearly rejects an actually deleted draft dish', async () => {
    const original = await prisma.dish.findUniqueOrThrow({
      where: { id: dishId },
    });
    const temporary = await prisma.dish.create({
      data: {
        name: '删除验收菜品',
        windowName: '验收窗口',
        price: 10,
        canteenId: original.canteenId,
        canteenName: original.canteenName,
        status: 'online',
        availableMealTime: ['lunch'],
      },
    });
    const plan = await draft({ dishIds: [temporary.id] });
    await prisma.dish.delete({ where: { id: temporary.id } });
    const response = await post(plan.confirmAction.body).expect(400);
    expect(response.body.message).toContain('部分菜品已删除');
  });

  it('keeps manual historical creation and existing-plan editing available', async () => {
    await prisma.dish.update({
      where: { id: dishId },
      data: { status: 'offline', availableMealTime: ['dinner'] },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { allergens: ['花生'] },
    });
    const manual = {
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      mealTime: 'breakfast',
      dishes: [dishId],
    };
    const response = await post(manual).expect(201);
    await request(app.getHttpServer())
      .patch(`/meal-plans/${response.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dishes: [dishId, otherId] })
      .expect(200);
    await post({ ...manual, source: 'ai' }).expect(400);
  });

  it('rechecks current exclusions when moving a historical plan into the future without changing dish IDs', async () => {
    const created = await post({
      startDate: '2024-01-01',
      endDate: '2024-01-01',
      mealTime: 'lunch',
      dishes: [dishId],
    }).expect(201);
    const completion = await prisma.mealPlanCompletion.create({
      data: {
        mealPlanId: created.body.data.id,
        date: storedMealDate('2024-01-01'),
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { allergens: ['Peanuts'] },
    });
    const response = await request(app.getHttpServer())
      .patch(`/meal-plans/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(dates)
      .expect(400);
    expect(response.body.code).toBe('DIETARY_CONFLICT');
    const stored = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: created.body.data.id },
    });
    expect(campusDate(stored.endDate)).toBe('2024-01-01');
    expect(
      (
        await prisma.mealPlanDish.findMany({ where: { mealPlanId: stored.id } })
      ).map((row) => row.dishId),
    ).toEqual([dishId]);
    expect(
      await prisma.mealPlanCompletion.findUnique({
        where: { id: completion.id },
      }),
    ).toEqual(completion);
  });

  it.each(['today', 'past-to-today'])(
    'applies current exclusions to a %s plan',
    async (range) => {
      await prisma.user.update({
        where: { id: userId },
        data: { allergens: ['Peanuts'] },
      });
      const today = campusDate();
      const response = await post({
        startDate: range === 'today' ? today : '2024-01-01',
        endDate: today,
        mealTime: 'lunch',
        dishes: [dishId],
      }).expect(400);
      expect(response.body.code).toBe('DIETARY_CONFLICT');
    },
  );

  it.each([null, [], [{ startDate: '2099-10-05', endDate: '2099-10-07' }]])(
    'accepts valid supply configuration %p',
    async (availableDates) => {
      await prisma.dish.update({
        where: { id: dishId },
        data: { availableDates: availableDates ?? Prisma.JsonNull },
      });
      const plan = await draft();
      await post(plan.confirmAction.body).expect(201);
    },
  );

  it('filters unavailable candidates before recommendation paging and exhausts the remaining candidates', async () => {
    await prisma.dish.update({
      where: { id: dishId },
      data: {
        availableDates: [range('2099-10-05'), range('2099-10-07')],
        averageRating: 5,
      },
    });
    const body = {
      filter: { ...dates, mealTime: ['lunch'], excludeDishIds: [] },
      search: { keyword: '规划验收菜品', fields: ['name'] },
      pagination: { page: 1, pageSize: 1 },
    };
    const first = await request(app.getHttpServer())
      .post('/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(200);
    expect(first.body.data.items.map((item) => item.id)).toEqual([otherId]);
    const next = await request(app.getHttpServer())
      .post('/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...body,
        requestId: first.body.data.requestId,
        pagination: { page: 2, pageSize: 1 },
      })
      .expect(200);
    expect(next.body.data.items).toEqual([]);
    expect(next.body.data.meta.total).toBe(0);
  });

  it.each(['personalized', 'similar'])(
    'rechecks supply dates before paginating %s cached candidates',
    async (kind) => {
      await prisma.dish.update({
        where: { id: dishId },
        data: { availableDates: [range('2099-10-05')] },
      });
      const key = `${CACHE_CONFIG.KEY_PREFIX.RECOMMENDATION}${userId}:${kind}:${kind === 'similar' ? 'source-dish' : 'all:all'}`;
      const redis = app.get(RecommendationCacheService).getRedisClient();
      await redis.setex(
        key,
        60,
        JSON.stringify([
          { dish: { id: dishId }, score: 1 },
          { dish: { id: otherId }, score: 0.5 },
        ]),
      );
      const service = app.get(RecommendationService);
      const pagination = { page: 1, pageSize: 1 };
      const result =
        kind === 'similar'
          ? await service.getSimilarDishes('source-dish', pagination, userId)
          : await service.getPersonalizedDishes(userId, { pagination });
      expect(result.items.map((item) => item.dish.id)).toEqual([otherId]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      await redis.del(key);
    },
  );

  it('preserves explicit offline recommendation queries', async () => {
    await prisma.dish.update({
      where: { id: dishId },
      data: { status: 'offline' },
    });
    const response = await request(app.getHttpServer())
      .post('/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filter: { includeOffline: true, tag: ['规划验收'] },
        pagination: { page: 1, pageSize: 10 },
      })
      .expect(200);
    expect(response.body.data.items.some((item) => item.id === dishId)).toBe(
      true,
    );
  });

  it('uses the campus date for recommendations without an explicit interval', async () => {
    const today = campusDate();
    await prisma.dish.update({
      where: { id: dishId },
      data: { availableDates: [range(today)] },
    });
    const result = await tools.executeTool(
      'recommend_dishes',
      { mealTime: 'lunch', limit: 5, tags: ['规划验收'] },
      { userId, sessionId: 'validity', scene: 'meal_planner' },
    );
    expect(result.some((dish) => dish.id === dishId)).toBe(true);
  });

  it('accepts the ID-only confirmation DTO with the production validation pipe', async () => {
    const plan = await draft();
    expect(plan.confirmAction.body).not.toHaveProperty('source');
    expect(plan.confirmAction.body).not.toHaveProperty('constraints');
    const response = await post(plan.confirmAction.body).expect(201);
    expect(response.body.data.dishes).toEqual([dishId]);
  });
});
