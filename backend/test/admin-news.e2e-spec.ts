import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AdminNewsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let viewOnlyAdminToken: string;
  let noAccessAdminToken: string;
  let createdNewsId: string;
  let testCanteenId: string;
  let viewOnlyAdminId: string;
  let noAccessAdminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // 1. Login as super admin (assuming seeded)
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    // 2. Create a test canteen
    const canteen = await prisma.canteen.create({
      data: {
        name: 'News Test Canteen',
        position: 'Test Position',
        images: [],
        openingHours: [],
      },
    });
    testCanteenId = canteen.id;

    // 3. Create view-only admin
    const hashedPassword = await bcrypt.hash('123456', 10);
    const viewOnlyAdmin = await prisma.admin.create({
      data: {
        username: 'newsviewadmin',
        password: hashedPassword,
        role: 'admin',
        permissions: {
          create: [{ permission: 'news:view' }],
        },
      },
    });
    viewOnlyAdminId = viewOnlyAdmin.id;

    const viewOnlyLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'newsviewadmin', password: '123456' });
    viewOnlyAdminToken = viewOnlyLogin.body.data.token.accessToken;

    // 4. Create no-access admin
    const noAccessAdmin = await prisma.admin.create({
      data: {
        username: 'newsnoaccess',
        password: hashedPassword,
        role: 'admin',
        permissions: {
          create: [], // No permissions
        },
      },
    });
    noAccessAdminId = noAccessAdmin.id;

    const noAccessLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'newsnoaccess', password: '123456' });
    noAccessAdminToken = noAccessLogin.body.data.token.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    if (createdNewsId) {
      await prisma.news.deleteMany({ where: { id: createdNewsId } });
    }
    if (testCanteenId) {
      await prisma.canteen.deleteMany({ where: { id: testCanteenId } });
    }
    if (viewOnlyAdminId) {
      await prisma.admin.delete({ where: { id: viewOnlyAdminId } });
    }
    if (noAccessAdminId) {
      await prisma.admin.delete({ where: { id: noAccessAdminId } });
    }
    await app.close();
  });

  describe('/admin/news (POST)', () => {
    it('should create a new news (draft)', async () => {
      const createDto = {
        title: 'Test News',
        content: 'Test Content',
        summary: 'Test Summary',
        canteenId: testCanteenId,
      };

      const response = await request(app.getHttpServer())
        .post('/admin/news')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.title).toBe(createDto.title);
      expect(response.body.data.canteenName).toBe('News Test Canteen');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.publishedAt).toBeNull();

      createdNewsId = response.body.data.id;
    });
  });

  describe('/admin/news (GET)', () => {
    let draftNewsId: string;
    let publishedNewsId: string;
    let secondCanteenId: string;

    beforeAll(async () => {
      // Create another canteen for testing
      const secondCanteen = await prisma.canteen.create({
        data: {
          name: 'Second Test Canteen',
          position: 'Second Position',
          images: [],
          openingHours: [],
        },
      });
      secondCanteenId = secondCanteen.id;

      // Create draft news
      const draftNews = await prisma.news.create({
        data: {
          title: 'Draft News',
          content: 'Draft Content',
          summary: 'Draft Summary',
          canteenId: testCanteenId,
          canteenName: 'News Test Canteen',
          status: 'draft',
          publishedAt: null,
          createdBy: viewOnlyAdminId,
        },
      });
      draftNewsId = draftNews.id;

      // Create published news
      const publishedNews = await prisma.news.create({
        data: {
          title: 'Published News',
          content: 'Published Content',
          summary: 'Published Summary',
          canteenId: secondCanteenId,
          canteenName: 'Second Test Canteen',
          status: 'published',
          publishedAt: new Date(),
          createdBy: viewOnlyAdminId,
        },
      });
      publishedNewsId = publishedNews.id;
    });

    afterAll(async () => {
      if (draftNewsId) {
        await prisma.news.deleteMany({ where: { id: draftNewsId } });
      }
      if (publishedNewsId) {
        await prisma.news.deleteMany({ where: { id: publishedNewsId } });
      }
      if (secondCanteenId) {
        await prisma.canteen.deleteMany({ where: { id: secondCanteenId } });
      }
    });

    it('should return list of news', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      const found = response.body.data.items.find(
        (n: any) => n.id === createdNewsId,
      );
      expect(found).toBeDefined();
      expect(found.title).toBe('Test News');
    });

    it('should filter news by status=draft', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?status=draft')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // All returned news should be draft
      response.body.data.items.forEach((news: any) => {
        expect(news.status).toBe('draft');
      });

      // Should include our draft news
      const found = response.body.data.items.find(
        (n: any) => n.id === draftNewsId,
      );
      expect(found).toBeDefined();
      expect(found.title).toBe('Draft News');
    });

    it('should filter news by status=published', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?status=published')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // All returned news should be published
      response.body.data.items.forEach((news: any) => {
        expect(news.status).toBe('published');
      });

      // Should include our published news
      const found = response.body.data.items.find(
        (n: any) => n.id === publishedNewsId,
      );
      expect(found).toBeDefined();
      expect(found.title).toBe('Published News');
    });

    it('should filter news by canteenName (exact match)', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?canteenName=News Test Canteen')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // All returned news should have the specified canteen name
      response.body.data.items.forEach((news: any) => {
        expect(news.canteenName).toBe('News Test Canteen');
      });

      // Should include our draft news
      const found = response.body.data.items.find(
        (n: any) => n.id === draftNewsId,
      );
      expect(found).toBeDefined();
    });

    it('should filter news by canteenName (partial match)', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?canteenName=Test')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // All returned news should contain "Test" in canteen name
      response.body.data.items.forEach((news: any) => {
        expect(news.canteenName).toMatch(/Test/i);
      });
    });

    it('should filter news by both status and canteenName', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?status=draft&canteenName=News Test Canteen')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);

      // All returned news should match both filters
      response.body.data.items.forEach((news: any) => {
        expect(news.status).toBe('draft');
        expect(news.canteenName).toBe('News Test Canteen');
      });

      // Should include our draft news
      const found = response.body.data.items.find(
        (n: any) => n.id === draftNewsId,
      );
      expect(found).toBeDefined();
    });

    it('should return empty array when no news match filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/news?status=draft&canteenName=NonExistentCanteen')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBe(0);
    });
  });

  describe('/admin/news/:id (PUT)', () => {
    it('should update the news', async () => {
      const updateDto = {
        title: 'Updated News Title',
        content: 'Updated Content',
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/news/${createdNewsId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.title).toBe(updateDto.title);
      expect(response.body.data.content).toBe(updateDto.content);
    });

    it('should update canteenId and canteenName correctly', async () => {
      // First revoke the news to make it editable
      await request(app.getHttpServer())
        .post(`/admin/news/${createdNewsId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const updateDto = {
        canteenId: testCanteenId,
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/news/${createdNewsId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.canteenId).toBe(testCanteenId);
      expect(response.body.data.canteenName).toBe('News Test Canteen');
    });

    it('should return 400 when updating with non-existent canteenId', async () => {
      const updateDto = {
        canteenId: 'non-existent-canteen-id',
      };

      await request(app.getHttpServer())
        .put(`/admin/news/${createdNewsId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(400);
    });

    it('should return 404 when updating non-existent news', async () => {
      await request(app.getHttpServer())
        .put('/admin/news/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ title: 'New Title' })
        .expect(404);
    });
  });

  describe('/admin/news/:id/publish (POST)', () => {
    it('should publish the news', async () => {
      await request(app.getHttpServer())
        .post(`/admin/news/${createdNewsId}/publish`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const news = await prisma.news.findUnique({
        where: { id: createdNewsId },
      });
      expect(news!.status).toBe('published');
      expect(news!.publishedAt).not.toBeNull();
    });

    it('should return 404 when publishing non-existent news', async () => {
      await request(app.getHttpServer())
        .post('/admin/news/non-existent-id/publish')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should not allow editing published news', async () => {
      await request(app.getHttpServer())
        .put(`/admin/news/${createdNewsId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ title: 'Should Fail' })
        .expect(400);
    });
  });

  describe('/admin/news/:id/revoke (POST)', () => {
    it('should revoke the news', async () => {
      await request(app.getHttpServer())
        .post(`/admin/news/${createdNewsId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const news = await prisma.news.findUnique({
        where: { id: createdNewsId },
      });
      expect(news!.status).toBe('draft');
      expect(news!.publishedAt).toBeNull();
    });

    it('should return 404 when revoking non-existent news', async () => {
      await request(app.getHttpServer())
        .post('/admin/news/non-existent-id/revoke')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('/admin/news/:id (DELETE)', () => {
    it('should return 404 when deleting non-existent news', async () => {
      await request(app.getHttpServer())
        .delete('/admin/news/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should delete the news', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/news/${createdNewsId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Verify deletion
      const check = await prisma.news.findUnique({
        where: { id: createdNewsId },
      });
      expect(check).toBeNull();
      createdNewsId = ''; // Prevent cleanup failure
    });
  });

  // ========================
  // 权限控制测试
  // ========================
  describe('Permission Control', () => {
    let permissionTestNewsId: string;

    beforeAll(async () => {
      const news = await prisma.news.create({
        data: {
          title: 'Permission Test News',
          content: 'Content',
          publishedAt: new Date(),
          status: 'published',
          createdBy: viewOnlyAdminId, // Just assign to someone
        },
      });
      permissionTestNewsId = news.id;
    });

    afterAll(async () => {
      if (permissionTestNewsId) {
        await prisma.news.deleteMany({ where: { id: permissionTestNewsId } });
      }
    });

    describe('Unauthorized Access (401)', () => {
      it('should return 401 when accessing without token', async () => {
        await request(app.getHttpServer()).get('/admin/news').expect(401);
      });
    });

    describe('Forbidden Access for noAccessAdmin (403)', () => {
      it('should return 403 when listing news', async () => {
        await request(app.getHttpServer())
          .get('/admin/news')
          .set('Authorization', `Bearer ${noAccessAdminToken}`)
          .expect(403);
      });

      it('should return 403 when creating news', async () => {
        await request(app.getHttpServer())
          .post('/admin/news')
          .set('Authorization', `Bearer ${noAccessAdminToken}`)
          .send({
            title: 'Test',
            content: 'Test',
          })
          .expect(403);
      });
    });

    describe('Partial Access for viewOnlyAdmin', () => {
      it('should allow listing news (has news:view)', async () => {
        await request(app.getHttpServer())
          .get('/admin/news')
          .set('Authorization', `Bearer ${viewOnlyAdminToken}`)
          .expect(200);
      });

      it('should return 403 when creating news (no news:create)', async () => {
        await request(app.getHttpServer())
          .post('/admin/news')
          .set('Authorization', `Bearer ${viewOnlyAdminToken}`)
          .send({
            title: 'Test',
            content: 'Test',
          })
          .expect(403);
      });

      it('should return 403 when updating news (no news:edit)', async () => {
        await request(app.getHttpServer())
          .put(`/admin/news/${permissionTestNewsId}`)
          .set('Authorization', `Bearer ${viewOnlyAdminToken}`)
          .send({ title: 'Updated' })
          .expect(403);
      });

      it('should return 403 when deleting news (no news:delete)', async () => {
        await request(app.getHttpServer())
          .delete(`/admin/news/${permissionTestNewsId}`)
          .set('Authorization', `Bearer ${viewOnlyAdminToken}`)
          .expect(403);
      });
    });
  });
});
