import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { ToolRegistryService } from '@/ai-chat/tools/tool-registry.service';
import { PromptBuilder } from '@/ai-chat/utils/prompt-builder.util';

describe('Offline dish search and recommendation boundary', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tools: ToolRegistryService;
  let recommendation: RecommendationService;
  let token: string;
  let userId: string;
  let canteenId: string;
  const prefix = `offline-boundary-${Date.now()}`;
  const ids: string[] = [];
  const context = () => ({
    userId,
    sessionId: 'offline-boundary',
    scene: 'general_chat',
  });
  const body = (filter = {}, page = 1) => ({
    filter,
    search: { keyword: prefix },
    sort: { field: 'price', order: 'asc' },
    pagination: { page, pageSize: 2 },
  });
  const list = (filter = {}, page = 1, authenticated = true) => {
    const query = request(app.getHttpServer()).post('/dishes');
    if (authenticated) query.set('Authorization', `Bearer ${token}`);
    return query.send(body(filter, page)).expect(200);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidUnknownValues: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    tools = app.get(ToolRegistryService);
    recommendation = app.get(RecommendationService);
    const login = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' })
      .expect(200);
    token = login.body.data.token.accessToken;
    userId = login.body.data.user.id;
    const canteen = await prisma.canteen.findFirstOrThrow();
    canteenId = canteen.id;
    for (let i = 1; i <= 6; i++) {
      const dish = await prisma.dish.create({
        data: {
          name: `${prefix}-${i}`,
          price: i,
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          canteenId,
          canteenName: canteen.name,
          windowName: '测试窗口',
          availableMealTime: ['lunch'],
          status: i % 2 === 0 ? 'offline' : 'online',
          averageRating: 5,
          reviewCount: 100 + i,
        },
      });
      ids.push(dish.id);
    }
  }, 60_000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      await prisma.browseHistory.deleteMany({ where: { dishId: { in: ids } } });
      await prisma.dish.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('applies offline filtering before ordering, pagination and count through the strict HTTP pipe', async () => {
    const first = (await list({ status: 'offline' })).body.data;
    const second = (await list({ status: 'offline' }, 2)).body.data;
    expect(first.items.map((dish) => dish.id)).toEqual([ids[1], ids[3]]);
    expect(second.items.map((dish) => dish.id)).toEqual([ids[5]]);
    expect(first.meta).toMatchObject({
      total: 3,
      totalPages: 2,
      page: 1,
      pageSize: 2,
    });
    expect(second.meta).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    expect(first.items.every((dish) => dish.status === 'offline')).toBe(true);
    expect((await list()).body.data.items.map((dish) => dish.id)).toEqual([
      ids[0],
      ids[2],
    ]);
    expect((await list({ includeOffline: true })).body.data.meta.total).toBe(6);
    expect(
      (await list({ includeOffline: true, status: 'online' })).body.data.meta
        .total,
    ).toBe(3);
  });

  it('limits guests to online data, including explicit offline and legacy includeOffline requests', async () => {
    expect(
      (await list({ status: 'offline' }, 1, false)).body.data,
    ).toMatchObject({ items: [], meta: { total: 0 } });
    const guest = (await list({ includeOffline: true }, 1, false)).body.data;
    expect(guest.meta.total).toBe(3);
    expect(guest.items.every((dish) => dish.status === 'online')).toBe(true);
    await request(app.getHttpServer()).get(`/dishes/${ids[1]}`).expect(404);
    const batch = await request(app.getHttpServer())
      .post('/dishes/by-ids')
      .send({ ids })
      .expect(200);
    expect(
      batch.body.data.items.every((dish) => dish.status === 'online'),
    ).toBe(true);
  });

  it('validates list status without expanding the recommendation contract', async () => {
    await request(app.getHttpServer())
      .post('/dishes')
      .set('Authorization', `Bearer ${token}`)
      .send(body({ status: 'archived' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/dishes/recommendations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filter: { status: 'offline' },
        pagination: { page: 1, pageSize: 10 },
      })
      .expect(400);
    await expect(
      tools.executeTool(
        'search_dishes',
        { keyword: '', status: 'archived' },
        context(),
      ),
    ).rejects.toThrow('工具参数无效');
    await expect(
      tools.executeTool(
        'recommend_dishes',
        { mealTime: 'lunch', status: 'offline' },
        context(),
      ),
    ).rejects.toThrow('工具参数无效');
  });

  it('returns offline dishes only via an explicit search status, with status preserved in display cards', async () => {
    const defaults = await tools.executeTool(
      'search_dishes',
      { keyword: prefix },
      context(),
    );
    expect(defaults).toHaveLength(3);
    expect(defaults.every((dish) => dish.status === 'online')).toBe(true);
    const offline = await tools.executeTool(
      'search_dishes',
      {
        keyword: prefix,
        status: 'offline',
        sortField: 'price',
        sortOrder: 'asc',
        limit: 2,
      },
      context(),
    );
    expect(offline.map((dish) => dish.id)).toEqual([ids[1], ids[3]]);
    const cards = await tools.executeTool(
      'display_content',
      {
        type: 'dish',
        ids: offline.map((dish) => dish.id),
        includeOffline: true,
      },
      context(),
    );
    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.dish.status === 'offline')).toBe(true);
    const guest = await tools.executeTool(
      'search_dishes',
      { keyword: prefix, status: 'offline' },
      { ...context(), userId: undefined } as any,
    );
    expect(guest).toEqual([]);
  });

  it('keeps the default recommendation HTTP response within online dishes', async () => {
    const response = await request(app.getHttpServer())
      .post('/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filter: { canteenId: [canteenId] },
        pagination: { page: 1, pageSize: 100 },
      })
      .expect(200);
    const recommendedIds = response.body.data.items.map(
      (dish: { id: string }) => dish.id,
    );
    expect(recommendedIds.length).toBeGreaterThan(0);
    expect(recommendedIds.some((id: string) => ids.includes(id))).toBe(true);
    const current = await prisma.dish.findMany({
      where: { id: { in: recommendedIds } },
      select: { status: true },
    });
    expect(current).toHaveLength(recommendedIds.length);
    expect(current.every((dish) => dish.status === 'online')).toBe(true);
  }, 30_000);

  it('keeps real recommendation and popular tools within online dishes', async () => {
    const recommended = await tools.executeTool(
      'recommend_dishes',
      { mealTime: 'lunch', canteenId, limit: 100 },
      context(),
    );
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.every((dish) => dish.status === 'online')).toBe(true);
    expect(recommended.some((dish) => ids.includes(dish.id))).toBe(true);
    const popular = await tools.executeTool(
      'get_popular_dishes',
      { canteenId, limit: 100 },
      context(),
    );
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.every((dish) => dish.status === 'online')).toBe(true);
  }, 30_000);

  it('drops real dishes taken offline after recommendation recall and keeps them in personal history', async () => {
    const original = recommendation.getRecommendations.bind(recommendation);
    let recalledIds: string[] = [];
    const spy = jest
      .spyOn(recommendation, 'getRecommendations')
      .mockImplementationOnce(async (...args) => {
        const response = await original(...args);
        recalledIds = response.data.items.map((dish) => dish.id);
        expect(recalledIds.length).toBeGreaterThan(0);
        await prisma.dish.updateMany({
          where: { id: { in: recalledIds } },
          data: { status: 'offline' },
        });
        return response;
      });
    try {
      const result = await tools.executeTool(
        'recommend_dishes',
        { mealTime: 'lunch', canteenId, limit: 100 },
        context(),
      );
      expect(result).toEqual([]);
      await request(app.getHttpServer())
        .get(`/dishes/${recalledIds[0]}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const history = await tools.executeTool(
        'get_my_history',
        { limit: 100 },
        context(),
      );
      expect(history.some((dish) => dish.dishId === recalledIds[0])).toBe(true);
    } finally {
      spy.mockRestore();
      await prisma.dish.updateMany({
        where: { id: { in: recalledIds } },
        data: { status: 'online' },
      });
    }
  }, 30_000);

  it.each(['general_chat', 'dish_critic', 'meal_planner'])(
    'documents the explicit offline search boundary for %s',
    (scene) => {
      const prompt = PromptBuilder.getSystemPrompt(scene);
      expect(prompt).toContain('status="offline"');
      expect(prompt).toContain('当前用餐推荐与新建计划使用 status="online"');
    },
  );
});
