import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminAdminsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let adminManagerToken: string;
  let normalAdminToken: string;
  let createdSubAdminId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Login as super admin
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    // Login as admin manager (has admin:* permissions)
    const adminManagerLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'adminmanager', password: 'manager123' });
    adminManagerToken = adminManagerLogin.body.data.token.accessToken;

    // Login as normal admin (no admin:* permissions)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;
  });

  afterAll(async () => {
    // Cleanup: delete any sub-admin created during tests
    if (createdSubAdminId) {
      await prisma.admin.deleteMany({ where: { id: createdSubAdminId } });
    }
    await app.close();
  });

  describe('/admin/admins (POST) - Create Sub Admin', () => {
    it('should create a new sub admin with superadmin', async () => {
      const createDto = {
        username: 'newsubadmin',
        password: 'Test@123!',
        permissions: ['dish:view', 'dish:create'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.username).toBe(createDto.username);
      expect(response.body.data.role).toBe('admin');
      expect(response.body.data.permissions).toEqual(
        expect.arrayContaining(createDto.permissions),
      );
      expect(response.body.data.createdBy).toBeDefined();

      createdSubAdminId = response.body.data.id;
    });

    it('should create a sub admin with adminManager', async () => {
      const createDto = {
        username: 'managersubadmin',
        password: 'Test@456!',
        permissions: ['canteen:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.data.username).toBe(createDto.username);

      // Cleanup
      await prisma.admin.delete({ where: { id: response.body.data.id } });
    });

    it('should create a sub admin with canteenId', async () => {
      // Get a valid canteenId
      const canteen = await prisma.canteen.findFirst();

      const createDto = {
        username: 'canteensubadmin',
        password: 'Test@789!',
        canteenId: canteen?.id,
        permissions: ['dish:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.data.canteenId).toBe(canteen?.id);

      // Cleanup
      await prisma.admin.delete({ where: { id: response.body.data.id } });
    });

    it('should return 400 for duplicate username', async () => {
      const createDto = {
        username: 'newsubadmin', // Already created above
        password: 'Test@123!',
        permissions: ['dish:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(400);

      expect(response.body.message).toContain('用户名已存在');
    });

    it('should return 400 for invalid password format', async () => {
      const createDto = {
        username: 'invalidpwdadmin',
        password: 'weak', // Too weak
        permissions: ['dish:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should return 400 for non-existent canteenId', async () => {
      const createDto = {
        username: 'invalidcanteen',
        password: 'Test@123!',
        canteenId: 'non-existent-canteen-id',
        permissions: ['dish:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(400);

      expect(response.body.message).toContain('指定的食堂不存在');
    });

    it('should return 403 for normal admin without permission', async () => {
      const createDto = {
        username: 'unauthorizedcreate',
        password: 'Test@123!',
        permissions: ['dish:view'],
      };

      await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send(createDto)
        .expect(403);
    });
  });

  describe('/admin/admins (GET) - List Sub Admins', () => {
    it('should return list of sub admins for superadmin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(20);
    });

    it('should return list of sub admins for adminManager', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/admins')
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // Should only return sub admins created by adminManager
      response.body.data.items.forEach((admin: any) => {
        expect(admin.createdBy).toBeDefined();
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/admins?page=1&pageSize=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(5);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/admins')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/admins/:id/permissions (PUT) - Update Permissions', () => {
    it('should update sub admin permissions with superadmin', async () => {
      const updateDto = {
        permissions: ['dish:view', 'dish:edit', 'canteen:view'],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${createdSubAdminId}/permissions`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('操作成功');

      // Verify the permissions are updated
      const updatedAdmin = await prisma.admin.findUnique({
        where: { id: createdSubAdminId },
        include: { permissions: true },
      });
      expect(updatedAdmin?.permissions.map((p) => p.permission)).toEqual(
        expect.arrayContaining(updateDto.permissions),
      );
    });

    it('should update sub admin canteenId (management scope) with superadmin', async () => {
      const canteens = await prisma.canteen.findMany({ take: 2 });
      if (canteens.length < 2) {
        throw new Error('需要至少 2 个食堂数据用于测试更新 canteenId');
      }

      // 先让目标子管理员绑定到 canteens[0]
      await prisma.admin.update({
        where: { id: createdSubAdminId },
        data: { canteenId: canteens[0].id },
      });

      const updateDto = {
        permissions: ['dish:view'],
        canteenId: canteens[1].id,
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${createdSubAdminId}/permissions`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);

      const updatedAdmin = await prisma.admin.findUnique({
        where: { id: createdSubAdminId },
      });
      expect(updatedAdmin?.canteenId).toBe(canteens[1].id);
    });

    it('should return 400 for non-existent canteenId when updating permissions', async () => {
      const updateDto = {
        permissions: ['dish:view'],
        canteenId: 'non-existent-canteen-id',
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${createdSubAdminId}/permissions`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(400);

      expect(response.body.message).toContain('指定的食堂不存在');
    });

    it('should update permissions for own sub admin with adminManager', async () => {
      // First, create a sub admin by adminManager
      const createDto = {
        username: 'managertoupdate',
        password: 'Test@123!',
        permissions: ['dish:view'],
      };

      const createResponse = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(createDto)
        .expect(201);

      const subAdminId = createResponse.body.data.id;

      // Now update the permissions
      const updateDto = {
        permissions: ['dish:view', 'dish:edit'],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/permissions`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);

      // Cleanup
      await prisma.admin.delete({ where: { id: subAdminId } });
    });

    it('should return 404 for non-existent sub admin', async () => {
      const updateDto = {
        permissions: ['dish:view'],
      };

      await request(app.getHttpServer())
        .put('/admin/admins/non-existent-id/permissions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(404);
    });

    it('should return 403 when updating another admin sub admin', async () => {
      // Try to update a sub admin created by superadmin using adminManager token
      const updateDto = {
        permissions: ['dish:view'],
      };

      await request(app.getHttpServer())
        .put(`/admin/admins/${createdSubAdminId}/permissions`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('should return 403 for normal admin without permission', async () => {
      const updateDto = {
        permissions: ['dish:view'],
      };

      await request(app.getHttpServer())
        .put(`/admin/admins/${createdSubAdminId}/permissions`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('/admin/admins/:id (DELETE) - Delete Sub Admin', () => {
    it('should return 403 when adminManager tries to delete another admin sub admin', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/admins/${createdSubAdminId}`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent sub admin', async () => {
      await request(app.getHttpServer())
        .delete('/admin/admins/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/admins/${createdSubAdminId}`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should delete sub admin with adminManager (own sub admin)', async () => {
      // First, create a sub admin by adminManager
      const createDto = {
        username: 'managertodelete',
        password: 'Test@123!',
        permissions: ['dish:view'],
      };

      const createResponse = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(createDto)
        .expect(201);

      const subAdminId = createResponse.body.data.id;

      // Now delete
      const response = await request(app.getHttpServer())
        .delete(`/admin/admins/${subAdminId}`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('操作成功');

      // Verify deletion
      const deletedAdmin = await prisma.admin.findUnique({
        where: { id: subAdminId },
      });
      expect(deletedAdmin).toBeNull();
    });

    it('should delete sub admin with superadmin', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/admins/${createdSubAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('操作成功');

      // Verify deletion
      const deletedAdmin = await prisma.admin.findUnique({
        where: { id: createdSubAdminId },
      });
      expect(deletedAdmin).toBeNull();

      createdSubAdminId = ''; // Prevent cleanup failure
    });
  });

  describe('Authorization Tests', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/admins').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/admin/admins')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
