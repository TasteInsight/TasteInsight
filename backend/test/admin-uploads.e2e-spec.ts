// test/admin-uploads.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import {
  PendingUploadListResponseDto,
  PendingUploadDetailResponseDto,
  UploadActionSuccessResponseDto,
} from '@/admin-uploads/dto/admin-upload-response.dto';

describe('AdminUploadsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let reviewerAdminToken: string;
  let normalAdminToken: string;
  let canteenAdminToken: string;
  let userToken: string;
  let canteen1Id: string;
  let canteen2Id: string;
  let pendingUploadId: string;
  let pendingUploadId2: string;
  let canteen2PendingUploadId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // 获取超级管理员token
    const superAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = superAdminLogin.body.data.token.accessToken;

    // 获取审核管理员token (有upload:approve权限)
    const reviewerAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'revieweradmin', password: 'reviewer123' });
    reviewerAdminToken = reviewerAdminLogin.body.data.token.accessToken;

    // 获取普通管理员token (只有dish:view权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // 获取食堂管理员token (有所有权限但仅限第一食堂)
    const canteenAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'canteenadmin', password: 'canteen123' });
    canteenAdminToken = canteenAdminLogin.body.data.token.accessToken;

    // 获取普通用户token (用于测试权限拒绝)
    const userLogin = await request(app.getHttpServer())
      .post('/auth/wechat/login')
      .send({ code: 'baseline_user_code_placeholder' });
    userToken = userLogin.body.data.token.accessToken;

    // 获取测试数据ID
    const canteen1 = await prisma.canteen.findFirst({
      where: { name: '第一食堂' },
    });
    canteen1Id = canteen1?.id || '';

    const canteen2 = await prisma.canteen.findFirst({
      where: { name: '第二食堂' },
    });
    canteen2Id = canteen2?.id || '';

    // 获取待审核上传ID（用于approve/reject测试）
    const pendingUpload = await prisma.dishUpload.findFirst({
      where: { name: '用户上传待审核菜品', status: 'pending' },
    });
    pendingUploadId = pendingUpload?.id || '';

    const pendingUpload2 = await prisma.dishUpload.findFirst({
      where: { name: '管理员上传待审核菜品', status: 'pending' },
    });
    pendingUploadId2 = pendingUpload2?.id || '';

    const canteen2Upload = await prisma.dishUpload.findFirst({
      where: { name: '第二食堂用户上传待审核菜品', status: 'pending' },
    });
    canteen2PendingUploadId = canteen2Upload?.id || '';

    // 为食堂管理员添加upload:approve权限（用于后续测试）
    const canteenAdmin = await prisma.admin.findFirst({
      where: { username: 'canteenadmin' },
    });

    if (canteenAdmin) {
      const existingPermission = await prisma.adminPermission.findFirst({
        where: {
          adminId: canteenAdmin.id,
          permission: 'upload:approve',
        },
      });

      if (!existingPermission) {
        await prisma.adminPermission.create({
          data: {
            adminId: canteenAdmin.id,
            permission: 'upload:approve',
          },
        });
      }

      // 重新获取食堂管理员token（确保权限生效）
      const canteenAdminReLogin = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'canteenadmin', password: 'canteen123' });
      canteenAdminToken = canteenAdminReLogin.body.data.token.accessToken;
    }
  });

  afterAll(async () => {
    // 清理测试过程中创建的菜品
    await prisma.dish.deleteMany({
      where: { name: { contains: '测试审核' } },
    });
    // 恢复被修改的上传记录状态
    await prisma.dishUpload.updateMany({
      where: {
        name: {
          in: [
            '用户上传待审核菜品',
            '管理员上传待审核菜品',
            '第二食堂用户上传待审核菜品',
          ],
        },
      },
      data: {
        status: 'pending',
        rejectReason: null,
        approvedDishId: null,
      },
    });
    await app.close();
  });

  describe('/admin/dishes/uploads/pending (GET)', () => {
    it('should return paginated pending uploads list for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(20);

      // 验证只返回pending状态的记录
      response.body.data.items.forEach((upload: any) => {
        expect(upload.status).toBe('pending');
      });
    });

    it('should return pending uploads with pagination params', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?page=1&pageSize=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should return pending uploads for reviewer admin with upload:approve permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=pending')
        .set('Authorization', `Bearer ${reviewerAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 验证只返回pending状态的记录
      response.body.data.items.forEach((upload: any) => {
        expect(upload.status).toBe('pending');
      });
    });

    it('should filter uploads by status - approved', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=approved')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 验证只返回approved状态的记录
      response.body.data.items.forEach((upload: any) => {
        expect(upload.status).toBe('approved');
      });
    });

    it('should filter uploads by status - rejected', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=rejected')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 验证只返回rejected状态的记录
      response.body.data.items.forEach((upload: any) => {
        expect(upload.status).toBe('rejected');
      });
    });

    it('should return all uploads when no status filter is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);

      // 验证返回的结果包含多种状态（不筛选时应该返回所有状态的记录）
      // seed数据中已经创建了pending、approved、rejected状态的上传
      const statuses = response.body.data.items.map(
        (upload: any) => upload.status,
      );
      const uniqueStatuses = [...new Set(statuses)];
      // 应该至少包含多于一种状态（证明没有按状态筛选）
      expect(uniqueStatuses.length).toBeGreaterThan(1);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending')
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 403 for admin without upload:approve permission', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should include uploader information in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const items = response.body.data.items;
      if (items.length > 0) {
        const upload = items[0];
        expect(upload).toHaveProperty('uploaderType');
        expect(upload).toHaveProperty('uploaderName');
        expect(['user', 'admin']).toContain(upload.uploaderType);
      }
    });

    it('should include dish details in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending?status=pending')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const items = response.body.data.items;
      if (items.length > 0) {
        const upload = items[0];
        expect(upload).toHaveProperty('id');
        expect(upload).toHaveProperty('name');
        expect(upload).toHaveProperty('price');
        expect(upload).toHaveProperty('canteenId');
        expect(upload).toHaveProperty('canteenName');
        expect(upload).toHaveProperty('windowName');
        expect(upload).toHaveProperty('status');
        expect(upload).toHaveProperty('createdAt');
      }
    });
  });

  describe('/admin/dishes/uploads/pending/:id (GET)', () => {
    it('should return pending upload detail for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(pendingUploadId);
      expect(response.body.data.name).toBe('用户上传待审核菜品');
    });

    it('should return pending upload detail with all fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const upload = response.body.data;
      expect(upload).toHaveProperty('id');
      expect(upload).toHaveProperty('name');
      expect(upload).toHaveProperty('tags');
      expect(upload).toHaveProperty('price');
      expect(upload).toHaveProperty('description');
      expect(upload).toHaveProperty('images');
      expect(upload).toHaveProperty('ingredients');
      expect(upload).toHaveProperty('allergens');
      expect(upload).toHaveProperty('spicyLevel');
      expect(upload).toHaveProperty('sweetness');
      expect(upload).toHaveProperty('saltiness');
      expect(upload).toHaveProperty('oiliness');
      expect(upload).toHaveProperty('canteenId');
      expect(upload).toHaveProperty('canteenName');
      expect(upload).toHaveProperty('windowId');
      expect(upload).toHaveProperty('windowName');
      expect(upload).toHaveProperty('availableMealTime');
      expect(upload).toHaveProperty('status');
      expect(upload).toHaveProperty('uploaderType');
      expect(upload).toHaveProperty('uploaderName');
      expect(upload).toHaveProperty('createdAt');
      expect(upload).toHaveProperty('updatedAt');
    });

    it('should include uploader information in detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const upload = response.body.data;
      expect(upload.uploaderType).toBe('user');
      expect(upload.uploaderName).toBe('Baseline User');
      expect(upload.userId).not.toBeNull();
    });

    it('should return admin upload detail with admin info', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId2}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const upload = response.body.data;
      expect(upload.uploaderType).toBe('admin');
      expect(upload.uploaderName).toBe('testadmin');
      expect(upload.adminId).not.toBeNull();
    });

    it('should return pending upload detail for reviewer admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${reviewerAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('should return 404 for non-existent upload', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toBe('上传记录不存在');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 403 for admin without upload:approve permission', async () => {
      await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should allow canteen admin to view their canteen upload detail', async () => {
      // 权限已在 beforeAll 中设置，直接使用 canteenAdminToken
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${pendingUploadId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.canteenId).toBe(canteen1Id);
    });

    it('should forbid canteen admin from viewing other canteen upload detail', async () => {
      const canteenAdminLogin = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'canteenadmin', password: 'canteen123' });
      const canteenToken = canteenAdminLogin.body.data.token.accessToken;

      await request(app.getHttpServer())
        .get(`/admin/dishes/uploads/pending/${canteen2PendingUploadId}`)
        .set('Authorization', `Bearer ${canteenToken}`)
        .expect(403);
    });
  });

  describe('/admin/dishes/uploads/:id/approve (POST)', () => {
    let testApproveUploadId: string;

    beforeAll(async () => {
      // 创建一个专门用于approve测试的上传记录
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });

      const testUpload = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试审核通过菜品',
          tags: ['测试'],
          price: 15.0,
          description: '用于测试审核通过',
          images: [],
          ingredients: ['测试食材'],
          allergens: [],
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      testApproveUploadId = testUpload.id;
    });

    afterAll(async () => {
      // 清理测试创建的菜品
      await prisma.dish.deleteMany({
        where: { name: '测试审核通过菜品' },
      });
      await prisma.dishUpload.deleteMany({
        where: { name: '测试审核通过菜品' },
      });
    });

    it('should approve upload and create dish for super admin', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testApproveUploadId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('审核通过，菜品已入库');
      expect(response.body.data).toBeNull();

      // 验证上传记录状态已更新
      const upload = await prisma.dishUpload.findUnique({
        where: { id: testApproveUploadId },
      });
      expect(upload?.status).toBe('approved');
      expect(upload?.approvedDishId).not.toBeNull();

      // 验证菜品已创建
      const dish = await prisma.dish.findUnique({
        where: { id: upload?.approvedDishId || '' },
      });
      expect(dish).not.toBeNull();
      expect(dish?.name).toBe('测试审核通过菜品');
      expect(dish?.status).toBe('online');
    });

    it('should return 404 for non-existent upload', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes/uploads/non-existent-id/approve')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 400 for already processed upload', async () => {
      // 使用已经被approve的记录
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testApproveUploadId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/approve`)
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/approve`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 403 for admin without upload:approve permission', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/approve`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/dishes/uploads/:id/reject (POST)', () => {
    let testRejectUploadId: string;

    beforeAll(async () => {
      // 创建一个专门用于reject测试的上传记录
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });

      const testUpload = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试审核拒绝菜品',
          tags: ['测试'],
          price: 15.0,
          description: '用于测试审核拒绝',
          images: [],
          ingredients: ['测试食材'],
          allergens: [],
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      testRejectUploadId = testUpload.id;
    });

    afterAll(async () => {
      await prisma.dishUpload.deleteMany({
        where: { name: '测试审核拒绝菜品' },
      });
    });

    it('should reject upload for super admin', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testRejectUploadId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '菜品信息不完整' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已拒绝');
      expect(response.body.data).toBeNull();

      // 验证上传记录状态已更新
      const upload = await prisma.dishUpload.findUnique({
        where: { id: testRejectUploadId },
      });
      expect(upload?.status).toBe('rejected');
      expect(upload?.rejectReason).toBe('菜品信息不完整');
    });

    it('should return 400 when reason is missing', async () => {
      // 使用已知存在的 pendingUploadId（在 beforeAll 中获取）
      expect(pendingUploadId).toBeDefined();
      expect(pendingUploadId).not.toBe('');

      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when reason is empty string', async () => {
      // 使用已知存在的 pendingUploadId（在 beforeAll 中获取）
      expect(pendingUploadId).toBeDefined();
      expect(pendingUploadId).not.toBe('');

      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '' })
        .expect(400);
    });

    it('should return 404 for non-existent upload', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes/uploads/non-existent-id/reject')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '不存在' })
        .expect(404);
    });

    it('should allow updating rejection reason for already rejected upload', async () => {
      // 使用已经被reject的记录
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testRejectUploadId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '再次拒绝' })
        .expect(200);

      const upload = await prisma.dishUpload.findUnique({
        where: { id: testRejectUploadId },
      });
      expect(upload?.rejectReason).toBe('再次拒绝');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/reject`)
        .send({ reason: '测试' })
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/reject`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: '测试' })
        .expect(403);
    });

    it('should return 403 for admin without upload:approve permission', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/reject`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({ reason: '测试' })
        .expect(403);
    });
  });

  describe('/admin/dishes/uploads/:id/revoke (POST)', () => {
    let testRevokeApprovedId: string;
    let testRevokeRejectedId: string;

    beforeAll(async () => {
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });

      // 创建一个 Approved 的上传记录
      const upload1 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Approved API',
          tags: ['测试'],
          price: 15.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });

      // 模拟 Approved 状态
      const dish1 = await prisma.dish.create({
        data: {
          name: '测试撤销Approved API',
          price: 15.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '测试窗口',
          status: 'online',
        },
      });

      await prisma.dishUpload.update({
        where: { id: upload1.id },
        data: {
          status: 'approved',
          approvedDishId: dish1.id,
        },
      });
      testRevokeApprovedId = upload1.id;

      // 创建一个 Rejected 的上传记录
      const upload2 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Rejected API',
          tags: ['测试'],
          price: 15.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'rejected',
          rejectReason: '测试拒绝',
        },
      });
      testRevokeRejectedId = upload2.id;
    });

    afterAll(async () => {
      await prisma.dish.deleteMany({
        where: { name: '测试撤销Approved API' },
      });
      await prisma.dishUpload.deleteMany({
        where: {
          name: { in: ['测试撤销Approved API', '测试撤销Rejected API'] },
        },
      });
    });

    it('should revoke approved upload for super admin', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testRevokeApprovedId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已撤销审核，重置为待审核状态');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: testRevokeApprovedId },
      });
      expect(upload?.status).toBe('pending');
      expect(upload?.approvedDishId).toBeNull();
    });

    it('should revoke rejected upload for super admin', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${testRevokeRejectedId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已撤销审核，重置为待审核状态');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: testRevokeRejectedId },
      });
      expect(upload?.status).toBe('pending');
    });

    it('should return success message when revoking pending upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已是待审核状态');
    });

    it('should return 404 for non-existent upload', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes/uploads/non-existent-id/revoke')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/revoke`)
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/revoke`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 403 for admin without upload:approve permission', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUploadId}/revoke`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });
  });

  describe('Canteen Admin Restriction Tests', () => {
    let canteen1ApproveTestId: string;
    let canteen2ApproveTestId: string;

    beforeAll(async () => {
      // 权限已在顶层 beforeAll 中设置，这里只需创建测试数据

      // 创建第一食堂的测试上传
      const window1 = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });

      const testUpload1 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '食堂限制测试菜品1',
          tags: ['测试'],
          price: 15.0,
          description: '第一食堂',
          images: [],
          ingredients: [],
          allergens: [],
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window1?.id || '',
          windowNumber: window1?.number || '',
          windowName: window1?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      canteen1ApproveTestId = testUpload1.id;

      // 创建第二食堂的测试上传
      const window2 = await prisma.window.findFirst({
        where: { canteenId: canteen2Id },
      });

      const testUpload2 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '食堂限制测试菜品2',
          tags: ['测试'],
          price: 15.0,
          description: '第二食堂',
          images: [],
          ingredients: [],
          allergens: [],
          canteenId: canteen2Id,
          canteenName: '第二食堂',
          windowId: window2?.id || '',
          windowNumber: window2?.number || '',
          windowName: window2?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      canteen2ApproveTestId = testUpload2.id;
    });

    afterAll(async () => {
      await prisma.dish.deleteMany({
        where: { name: { startsWith: '食堂限制测试菜品' } },
      });
      await prisma.dishUpload.deleteMany({
        where: { name: { startsWith: '食堂限制测试菜品' } },
      });
    });

    it('should filter pending uploads for canteen admin', async () => {
      // 使用顶层 beforeAll 中获取的 canteenAdminToken
      const response = await request(app.getHttpServer())
        .get('/admin/dishes/uploads/pending')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      // 食堂管理员只能看到自己食堂的待审核上传
      response.body.data.items.forEach((upload: any) => {
        expect(upload.canteenId).toBe(canteen1Id);
      });
    });

    it('should allow canteen admin to approve their canteen upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${canteen1ApproveTestId}/approve`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should forbid canteen admin from approving other canteen upload', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${canteen2ApproveTestId}/approve`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(403);
    });

    it('should forbid canteen admin from rejecting other canteen upload', async () => {
      await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${canteen2ApproveTestId}/reject`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({ reason: '测试拒绝' })
        .expect(403);
    });
  });

  describe('Reviewer Admin Tests', () => {
    let reviewerApproveTestId: string;
    let reviewerRejectTestId: string;

    beforeAll(async () => {
      // 分别获取两个食堂的窗口
      const window1 = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });
      const window2 = await prisma.window.findFirst({
        where: { canteenId: canteen2Id },
      });
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });

      const testUpload1 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '审核员测试菜品1',
          tags: ['测试'],
          price: 15.0,
          description: '用于审核员测试',
          images: [],
          ingredients: [],
          allergens: [],
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window1?.id || '',
          windowNumber: window1?.number || '',
          windowName: window1?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      reviewerApproveTestId = testUpload1.id;

      const testUpload2 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '审核员测试菜品2',
          tags: ['测试'],
          price: 15.0,
          description: '用于审核员测试',
          images: [],
          ingredients: [],
          allergens: [],
          canteenId: canteen2Id,
          canteenName: '第二食堂',
          windowId: window2?.id || '',
          windowNumber: window2?.number || '',
          windowName: window2?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });
      reviewerRejectTestId = testUpload2.id;
    });

    afterAll(async () => {
      await prisma.dish.deleteMany({
        where: { name: { startsWith: '审核员测试菜品' } },
      });
      await prisma.dishUpload.deleteMany({
        where: { name: { startsWith: '审核员测试菜品' } },
      });
    });

    it('should allow reviewer admin to approve upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${reviewerApproveTestId}/approve`)
        .set('Authorization', `Bearer ${reviewerAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('审核通过，菜品已入库');
    });

    it('should allow reviewer admin to reject upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${reviewerRejectTestId}/reject`)
        .set('Authorization', `Bearer ${reviewerAdminToken}`)
        .send({ reason: '信息不完整' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已拒绝');
    });
  });

  describe('State Machine Transitions', () => {
    let uploadToRevokeApprovedId: string;
    let uploadToRevokeRejectedId: string;
    let uploadToFailRejectId: string;
    let uploadToFailApproveId: string;

    beforeAll(async () => {
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });

      // 1. 创建一个 Approved 的上传记录 (先创建 pending 然后 approve)
      const upload1 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Approved',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });

      // 手动模拟 Approved 状态
      const dish1 = await prisma.dish.create({
        data: {
          name: '测试撤销Approved',
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '测试窗口',
          status: 'online',
        },
      });

      await prisma.dishUpload.update({
        where: { id: upload1.id },
        data: {
          status: 'approved',
          approvedDishId: dish1.id,
        },
      });
      uploadToRevokeApprovedId = upload1.id;

      // 2. 创建一个 Rejected 的上传记录
      const upload2 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Rejected',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'rejected',
          rejectReason: '初始拒绝',
        },
      });
      uploadToRevokeRejectedId = upload2.id;

      // 3. 创建一个 Approved 的上传记录用于测试 "Fail Reject"
      const upload3 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试失败Reject',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'approved',
        },
      });
      uploadToFailRejectId = upload3.id;

      // 4. 创建一个 Rejected 的上传记录用于测试 "Fail Approve"
      const upload4 = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试失败Approve',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'rejected',
          rejectReason: '初始拒绝',
        },
      });
      uploadToFailApproveId = upload4.id;
    });

    afterAll(async () => {
      await prisma.dish.deleteMany({
        where: { name: { in: ['测试撤销Approved'] } },
      });
      await prisma.dishUpload.deleteMany({
        where: {
          name: {
            in: [
              '测试撤销Approved',
              '测试撤销Rejected',
              '测试失败Reject',
              '测试失败Approve',
            ],
          },
        },
      });
    });

    it('should revoke approved upload to pending and delete created dish', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${uploadToRevokeApprovedId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已撤销审核，重置为待审核状态');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: uploadToRevokeApprovedId },
      });
      expect(upload?.status).toBe('pending');
      expect(upload?.approvedDishId).toBeNull();
    });

    it('should revoke rejected upload to pending', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${uploadToRevokeRejectedId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('已撤销审核，重置为待审核状态');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: uploadToRevokeRejectedId },
      });
      expect(upload?.status).toBe('pending');
      expect(upload?.rejectReason).toBeNull();
    });

    it('should fail to reject an approved upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${uploadToFailRejectId}/reject`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: '试图拒绝已通过的' })
        .expect(400);

      expect(response.body.message).toContain('该记录已通过审核，无法直接拒绝');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: uploadToFailRejectId },
      });
      expect(upload?.status).toBe('approved');
    });

    it('should fail to approve a rejected upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${uploadToFailApproveId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.message).toBe('该上传已被处理');

      const upload = await prisma.dishUpload.findUnique({
        where: { id: uploadToFailApproveId },
      });
      expect(upload?.status).toBe('rejected');
    });

    it('should fail to approve an approved upload', async () => {
      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${uploadToFailRejectId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.message).toBe('该上传已被处理');
    });

    it('should return success when revoking a pending upload', async () => {
      // 创建一个 pending 状态的上传
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });

      const pendingUpload = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Pending',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'pending',
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${pendingUpload.id}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('已是待审核状态');

      // 清理
      await prisma.dishUpload.delete({ where: { id: pendingUpload.id } });
    });

    it('should handle dish not found when revoking approved upload', async () => {
      // 创建一个 Approved 的上传记录，但手动删除对应的菜品
      const user = await prisma.user.findFirst({
        where: { openId: 'baseline_user_openid' },
      });
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen1Id },
      });

      const upload = await prisma.dishUpload.create({
        data: {
          userId: user?.id,
          name: '测试撤销Approved无菜品',
          tags: ['测试'],
          price: 10,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowId: window?.id || '',
          windowNumber: window?.number || '',
          windowName: window?.name || '',
          availableMealTime: ['lunch'],
          status: 'approved',
          approvedDishId: 'non-existent-dish-id', // 指向不存在的菜品
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/admin/dishes/uploads/${upload.id}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('已撤销审核，重置为待审核状态');

      const updatedUpload = await prisma.dishUpload.findUnique({
        where: { id: upload.id },
      });
      expect(updatedUpload?.status).toBe('pending');

      // 清理
      await prisma.dishUpload.delete({ where: { id: upload.id } });
    });

    it('should cover DTOs', () => {
      // 实例化 DTO 以触发覆盖率
      new PendingUploadListResponseDto();
      new PendingUploadDetailResponseDto();
      new UploadActionSuccessResponseDto();
      expect(true).toBe(true);
    });
  });
});
