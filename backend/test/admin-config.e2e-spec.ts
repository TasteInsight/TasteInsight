import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminConfigController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let canteenAdminToken: string;
  let normalAdminToken: string;
  let testCanteenId: string;
  let otherCanteenId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Login as super admin (testadmin - no canteenId)
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    // Login as canteen admin (canteenadmin - has canteenId)
    const canteenAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'canteenadmin', password: 'canteen123' });
    canteenAdminToken = canteenAdminLogin.body.data.token.accessToken;

    // Login as normal admin (只有 dish:view 权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // Get test canteen ID (canteen that canteenadmin belongs to)
    const canteenAdmin = await prisma.admin.findUnique({
      where: { username: 'canteenadmin' },
    });
    testCanteenId = canteenAdmin?.canteenId || '';

    // Get other canteen ID for permission tests
    const canteens = await prisma.canteen.findMany({
      where: { id: { not: testCanteenId } },
      take: 1,
    });
    otherCanteenId = canteens[0]?.id || '';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/config/templates', () => {
    it('should return list of config templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/config/templates')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);

      // Check that our config templates exist
      const keys = response.body.data.items.map((t: any) => t.key);
      expect(keys).toContain('review.autoApprove');
      expect(keys).toContain('comment.autoApprove');
    });

    it('should return 403 for admin without config:view permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/config/templates')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/admin/config/templates')
        .expect(401);
    });
  });

  describe('GET /admin/config/global', () => {
    it('should return global config', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.templates).toBeInstanceOf(Array);
    });

    it('should allow canteen admin to view global config', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/config/global')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });
  });

  describe('PUT /admin/config/global', () => {
    it('should update global config for super admin', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.key).toBe('review.autoApprove');
      expect(response.body.data.value).toBe('true');

      // Reset to default
      await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'false',
        });
    });

    it('should return 403 for canteen admin trying to modify global config', async () => {
      await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        })
        .expect(403);
    });

    it('should return 400 for non-existent config key', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'non.existent.key',
          value: 'true',
        })
        .expect(400);

      expect(response.body.message).toContain('不存在');
    });

    it('should return 400 for invalid boolean value', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'invalid',
        })
        .expect(400);

      expect(response.body.message).toContain('true');
    });
  });

  describe('GET /admin/config/canteen/:canteenId', () => {
    it('should return canteen config', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.templates).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent canteen', async () => {
      await request(app.getHttpServer())
        .get('/admin/config/canteen/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('GET /admin/config/canteen/:canteenId/effective', () => {
    it('should return effective config', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/config/canteen/${testCanteenId}/effective`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);

      // Check source field exists
      for (const item of response.body.data.items) {
        expect(['canteen', 'global', 'default']).toContain(item.source);
      }
    });
  });

  describe('PUT /admin/config/canteen/:canteenId', () => {
    it('should update canteen config for super admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.key).toBe('review.autoApprove');
      expect(response.body.data.value).toBe('true');
    });

    it('should allow canteen admin to update own canteen config', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          key: 'comment.autoApprove',
          value: 'true',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should return 403 for canteen admin trying to update other canteen config', async () => {
      if (otherCanteenId) {
        await request(app.getHttpServer())
          .put(`/admin/config/canteen/${otherCanteenId}`)
          .set('Authorization', `Bearer ${canteenAdminToken}`)
          .send({
            key: 'review.autoApprove',
            value: 'true',
          })
          .expect(403);
      }
    });

    it('should return 400 for non-existent config key', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'non.existent.key',
          value: 'true',
        })
        .expect(400);

      expect(response.body.message).toContain('不存在');
    });

    it('should return 404 for non-existent canteen', async () => {
      await request(app.getHttpServer())
        .put('/admin/config/canteen/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        })
        .expect(404);
    });
  });

  describe('DELETE /admin/config/canteen/:canteenId/:key', () => {
    it('should delete canteen config item for super admin', async () => {
      // First create a config item
      await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        });

      // Then delete it
      const response = await request(app.getHttpServer())
        .delete(`/admin/config/canteen/${testCanteenId}/review.autoApprove`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toContain('删除');
    });

    it('should allow canteen admin to delete own canteen config item', async () => {
      // First create a config item
      await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          key: 'comment.autoApprove',
          value: 'true',
        });

      // Then delete it
      const response = await request(app.getHttpServer())
        .delete(`/admin/config/canteen/${testCanteenId}/comment.autoApprove`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should return 403 for canteen admin trying to delete other canteen config', async () => {
      if (otherCanteenId) {
        await request(app.getHttpServer())
          .delete(`/admin/config/canteen/${otherCanteenId}/review.autoApprove`)
          .set('Authorization', `Bearer ${canteenAdminToken}`)
          .expect(403);
      }
    });
  });

  describe('Config inheritance', () => {
    it('should inherit from global config when canteen has no override', async () => {
      // Set global config
      await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        });

      // Delete canteen config if exists
      await request(app.getHttpServer())
        .delete(`/admin/config/canteen/${testCanteenId}/review.autoApprove`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      // Get effective config
      const response = await request(app.getHttpServer())
        .get(`/admin/config/canteen/${testCanteenId}/effective`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const reviewConfig = response.body.data.items.find(
        (i: any) => i.key === 'review.autoApprove',
      );
      expect(reviewConfig.value).toBe('true');
      expect(reviewConfig.source).toBe('global');

      // Reset global config
      await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'false',
        });
    });

    it('should override global config with canteen config', async () => {
      // Set global config
      await request(app.getHttpServer())
        .put('/admin/config/global')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'false',
        });

      // Set canteen config
      await request(app.getHttpServer())
        .put(`/admin/config/canteen/${testCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          key: 'review.autoApprove',
          value: 'true',
        });

      // Get effective config
      const response = await request(app.getHttpServer())
        .get(`/admin/config/canteen/${testCanteenId}/effective`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const reviewConfig = response.body.data.items.find(
        (i: any) => i.key === 'review.autoApprove',
      );
      expect(reviewConfig.value).toBe('true');
      expect(reviewConfig.source).toBe('canteen');

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/admin/config/canteen/${testCanteenId}/review.autoApprove`)
        .set('Authorization', `Bearer ${superAdminToken}`);
    });
  });
});
