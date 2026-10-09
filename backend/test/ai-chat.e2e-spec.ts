import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Dish } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { ToolRegistryService } from '../src/ai-chat/tools/tool-registry.service';
import type { ToolContext } from '../src/ai-chat/tools/base-tool.interface';
import { AIConfigService } from '../src/ai-chat/services/ai-config.service';
import { OpenAIProviderService } from '../src/ai-chat/services/ai-provider/openai-provider.service';
import { MockAIProviderService } from '../src/ai-chat/services/ai-provider/mock-ai-provider.service';
import { ChatRequestDto } from '../src/ai-chat/dto/chat.dto';

function requestChatStream(
  app: INestApplication,
  token: string,
  sessionId: string,
  body: ChatRequestDto,
) {
  return request(app.getHttpServer())
    .post(`/ai/sessions/${sessionId}/chat/stream`)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'text/event-stream')
    .send(body)
    .buffer(true)
    .expect(200)
    .expect('Content-Type', /text\/event-stream/);
}

describe('AI Chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Use Mock Provider if USE_MOCK_AI_PROVIDER environment variable is set to 'true' or '1'
    // Default to false (use real OpenAI API, requires valid API key)
    const useMockAIProvider =
      process.env.USE_MOCK_AI_PROVIDER === 'true' ||
      process.env.USE_MOCK_AI_PROVIDER === '1';

    let moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    // Override with Mock Provider if enabled
    if (useMockAIProvider) {
      moduleBuilder = moduleBuilder
        .overrideProvider(OpenAIProviderService)
        .useClass(MockAIProviderService);
    }

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');

    prisma = app.get<PrismaService>(PrismaService);

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({
        code: 'baseline_user_code_placeholder',
      })
      .expect(200);

    authToken = loginResponse.body.data.token.accessToken;
    userId = loginResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (sessionId && prisma) {
      await prisma.aIMessage.deleteMany({ where: { sessionId } });
      await prisma.aISession.deleteMany({ where: { id: sessionId } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /ai/sessions', () => {
    it('should create a new chat session', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scene: 'general_chat',
        })
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('welcomeMessage');
      expect(response.body.data.welcomeMessage).toContain('美食助手');

      sessionId = response.body.data.sessionId;
    });

    it('should create a meal planner session', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scene: 'meal_planner',
        })
        .expect(201);

      expect(response.body.data.welcomeMessage).toContain('膳食规划');

      // Clean up
      await prisma.aIMessage.deleteMany({
        where: { sessionId: response.body.data.sessionId },
      });
      await prisma.aISession.delete({
        where: { id: response.body.data.sessionId },
      });
    });

    it('should create a dish critic session', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scene: 'dish_critic',
        })
        .expect(201);

      expect(response.body.data.welcomeMessage).toContain('点评');

      // Clean up
      await prisma.aIMessage.deleteMany({
        where: { sessionId: response.body.data.sessionId },
      });
      await prisma.aISession.delete({
        where: { id: response.body.data.sessionId },
      });
    });

    it('should default to general_chat when scene is not provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      expect(response.body.data.welcomeMessage).toContain('美食助手');

      // Clean up
      await prisma.aIMessage.deleteMany({
        where: { sessionId: response.body.data.sessionId },
      });
      await prisma.aISession.delete({
        where: { id: response.body.data.sessionId },
      });
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/ai/sessions')
        .send({ scene: 'general_chat' })
        .expect(401);
    });

    it('should reject invalid scene', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scene: 'invalid_scene',
        })
        .expect(400);

      // Message can be either a string or an array of validation errors
      const message = Array.isArray(response.body.message)
        ? response.body.message.join(' ')
        : response.body.message;
      expect(message).toContain('scene');
    });
  });

  describe('GET /ai/suggestions', () => {
    it('should return conversation suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
    });

    it('should include time-based suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/suggestions')
        .query({ localTime: '2025-01-01T12:00:00' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const suggestions = response.body.data.suggestions;
      const hasMealSuggestion = suggestions.some((s: string) =>
        /早餐|午餐|晚餐|夜宵/.test(s),
      );
      expect(hasMealSuggestion).toBe(true);
    });

    it('should include meal planning suggestion', async () => {
      const response = await request(app.getHttpServer())
        .get('/ai/suggestions')
        .query({ localTime: '2025-01-01T12:00:00' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const suggestions = response.body.data.suggestions;
      expect(suggestions.some((s: string) => s.includes('食谱'))).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/ai/suggestions').expect(401);
    });
  });

  describe('GET /ai/sessions/:sessionId/history', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a session with some messages
      const session = await prisma.aISession.create({
        data: {
          userId,
          scene: 'general_chat',
        },
      });
      testSessionId = session.id;

      await prisma.aIMessage.createMany({
        data: [
          {
            sessionId: testSessionId,
            role: 'user',
            content: [{ type: 'text', data: 'Hello' }] as any,
          },
          {
            sessionId: testSessionId,
            role: 'assistant',
            content: [{ type: 'text', data: 'Hi there!' }] as any,
          },
          {
            sessionId: testSessionId,
            role: 'user',
            content: [
              { type: 'text', data: 'Recommend me some dishes' },
            ] as any,
          },
        ],
      });
    });

    afterEach(async () => {
      if (testSessionId) {
        await prisma.aIMessage.deleteMany({
          where: { sessionId: testSessionId },
        });
        await prisma.aISession.delete({ where: { id: testSessionId } });
      }
    });

    it('should return chat history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toHaveProperty('messages');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.messages.length).toBe(3);
    });

    it('should return messages in correct order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    it('should include message content', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const messages = response.body.data.messages;
      expect(messages[0].content).toBeDefined();
      expect(Array.isArray(messages[0].content)).toBe(true);
      expect(messages[0].content[0].type).toBe('text');
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .get('/ai/sessions/non-existent-id/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should not allow access to other users sessions', async () => {
      // Login as different user
      const otherLoginResponse = await request(app.getHttpServer())
        .post('/auth/wechat/login')
        .send({ code: 'secondary_user_code_placeholder' })
        .expect(200);

      const otherToken = otherLoginResponse.body.data.token.accessToken;

      await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('should support cursor-based pagination', async () => {
      // Create more messages
      const messages: any[] = [];
      for (let i = 0; i < 60; i++) {
        messages.push({
          sessionId: testSessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: [{ type: 'text', data: `Message ${i}` }] as any,
        });
      }
      await prisma.aIMessage.createMany({ data: messages });

      const firstPage = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(firstPage.body.data.messages.length).toBe(50);
      expect(firstPage.body.data).toHaveProperty('cursor');

      const secondPage = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .query({ cursor: firstPage.body.data.cursor })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(secondPage.body.data.messages.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/ai/sessions/${testSessionId}/history`)
        .expect(401);
    });
  });

  describe('Tool Integration', () => {
    it('should have all tools registered', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      expect(toolRegistry.hasTool('recommend_dishes')).toBe(true);
      expect(toolRegistry.hasTool('search_dishes')).toBe(true);
      expect(toolRegistry.hasTool('get_canteen_info')).toBe(true);
      expect(toolRegistry.hasTool('update_preferences')).toBe(true);
      expect(toolRegistry.hasTool('create_meal_plan')).toBe(true);
    });

    it('should return tool definitions in correct format', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const tools = toolRegistry.getAllTools();

      expect(tools.length).toBeGreaterThan(0);
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
        expect(tool.function.parameters).toHaveProperty('type', 'object');
      });
    });
  });

  describe('AI Configuration', () => {
    it('should load AI provider config from environment', async () => {
      const aiConfig = app.get(AIConfigService);
      const config = await aiConfig.getProviderConfig();

      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('model');
      expect(config.apiKey).toBeTruthy();
    });

    it('should use configured model', async () => {
      const aiConfig = app.get(AIConfigService);
      const config = await aiConfig.getProviderConfig();

      expect(config.model).toBeDefined();
      expect(typeof config.model).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session ID format', async () => {
      await request(app.getHttpServer())
        .get('/ai/sessions/invalid-format/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle missing authorization header', async () => {
      await request(app.getHttpServer()).post('/ai/sessions').expect(401);
    });

    it('should handle malformed authorization header', async () => {
      await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', 'InvalidToken')
        .expect(401);
    });
  });

  describe('Tool Execution', () => {
    let context: ToolContext;
    let criticContext: ToolContext;
    let toolSessionIds: string[] = [];
    let mealPlanDishes: Dish[] = [];
    const planDate = '2026-10-09';

    beforeAll(async () => {
      const [session, criticSession] = await prisma.$transaction([
        prisma.aISession.create({ data: { userId, scene: 'meal_planner' } }),
        prisma.aISession.create({ data: { userId, scene: 'dish_critic' } }),
      ]);
      toolSessionIds = [session.id, criticSession.id];
      context = {
        userId: session.userId,
        sessionId: session.id,
        scene: session.scene,
        localTime: `${planDate}T12:00:00Z`,
      };
      criticContext = {
        userId: criticSession.userId,
        sessionId: criticSession.id,
        scene: criticSession.scene,
      };

      const canteen = await prisma.canteen.findFirstOrThrow({
        orderBy: { id: 'asc' },
      });
      mealPlanDishes = await prisma.$transaction(
        [
          { name: 'AI E2E 鸡肉饭', price: 12 },
          { name: 'AI E2E 清炒时蔬', price: 5 },
        ].map((dish) =>
          prisma.dish.create({
            data: {
              ...dish,
              tags: [],
              images: [],
              ingredients: [],
              allergens: [],
              canteenId: canteen.id,
              canteenName: canteen.name,
              windowName: 'AI E2E 窗口',
              status: 'online',
              availableMealTime: ['lunch'],
            },
          }),
        ),
      );
    });

    afterAll(async () => {
      await Promise.all([
        prisma.dish.deleteMany({
          where: { id: { in: mealPlanDishes.map((dish) => dish.id) } },
        }),
        prisma.aISession.deleteMany({ where: { id: { in: toolSessionIds } } }),
      ]);
    });

    it('should execute get_canteen_info tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'get_canteen_info',
        {},
        context,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });

    it('should execute recommend_dishes tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'recommend_dishes',
        { mealTime: 'lunch' },
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute search_dishes tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '鱼' },
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute my_favorites tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'get_my_favorites',
        {},
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute my_history tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'get_my_history',
        {},
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute popular_dishes tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'get_popular_dishes',
        { limit: 5 },
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute dish_reviews tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'get_dish_reviews',
        { dishId: mealPlanDishes[0].id },
        context,
      );

      expect(result).toEqual([]);
    });

    it('should create a preference confirmation draft without saving it', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { preferences: true },
      });
      const preferences = {
        tastePreferences: {
          spicyLevel: ((before.preferences?.spicyLevel ?? 0) + 1) % 6,
        },
      };
      const allergens = before.allergens.includes('花生')
        ? before.allergens.filter((allergen) => allergen !== '花生')
        : [...before.allergens, '花生'];
      const result = await toolRegistry.executeTool(
        'update_preferences',
        { ...preferences, allergens },
        context,
      );

      expect(result).toEqual({
        summary: '请核对偏好变更，确认后保存。',
        previewData: {
          before: {
            preferences: {
              tastePreferences: {
                spicyLevel: before.preferences?.spicyLevel ?? 0,
                sweetness: before.preferences?.sweetness ?? 0,
                saltiness: before.preferences?.saltiness ?? 0,
                oiliness: before.preferences?.oiliness ?? 0,
              },
            },
            allergens: before.allergens,
          },
          after: { preferences, allergens },
        },
        confirmAction: {
          api: '/user/profile',
          method: 'PUT',
          body: { preferences, allergens },
        },
      });
      expect(
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          include: { preferences: true },
        }),
      ).toEqual(before);
    });

    it('should reject obsolete preference fields', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      await expect(
        toolRegistry.executeTool(
          'update_preferences',
          { dietary_restrictions: ['vegetarian'] },
          context,
        ),
      ).rejects.toThrow(
        '工具参数无效: 参数 must NOT have additional properties',
      );
    });

    it('should create and display a same-canteen meal draft without saving it', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const before = await prisma.mealPlan.findMany({
        where: { userId },
        include: { dishes: true },
        orderBy: { id: 'asc' },
      });
      const dishIds = mealPlanDishes.map((dish) => dish.id);
      const result = await toolRegistry.executeTool(
        'create_meal_plan',
        {
          dishIds,
          startDate: planDate,
          endDate: planDate,
          mealTime: 'lunch',
          totalBudget: 17,
        },
        context,
      );

      expect(result.summary).toBe(`为你安排了${planDate}午餐。`);
      expect(result.previewData).toMatchObject({
        startDate: planDate,
        endDate: planDate,
        mealTime: 'lunch',
        dishes: mealPlanDishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          canteenId: dish.canteenId,
          price: dish.price,
        })),
      });
      expect(result.previewData.dishes.map((dish) => dish.id)).toEqual(dishIds);
      expect(result.confirmAction).toEqual({
        api: '/meal-plans',
        method: 'POST',
        body: {
          startDate: planDate,
          endDate: planDate,
          mealTime: 'lunch',
          dishes: dishIds,
        },
      });
      expect(result.constraints).toEqual({ totalBudget: 17 });
      await expect(
        toolRegistry.executeTool(
          'display_content',
          { type: 'meal_plan', data: result },
          context,
        ),
      ).resolves.toEqual([result]);
      expect(
        await prisma.mealPlan.findMany({
          where: { userId },
          include: { dishes: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(before);
    });

    it.each([
      {
        startDate: '2026-02-31',
        endDate: '2026-03-03',
        message: '日期无效。请使用有效的 YYYY-MM-DD 日期。',
      },
      {
        startDate: '2026-10-10',
        endDate: '2026-10-09',
        message: '结束日期不能早于开始日期。',
      },
    ])('should reject an invalid meal date interval: %j', async (interval) => {
      const toolRegistry = app.get(ToolRegistryService);
      await expect(
        toolRegistry.executeTool(
          'create_meal_plan',
          {
            dishIds: mealPlanDishes.map((dish) => dish.id),
            startDate: interval.startDate,
            endDate: interval.endDate,
            mealTime: 'lunch',
          },
          context,
        ),
      ).rejects.toThrow(interval.message);
    });

    it.each([
      {
        mealTime: 'lunch',
        totalBudget: 16,
        message: '所选菜品总价17.00元，超过整餐预算16元。请重新搭配。',
      },
      {
        mealTime: 'dinner',
        totalBudget: 17,
        message: '所选菜品当前不供应该餐次。请重新查询可供应的菜品。',
      },
    ])('should enforce meal constraints: %j', async (constraints) => {
      const toolRegistry = app.get(ToolRegistryService);
      await expect(
        toolRegistry.executeTool(
          'create_meal_plan',
          {
            dishIds: mealPlanDishes.map((dish) => dish.id),
            startDate: planDate,
            endDate: planDate,
            mealTime: constraints.mealTime,
            totalBudget: constraints.totalBudget,
          },
          context,
        ),
      ).rejects.toThrow(constraints.message);
    });

    it.each(['update_preferences', 'create_meal_plan'])(
      'should reject %s in dish critic sessions',
      async (toolName) => {
        const toolRegistry = app.get(ToolRegistryService);
        const params =
          toolName === 'update_preferences'
            ? { allergens: [] }
            : {
                dishIds: mealPlanDishes.map((dish) => dish.id),
                startDate: planDate,
                endDate: planDate,
                mealTime: 'lunch',
              };
        expect(
          toolRegistry
            .getAllTools(criticContext.scene)
            .map((tool) => tool.function.name),
        ).not.toContain(toolName);
        await expect(
          toolRegistry.executeTool(toolName, params, criticContext),
        ).rejects.toThrow(`当前对话场景不可使用工具: ${toolName}`);
      },
    );

    it('should display queried dish cards', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const result = await toolRegistry.executeTool(
        'display_content',
        {
          type: 'dish',
          ids: mealPlanDishes.map((dish) => dish.id),
        },
        context,
      );

      expect(result.map((card) => card.dish.id)).toEqual(
        mealPlanDishes.map((dish) => dish.id),
      );
      expect(result.map((card) => card.dish.name)).toEqual(
        mealPlanDishes.map((dish) => dish.name),
      );
    });

    it('should throw error for non-existent tool', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      await expect(
        toolRegistry.executeTool('non_existent_tool', {}, context),
      ).rejects.toThrow('工具未找到: non_existent_tool');
    });

    it('should execute search_dishes with an empty keyword', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      // Search with empty keyword should still work
      const result = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '' },
        context,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle recommend_dishes with different meal times', async () => {
      const toolRegistry = app.get(ToolRegistryService);
      const mealTimes = ['breakfast', 'lunch', 'dinner'];

      for (const mealTime of mealTimes) {
        const result = await toolRegistry.executeTool(
          'recommend_dishes',
          { mealTime },
          context,
        );

        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('AI Config Management', () => {
    beforeEach(async () => {
      // Clean up test configs before each test
      await prisma.aIConfig.deleteMany({
        where: { key: { startsWith: 'test.' } },
      });
      const aiConfig = app.get(AIConfigService);
      aiConfig.clearCache();
    });

    afterEach(async () => {
      // Clean up test configs after each test
      await prisma.aIConfig.deleteMany({
        where: { key: { startsWith: 'test.' } },
      });
      const aiConfig = app.get(AIConfigService);
      aiConfig.clearCache();
    });

    it('should support config cache', async () => {
      const aiConfig = app.get(AIConfigService);

      // First call - loads from DB (should return default)
      const config1 = await aiConfig.get('test.key', 'default');
      expect(config1).toBe('default');

      // Set a value
      await aiConfig.set('test.key', 'test_value');

      // Second call - should use cache
      const config2 = await aiConfig.get('test.key', 'default');
      expect(config2).toBe('test_value');
    });

    it('should clear cache properly', async () => {
      const aiConfig = app.get(AIConfigService);

      await aiConfig.set('test.cache', 'cached_value');
      const cached = await aiConfig.get('test.cache');
      expect(cached).toBe('cached_value');

      aiConfig.clearCache();

      // After clearing cache, should reload from DB
      const reloaded = await aiConfig.get('test.cache');
      expect(reloaded).toBe('cached_value');
    });
  });

  describe('Session Scene Switching', () => {
    it('should maintain different welcome messages for different scenes', async () => {
      const scenes = ['general_chat', 'meal_planner', 'dish_critic'];
      const welcomeMessages: string[] = [];

      for (const scene of scenes) {
        const response = await request(app.getHttpServer())
          .post('/ai/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ scene })
          .expect(201);

        welcomeMessages.push(response.body.data.welcomeMessage);

        // Clean up
        await prisma.aISession.delete({
          where: { id: response.body.data.sessionId },
        });
      }

      // All welcome messages should be different
      const uniqueMessages = new Set(welcomeMessages);
      expect(uniqueMessages.size).toBe(scenes.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long message history', async () => {
      const testSession = await prisma.aISession.create({
        data: { userId, scene: 'general_chat' },
      });

      // Create 100 messages
      const messages: any[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          sessionId: testSession.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: [{ type: 'text', data: `Message ${i}` }] as any,
        });
      }
      await prisma.aIMessage.createMany({ data: messages });

      const response = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSession.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.messages.length).toBe(50); // Should paginate
      expect(response.body.data).toHaveProperty('cursor');

      // Clean up
      await prisma.aIMessage.deleteMany({
        where: { sessionId: testSession.id },
      });
      await prisma.aISession.delete({ where: { id: testSession.id } });
    });

    it('should handle empty message content', async () => {
      const testSession = await prisma.aISession.create({
        data: { userId, scene: 'general_chat' },
      });

      await prisma.aIMessage.create({
        data: {
          sessionId: testSession.id,
          role: 'user',
          content: [] as any,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/ai/sessions/${testSession.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.messages).toHaveLength(1);
      expect(response.body.data.messages[0].content).toEqual([]);

      // Clean up
      await prisma.aIMessage.deleteMany({
        where: { sessionId: testSession.id },
      });
      await prisma.aISession.delete({ where: { id: testSession.id } });
    });

    it('should handle concurrent session creation', async () => {
      const promises: any[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/ai/sessions')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ scene: 'general_chat' }),
        );
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('sessionId');
      });

      // All should have unique session IDs
      const sessionIds = responses.map((r) => r.body.data.sessionId);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(5);

      // Clean up
      await Promise.all(
        sessionIds.map((id) =>
          prisma.aISession.delete({ where: { id } }).catch(() => {}),
        ),
      );
    });
  });

  describe('Streaming Chat (SSE)', () => {
    let streamTestSessionId: string;

    beforeEach(async () => {
      // Create a session for streaming tests
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scene: 'general_chat' })
        .expect(201);

      streamTestSessionId = response.body.data.sessionId;
    }, 10000); // Increased timeout for session creation

    afterEach(async () => {
      if (streamTestSessionId) {
        await prisma.aIMessage.deleteMany({
          where: { sessionId: streamTestSessionId },
        });
        await prisma.aISession
          .delete({
            where: { id: streamTestSessionId },
          })
          .catch(() => {
            // Ignore if already deleted
          });
      }
    });

    it('should stream chat response with SSE', async () => {
      const response = await requestChatStream(
        app,
        authToken,
        streamTestSessionId,
        {
          message: '推荐一些午餐',
          clientContext: {
            localTime: '2025-01-01T12:00:00Z',
          },
        },
      );
      expect(response.text).toContain('event: text_chunk');
    }, 20000); // Increased timeout for multi-turn conversations

    it('should handle SSE connection errors gracefully', async () => {
      const response = await requestChatStream(
        app,
        authToken,
        'invalid-session',
        {
          message: 'test message',
        },
      );
      expect(response.text).toContain('event: error');
    });

    it('should save both messages before the stream completes', async () => {
      await requestChatStream(app, authToken, streamTestSessionId, {
        message: '测试消息保存',
      });

      // Verify message was saved
      const messages = await prisma.aIMessage.findMany({
        where: { sessionId: streamTestSessionId },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages.length).toBeGreaterThan(0);
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();

      const content = userMessage!.content as any[];
      expect(content[0].data).toContain('测试消息保存');
      expect(messages.some((message) => message.role === 'assistant')).toBe(
        true,
      );
    }, 15000); // Increased timeout for streaming test
  });

  describe('Tool Calling Chain', () => {
    let chainTestSessionId: string;
    let context: ToolContext;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scene: 'general_chat' })
        .expect(201);

      chainTestSessionId = response.body.data.sessionId;
      const session = await prisma.aISession.findUniqueOrThrow({
        where: { id: chainTestSessionId },
      });
      context = {
        userId: session.userId,
        sessionId: session.id,
        scene: session.scene,
        localTime: '2025-01-01T12:00:00Z',
      };
    });

    afterEach(async () => {
      if (chainTestSessionId) {
        await prisma.aIMessage.deleteMany({
          where: { sessionId: chainTestSessionId },
        });
        await prisma.aISession.delete({
          where: { id: chainTestSessionId },
        });
      }
    });

    it('should execute multiple tools in sequence', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      // Simulate a complex query requiring multiple tools
      // 1. Search for dishes
      const searchResult = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '鱼' },
        context,
      );

      expect(Array.isArray(searchResult)).toBe(true);
      expect(searchResult.length).toBeGreaterThan(0);

      // 2. Get canteen info for the dish's location
      const canteenResult = await toolRegistry.executeTool(
        'get_canteen_info',
        {},
        context,
      );

      expect(Array.isArray(canteenResult)).toBe(true);

      // 3. Get recommendations based on meal time
      const recommendResult = await toolRegistry.executeTool(
        'recommend_dishes',
        { mealTime: 'lunch' },
        context,
      );

      expect(Array.isArray(recommendResult)).toBe(true);
    });

    it('should handle tool execution failures in chain', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      // First tool succeeds
      const result1 = await toolRegistry.executeTool(
        'get_canteen_info',
        {},
        context,
      );

      expect(result1).toBeDefined();

      // Second tool fails (non-existent tool)
      await expect(
        toolRegistry.executeTool('non_existent_tool', {}, context),
      ).rejects.toThrow('工具未找到: non_existent_tool');

      // Third tool should still work after a failure
      const result3 = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '面' },
        context,
      );

      expect(result3).toBeDefined();
    });

    it('should maintain context across multiple tool calls', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      const call1 = await toolRegistry.executeTool(
        'recommend_dishes',
        { mealTime: 'lunch' },
        context,
      );

      const call2 = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '鸡' },
        context,
      );

      const call3 = await toolRegistry.executeTool(
        'get_canteen_info',
        {},
        context,
      );

      // All calls should succeed and return results
      expect(call1).toBeDefined();
      expect(call2).toBeDefined();
      expect(call3).toBeDefined();
    });

    it('should handle parallel tool execution', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      // Execute multiple tools in parallel
      const results = await Promise.all([
        toolRegistry.executeTool(
          'recommend_dishes',
          { mealTime: 'lunch' },
          context,
        ),
        toolRegistry.executeTool('search_dishes', { keyword: '面' }, context),
        toolRegistry.executeTool('get_canteen_info', {}, context),
      ]);

      // All should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should validate tool parameters in chain', async () => {
      const toolRegistry = app.get(ToolRegistryService);

      // Valid call
      const validResult = await toolRegistry.executeTool(
        'search_dishes',
        { keyword: '鱼' },
        context,
      );

      expect(validResult).toBeDefined();

      await expect(
        toolRegistry.executeTool('search_dishes', { keyword: 123 }, context),
      ).rejects.toThrow('工具参数无效: 参数/keyword must be string');
    });
  });
});

/**
 * 测试连续对话功能
 * 验证AI能够记住上下文并进行多轮对话
 */
describe('Continuous Conversation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Use Mock Provider if USE_MOCK_AI_PROVIDER environment variable is set to 'true' or '1'
    // Default to false (use real OpenAI API, requires valid API key)
    const useMockAIProvider =
      process.env.USE_MOCK_AI_PROVIDER === 'true' ||
      process.env.USE_MOCK_AI_PROVIDER === '1';

    let moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    // Override with Mock Provider if enabled
    if (useMockAIProvider) {
      moduleBuilder = moduleBuilder
        .overrideProvider(OpenAIProviderService)
        .useClass(MockAIProviderService);
    }

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');

    prisma = app.get<PrismaService>(PrismaService);

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' })
      .expect(200);

    authToken = loginResponse.body.data.token.accessToken;
    userId = loginResponse.body.data.user.id;

    // Create a session for continuous conversation
    const sessionResponse = await request(app.getHttpServer())
      .post('/ai/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ scene: 'general_chat' })
      .expect(201);

    sessionId = sessionResponse.body.data.sessionId;
  });

  afterAll(async () => {
    if (sessionId && prisma) {
      await prisma.aIMessage.deleteMany({ where: { sessionId } });
      await prisma.aISession.deleteMany({ where: { id: sessionId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('should maintain context across multiple conversation turns', async () => {
    // Turn 1: Ask about lunch recommendations
    const turn1 = await requestChatStream(app, authToken, sessionId, {
      message: '有什么午餐推荐吗？',
      clientContext: { localTime: '2025-01-01T12:00:00Z' },
    });

    // Verify first turn got a response
    expect(turn1.text).toContain('event: text_chunk');

    // Turn 2: Ask a follow-up question (tests context retention)
    const turn2 = await requestChatStream(app, authToken, sessionId, {
      message: '这些菜有素食选项吗？',
    });

    expect(turn2.text).toContain('event: text_chunk');

    // Turn 3: Reference previous context
    const turn3 = await requestChatStream(app, authToken, sessionId, {
      message: '第一个推荐的是什么？',
    });

    expect(turn3.text).toContain('event: text_chunk');

    // Verify all messages are saved in the database
    const messages = await prisma.aIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    // Should have at least 6 messages (3 user + 3 assistant)
    expect(messages.length).toBeGreaterThanOrEqual(6);

    // Verify message roles alternate
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
    expect(messages[3].role).toBe('assistant');
  }, 60000); // Long timeout for multiple turns

  it('should retrieve conversation history correctly', async () => {
    // Get history after the conversation
    const historyResponse = await request(app.getHttpServer())
      .get(`/ai/sessions/${sessionId}/history`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const { messages } = historyResponse.body.data;

    // Should have all messages from previous test
    expect(messages.length).toBeGreaterThan(0);

    // Verify structure of messages
    messages.forEach((msg: any) => {
      expect(msg).toHaveProperty('role');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('timestamp');
      expect(['user', 'assistant']).toContain(msg.role);
    });
  });
});
