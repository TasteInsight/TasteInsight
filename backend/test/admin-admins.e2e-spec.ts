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
  const createdAdminIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');

    // Login as super admin
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    const managerCredentials = {
      username: 'adminsmgrfixture',
      password: 'ManagerFixture@123',
    };
    const manager = await request(app.getHttpServer())
      .post('/admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        ...managerCredentials,
        permissions: [
          'admin:view',
          'admin:create',
          'admin:edit',
          'admin:delete',
          'dish:view',
          'dish:edit',
          'canteen:view',
        ],
      })
      .expect(201);
    createdAdminIds.push(manager.body.data.id);

    // Login as a manager able to delegate the permissions used by this suite.
    const adminManagerLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send(managerCredentials)
      .expect(200);
    adminManagerToken = adminManagerLogin.body.data.token.accessToken;

    // Login as normal admin (no admin:* permissions)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;
  });

  afterAll(async () => {
    try {
      // Remove child fixtures before their creator and preserve audit foreign keys.
      for (const id of [...createdAdminIds].reverse()) {
        await prisma.operationLog.deleteMany({ where: { adminId: id } });
        await prisma.admin.deleteMany({ where: { id } });
      }
    } finally {
      await app.close();
    }
  });

  describe('/admin/admins (POST) - Create Sub Admin', () => {
    it('should create a new sub admin with superadmin', async () => {
      const createDto = {
        username: 'newsubadmin',
        password: 'Test@123!',
        permissions: ['dish:view', 'dish:create', 'canteen:view'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);
      createdAdminIds.push(response.body.data.id);

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
      createdAdminIds.push(response.body.data.id);

      expect(response.body.code).toBe(200);
      expect(response.body.data.username).toBe(createDto.username);
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
      createdAdminIds.push(response.body.data.id);

      expect(response.body.code).toBe(200);
      expect(response.body.data.canteenId).toBe(canteen?.id);
      expect(response.body.data.canteenName).toBe(canteen?.name);
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

    it('should include canteenName for admins with canteenId', async () => {
      // First create a sub admin with canteenId
      const canteen = await prisma.canteen.findFirst();
      const createDto = {
        username: 'testcanteenname',
        password: 'Test@123!',
        canteenId: canteen?.id,
        permissions: ['dish:view'],
      };

      const createResponse = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(201);

      const subAdminId = createResponse.body.data.id;
      createdAdminIds.push(subAdminId);

      // Now list and verify canteenName is included
      const listResponse = await request(app.getHttpServer())
        .get('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const createdAdmin = listResponse.body.data.items.find(
        (admin: any) => admin.id === subAdminId,
      );
      expect(createdAdmin).toBeDefined();
      expect(createdAdmin.canteenId).toBe(canteen?.id);
      expect(createdAdmin.canteenName).toBe(canteen?.name);
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

    it('should update sub admin canteenId to null (all canteens scope) with superadmin', async () => {
      // 先让目标子管理员绑定到一个食堂
      const canteen = await prisma.canteen.findFirst();
      if (!canteen) {
        throw new Error('需要至少 1 个食堂数据用于测试更新 canteenId 为 null');
      }

      await prisma.admin.update({
        where: { id: createdSubAdminId },
        data: { canteenId: canteen.id },
      });

      const updateDto = {
        permissions: ['dish:view'],
        canteenId: null, // 设置为 null 表示管理所有食堂
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
      expect(updatedAdmin?.canteenId).toBeNull();
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
      createdAdminIds.push(subAdminId);

      // Now update the permissions
      const updateDto = {
        permissions: ['dish:view', 'dish:edit', 'canteen:view'],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/permissions`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
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
    const expectRetirement = async (
      id: string,
      credentials: { username: string; password: string },
      operatorToken: string,
    ) => {
      const login = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(credentials)
        .expect(200);
      const { accessToken, refreshToken } = login.body.data.token;
      await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const before = await prisma.admin.findUniqueOrThrow({
        where: { id },
        include: { permissions: true },
      });
      const previousList = await request(app.getHttpServer())
        .get('/admin/admins?pageSize=100')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(previousList.body.data.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );

      const response = await request(app.getHttpServer())
        .delete(`/admin/admins/${id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('操作成功');

      const retired = await prisma.admin.findUnique({
        where: { id },
        include: { permissions: true },
      });
      expect(retired).toMatchObject({
        id,
        username: before.username,
        createdBy: before.createdBy,
        deletedAt: expect.any(Date),
        permissions: before.permissions,
      });

      const currentList = await request(app.getHttpServer())
        .get('/admin/admins?pageSize=100')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(currentList.body.data.items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );
      expect(currentList.body.data.meta.total).toBe(
        previousList.body.data.meta.total - 1,
      );
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(credentials)
        .expect(401);
      await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    };

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

    it('should retire an own sub admin with adminManager', async () => {
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
      createdAdminIds.push(subAdminId);

      await expectRetirement(
        subAdminId,
        { username: createDto.username, password: createDto.password },
        adminManagerToken,
      );
    });

    it('should retire a sub admin with superadmin', async () => {
      await expectRetirement(
        createdSubAdminId,
        { username: 'newsubadmin', password: 'Test@123!' },
        superAdminToken,
      );
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

  describe('/admin/admins/me/password (PUT) - Change Own Password', () => {
    let testAdminToken: string;
    const testAdminPassword = 'TestAdmin@123';
    const newPassword = 'NewTestAdmin@456';

    beforeAll(async () => {
      // Create a test admin for password change tests
      const createResponse = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: 'pwdtestadmin',
          password: testAdminPassword,
          permissions: ['dish:view'],
        })
        .expect(201);

      createdAdminIds.push(createResponse.body.data.id);

      // Login as the test admin
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'pwdtestadmin', password: testAdminPassword });
      testAdminToken = loginResponse.body.data.token.accessToken;
    });

    it('should change own password successfully', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/admins/me/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: testAdminPassword,
          newPassword: newPassword,
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('密码修改成功');

      // Verify new password works
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'pwdtestadmin', password: newPassword })
        .expect(200);

      expect(loginResponse.body.code).toBe(200);

      // Update token for subsequent tests
      testAdminToken = loginResponse.body.data.token.accessToken;
    });

    it('should return 400 for wrong current password', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/admins/me/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'WrongPassword@123',
          newPassword: 'AnotherNew@456',
        })
        .expect(400);

      expect(response.body.message).toContain('当前密码错误');
    });

    it('should return 400 for same password', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/admins/me/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: newPassword,
        })
        .expect(400);

      expect(response.body.message).toContain('新密码不能与当前密码相同');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app.getHttpServer())
        .put('/admin/admins/me/password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('/admin/admins/:id/password (PUT) - Change Sub Admin Password', () => {
    let subAdminId: string;
    const subAdminPassword = 'SubAdmin@123';
    const newSubAdminPassword = 'NewSubAdmin@456';

    beforeAll(async () => {
      // Create a sub admin for password reset tests
      const createResponse = await request(app.getHttpServer())
        .post('/admin/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          username: 'subadminpwdtest',
          password: subAdminPassword,
          permissions: ['dish:view'],
        })
        .expect(201);

      subAdminId = createResponse.body.data.id;
      createdAdminIds.push(subAdminId);
    });

    it('should reset sub admin password with superadmin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newPassword: newSubAdminPassword })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('密码修改成功');

      // Verify new password works
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'subadminpwdtest', password: newSubAdminPassword })
        .expect(200);

      expect(loginResponse.body.code).toBe(200);
    });

    it('should return 404 for non-existent sub admin', async () => {
      await request(app.getHttpServer())
        .put('/admin/admins/non-existent-id/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newPassword: newSubAdminPassword })
        .expect(404);
    });

    it('should return 403 when modifying another admin created sub admin', async () => {
      await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/password`)
        .set('Authorization', `Bearer ${adminManagerToken}`)
        .send({ newPassword: newSubAdminPassword })
        .expect(403);
    });

    it('should return 403 for normal admin without permission', async () => {
      await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/password`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({ newPassword: newSubAdminPassword })
        .expect(403);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/admins/${subAdminId}/password`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newPassword: 'weak' })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });
});
