import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('NewsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAccessToken: string;
  let testNewsIds: string[] = [];
  let testCanteenId1: string;
  let testCanteenId2: string;

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

    // 获取测试食堂ID
    const canteen1 = await prisma.canteen.findFirst({
      where: { name: '第一食堂' },
    });
    testCanteenId1 = canteen1?.id || '';

    const canteen2 = await prisma.canteen.findFirst({
      where: { name: '第二食堂' },
    });
    testCanteenId2 = canteen2?.id || '';

    // 获取管理员ID
    const admin = await prisma.admin.findFirst();
    if (!admin) {
      throw new Error('No admin found');
    }

    // 创建测试新闻 1
    const news1 = await prisma.news.create({
      data: {
        title: 'Test News 1',
        content: '<p>This is a test news content 1.</p>',
        summary: 'Test Summary 1',
        canteenId: testCanteenId1,
        canteenName: '第一食堂',
        publishedAt: new Date(),
        createdBy: admin.id,
      },
    });
    testNewsIds.push(news1.id);

    // 创建测试新闻 2 (如果存在第二食堂)
    if (testCanteenId2) {
      const news2 = await prisma.news.create({
        data: {
          title: 'Test News 2',
          content: '<p>This is a test news content 2.</p>',
          summary: 'Test Summary 2',
          canteenId: testCanteenId2,
          canteenName: '第二食堂',
          publishedAt: new Date(),
          createdBy: admin.id,
        },
      });
      testNewsIds.push(news2.id);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    if (testNewsIds.length > 0) {
      await prisma.news.deleteMany({
        where: {
          id: {
            in: testNewsIds,
          },
        },
      });
    }
    await app.close();
  });

  describe('/news (GET)', () => {
    it('should return news list (all news when no canteenId)', async () => {
      const response = await request(app.getHttpServer())
        .get('/news')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取新闻列表成功');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      // Should contain at least the news we created
      const newsIds = response.body.data.items.map((item: any) => item.id);
      expect(newsIds).toEqual(expect.arrayContaining(testNewsIds));
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/news?page=1&pageSize=1')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
    });

    it('should filter by canteenId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/news?canteenId=${testCanteenId1}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // Verify all returned items belong to the requested canteen
      response.body.data.items.forEach((item: any) => {
        expect(item.canteenId).toBe(testCanteenId1);
      });

      // Verify that news from other canteen is NOT included (if we have multiple canteens)
      if (testCanteenId2 && testNewsIds.length > 1) {
        response.body.data.items.forEach((item: any) => {
          expect(item.canteenId).not.toBe(testCanteenId2);
        });
      }
    });
  });

  describe('/news/:id (GET)', () => {
    it('should return news details for valid id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/news/${testNewsIds[0]}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('获取新闻详情成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testNewsIds[0]);
      expect(response.body.data.title).toBe('Test News 1');
    });

    it('should return 404 for invalid id', async () => {
      await request(app.getHttpServer())
        .get('/news/invalid-id')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(404);
    });
  });
});
