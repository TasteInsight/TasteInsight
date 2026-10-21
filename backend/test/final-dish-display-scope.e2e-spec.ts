import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import { ToolRegistryService } from '@/ai-chat/tools/tool-registry.service';
import { PromptBuilder } from '@/ai-chat/utils/prompt-builder.util';

describe('Final dish display scope', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tools: ToolRegistryService;
  let token: string;
  let admin: string;
  let userId: string;
  let canteenId: string;
  const prefix = `final-display-${Date.now()}`;
  const ids: string[] = [];
  const context = () => ({
    userId,
    sessionId: 'final-display',
    scene: 'general_chat',
  });
  const status = (value: 'online' | 'offline') =>
    request(app.getHttpServer())
      .patch(`/admin/dishes/${ids[0]}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: value })
      .expect(200);
  const display = (
    dishIds: string[],
    includeOffline?: boolean,
    guest = false,
  ) =>
    tools.executeTool(
      'display_content',
      {
        type: 'dish',
        ids: dishIds,
        ...(includeOffline !== undefined ? { includeOffline } : {}),
      },
      guest ? ({ ...context(), userId: undefined } as any) : context(),
    );

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
    tools = app.get(ToolRegistryService);
    const login = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' })
      .expect(200);
    token = login.body.data.token.accessToken;
    userId = login.body.data.user.id;
    admin = (
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'testadmin', password: 'password123' })
        .expect(200)
    ).body.data.token.accessToken;
    const canteen = await prisma.canteen.findFirstOrThrow();
    canteenId = canteen.id;
    for (let i = 0; i < 4; i++) {
      const dish = await prisma.dish.create({
        data: {
          name: `${prefix}-${i}`,
          price: 17.31 + i / 100,
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          canteenId,
          canteenName: canteen.name,
          windowName: '展示测试窗口',
          availableMealTime: ['lunch'],
          status: i === 2 ? 'offline' : 'online',
        },
      });
      ids.push(dish.id);
    }
    await prisma.dish.delete({ where: { id: ids[3] } });
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.favoriteDish.deleteMany({ where: { dishId: { in: ids } } });
      await prisma.browseHistory.deleteMany({ where: { dishId: { in: ids } } });
      await prisma.dish.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('rechecks online status when recommendation results become final display cards after an admin HTTP change', async () => {
    const recommended = await tools.executeTool(
      'recommend_dishes',
      {
        mealTime: 'lunch',
        canteenId,
        priceMin: 17.31,
        priceMax: 17.31,
        limit: 100,
      },
      context(),
    );
    expect(recommended.map((dish) => dish.id)).toEqual([ids[0]]);
    expect(recommended[0].status).toBe('online');
    try {
      await status('offline');
      const read = await request(app.getHttpServer())
        .post('/dishes/by-ids')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [ids[0]] })
        .expect(200);
      expect(read.body.data.items[0].status).toBe('offline');
      expect(await display(recommended.map((dish) => dish.id))).toEqual([]);
    } finally {
      await status('online');
    }
  }, 30_000);

  it('requires explicit offline display after an explicit offline search and preserves source status', async () => {
    const offline = await tools.executeTool(
      'search_dishes',
      { keyword: prefix, status: 'offline' },
      context(),
    );
    expect(offline.map((dish) => dish.id)).toEqual([ids[2]]);
    expect(await display(offline.map((dish) => dish.id))).toEqual([]);
    const cards = await display(
      offline.map((dish) => dish.id),
      true,
    );
    expect(cards.map((card) => card.dish.id)).toEqual([ids[2]]);
    expect(cards[0].dish).toMatchObject({
      status: 'offline',
      name: `${prefix}-2`,
    });
  });

  it('preserves personal history and favorites through explicit historical display', async () => {
    await request(app.getHttpServer())
      .get(`/dishes/${ids[2]}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/dishes/${ids[2]}/favorite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    for (const tool of ['get_my_history', 'get_my_favorites']) {
      const records = await tools.executeTool(tool, { limit: 100 }, context());
      const historicalIds = records
        .filter((record) => record.dishId === ids[2])
        .map((record) => record.dishId);
      expect(historicalIds).toEqual([ids[2]]);
      expect(await display(historicalIds)).toEqual([]);
      const cards = await display(historicalIds, true);
      expect(cards[0].dish).toMatchObject({ id: ids[2], status: 'offline' });
    }
  });

  it('preserves input order, omits genuinely deleted IDs and keeps the guest read scope with either flag', async () => {
    const mixed = [ids[2], ids[1], ids[3], ids[0]];
    expect((await display(mixed)).map((card) => card.dish.id)).toEqual([
      ids[1],
      ids[0],
    ]);
    expect((await display(mixed, false)).map((card) => card.dish.id)).toEqual([
      ids[1],
      ids[0],
    ]);
    expect((await display(mixed, true)).map((card) => card.dish.id)).toEqual([
      ids[2],
      ids[1],
      ids[0],
    ]);
    for (const flag of [false, true]) {
      const guestCards = await display(mixed, flag, true);
      expect(guestCards.map((card) => card.dish.id)).toEqual([ids[1], ids[0]]);
      expect(guestCards.every((card) => card.dish.status === 'online')).toBe(
        true,
      );
    }
    const guest = await request(app.getHttpServer())
      .post('/dishes/by-ids')
      .send({ ids: mixed })
      .expect(200);
    expect(guest.body.data.items.map((dish) => dish.id)).toEqual([
      ids[1],
      ids[0],
    ]);
  });

  it.each([
    { type: 'dish', ids: [], includeOffline: true },
    { type: 'dish', ids: ['one', 'one'], includeOffline: true },
    { type: 'dish', ids: ['one'], includeOffline: 'true' },
    { type: 'dish', ids: ['one'], includeOffline: null },
    { type: 'dish', ids: ['one'], data: 'invalid' },
    { type: 'dish', ids: ['one'], data: [] },
    { type: 'dish', ids: ['one'], unknown: true },
  ])('validates final display tool input %j', async (params) => {
    await expect(
      tools.executeTool('display_content', params, context()),
    ).rejects.toThrow('工具参数无效');
  });

  it('keeps canteen display and meal-plan validation on their existing paths regardless of the dish flag', async () => {
    const canteens = await tools.executeTool(
      'display_content',
      { type: 'canteen', ids: [canteenId] },
      context(),
    );
    expect(
      await tools.executeTool(
        'display_content',
        { type: 'canteen', ids: [canteenId], includeOffline: true },
        context(),
      ),
    ).toEqual(canteens);
    const draft = await tools.executeTool(
      'create_meal_plan',
      {
        startDate: '2099-10-05',
        endDate: '2099-10-05',
        mealTime: 'lunch',
        dishIds: [ids[0]],
      },
      context(),
    );
    const original = await tools.executeTool(
      'display_content',
      { type: 'meal_plan', data: draft },
      context(),
    );
    expect(
      await tools.executeTool(
        'display_content',
        { type: 'meal_plan', data: draft, includeOffline: true },
        context(),
      ),
    ).toEqual(original);
    await expect(
      tools.executeTool(
        'display_content',
        { type: 'meal_plan', data: { unexpected: true }, includeOffline: true },
        context(),
      ),
    ).rejects.toThrow('计划草稿');
    try {
      await status('offline');
      await expect(
        tools.executeTool(
          'display_content',
          { type: 'meal_plan', data: draft, includeOffline: true },
          context(),
        ),
      ).rejects.toThrow('供应');
    } finally {
      await status('online');
    }
  });

  it.each(['general_chat', 'dish_critic', 'meal_planner'])(
    'carries the final display scope policy into %s',
    (scene) => {
      const prompt = PromptBuilder.getSystemPrompt(scene);
      expect(prompt).toContain('display_content');
      expect(prompt).toContain('includeOffline=true');
      expect(prompt).toContain('浏览历史或收藏');
    },
  );
});
