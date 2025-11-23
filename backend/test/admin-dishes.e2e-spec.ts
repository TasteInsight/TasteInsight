// test/admin-dishes.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('AdminDishesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let normalAdminToken: string;
  let limitedAdminToken: string;
  let canteenAdminToken: string;
  let userToken: string;
  let testDishId: string;
  let canteen1Id: string;
  let canteen2Id: string;

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

    // 获取普通管理员token (只有查看权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // 获取限制管理员token (有查看和编辑权限)
    const limitedAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'limitedadmin', password: 'limited123' });
    limitedAdminToken = limitedAdminLogin.body.data.token.accessToken;

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
    const dish = await prisma.dish.findFirst({
      where: { name: '宫保鸡丁' },
    });
    testDishId = dish?.id || '';

    const canteen1 = await prisma.canteen.findFirst({
      where: { name: '第一食堂' },
    });
    canteen1Id = canteen1?.id || '';

    const canteen2 = await prisma.canteen.findFirst({
      where: { name: '第二食堂' },
    });
    canteen2Id = canteen2?.id || '';
  });

  afterAll(async () => {
    // 清理测试过程中创建的菜品
    await prisma.dish.deleteMany({
      where: { name: { contains: '测试菜品' } },
    });
    await app.close();
  });

  describe('/admin/dishes (GET)', () => {
    it('should return paginated dish list for super admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(20);
    });

    it('should return dish list with pagination params', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes?page=1&pageSize=5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should filter dishes by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes?status=offline')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.status).toBe('offline');
      });
    });

    it('should filter dishes by canteenId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes?canteenId=${canteen1Id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.canteenId).toBe(canteen1Id);
      });
    });

    it('should search dishes by keyword', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes?keyword=宫保')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.items[0].name).toContain('宫保');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes')
        .expect(401);
    });

    it('should return 403 for user token (not admin)', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow admin with view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should filter dishes for canteen admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      // 食堂管理员只能看到自己食堂的菜品
      expect(response.body.data.items).toBeInstanceOf(Array);
      response.body.data.items.forEach((dish: any) => {
        expect(dish.canteenId).toBe(canteen1Id);
      });
    });

    it('should forbid canteen admin from viewing other canteen dishes', async () => {
      await request(app.getHttpServer())
        .get(`/admin/dishes?canteenId=${canteen2Id}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(403);
    });
  });

  describe('/admin/dishes/:id (GET)', () => {
    it('should return dish details for valid id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/${testDishId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testDishId);
      expect(response.body.data.name).toBe('宫保鸡丁');
    });

    it('should return 404 for non-existent dish', async () => {
      await request(app.getHttpServer())
        .get('/admin/dishes/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 403 for user without admin access', async () => {
      await request(app.getHttpServer())
        .get(`/admin/dishes/${testDishId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow canteen admin to view their canteen dish', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/dishes/${testDishId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should forbid canteen admin from viewing other canteen dish', async () => {
      const otherCanteenDish = await prisma.dish.findFirst({
        where: { canteenId: canteen2Id },
      });

      if (otherCanteenDish) {
        await request(app.getHttpServer())
          .get(`/admin/dishes/${otherCanteenDish.id}`)
          .set('Authorization', `Bearer ${canteenAdminToken}`)
          .expect(403);
      }
    });
  });

  describe('/admin/dishes (POST)', () => {
    it('should create a new dish with super admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: '测试菜品-创建',
          price: 20.0,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          tags: ['测试'],
          description: '这是一个测试菜品',
          status: 'offline',
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toBe('创建成功');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('测试菜品-创建');
      expect(response.body.data.price).toBe(20.0);
    });

    it('should fail to create dish without required fields', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: '测试菜品',
          // 缺少 price, canteenName, windowName
        })
        .expect(400);
    });

    it('should fail to create dish with invalid price', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: '测试菜品',
          price: -10,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
        })
        .expect(400);
    });

    it('should fail to create dish with non-existent canteen', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: '测试菜品',
          price: 20.0,
          canteenName: '不存在的食堂',
          windowName: '窗口',
        })
        .expect(400);
    });

    it('should return 403 for admin without create permission', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({
          name: '测试菜品',
          price: 20.0,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
        })
        .expect(403);
    });

    it('should allow canteen admin to create dish for their canteen', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          name: '测试菜品-食堂管理员创建',
          price: 25.0,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
        })
        .expect(201);

      expect(response.body.code).toBe(201);
    });

    it('should forbid canteen admin from creating dish for other canteen', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes')
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          name: '测试菜品',
          price: 25.0,
          canteenName: '第二食堂',
          windowName: '面食窗口',
        })
        .expect(403);
    });
  });

  describe('/admin/dishes/:id (PUT)', () => {
    let editDishId: string;

    beforeAll(async () => {
      // 创建一个专门用于编辑测试的菜品
      const dish = await prisma.dish.create({
        data: {
          name: '测试菜品-编辑',
          price: 30.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          availableMealTime: [],
          status: 'offline',
        },
      });
      editDishId = dish.id;
    });

    afterAll(async () => {
      await prisma.dish.delete({ where: { id: editDishId } }).catch(() => {});
    });

    it('should update dish with super admin', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/dishes/${editDishId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: '测试菜品-已更新',
          price: 35.0,
          description: '更新后的描述',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('更新成功');
      expect(response.body.data.name).toBe('测试菜品-已更新');
      expect(response.body.data.price).toBe(35.0);
    });

    it('should update only specified fields', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/dishes/${editDishId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'online',
        })
        .expect(200);

      expect(response.body.data.status).toBe('online');
      expect(response.body.data.name).toBe('测试菜品-已更新'); // 保持之前的值
    });

    it('should return 404 for non-existent dish', async () => {
      await request(app.getHttpServer())
        .put('/admin/dishes/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '测试' })
        .expect(404);
    });

    it('should return 403 for admin without edit permission', async () => {
      await request(app.getHttpServer())
        .put(`/admin/dishes/${editDishId}`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({ name: '测试' })
        .expect(403);
    });

    it('should allow admin with edit permission', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/dishes/${editDishId}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          description: '由限制管理员更新',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should allow canteen admin to edit their canteen dish', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/dishes/${editDishId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .send({
          description: '由食堂管理员更新',
        })
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should forbid canteen admin from editing other canteen dish', async () => {
      const otherCanteenDish = await prisma.dish.findFirst({
        where: { canteenId: canteen2Id },
      });

      if (otherCanteenDish) {
        await request(app.getHttpServer())
          .put(`/admin/dishes/${otherCanteenDish.id}`)
          .set('Authorization', `Bearer ${canteenAdminToken}`)
          .send({ name: '测试' })
          .expect(403);
      }
    });
  });

  describe('/admin/dishes/:id (DELETE)', () => {
    let deleteDishId: string;

    beforeEach(async () => {
      // 每次测试前创建一个新的菜品用于删除
      const dish = await prisma.dish.create({
        data: {
          name: '测试菜品-删除',
          price: 15.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          availableMealTime: [],
          status: 'offline',
        },
      });
      deleteDishId = dish.id;
    });

    it('should delete dish with super admin', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/dishes/${deleteDishId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('删除成功');

      // 验证菜品已被删除
      const dish = await prisma.dish.findUnique({
        where: { id: deleteDishId },
      });
      expect(dish).toBeNull();
    });

    it('should return 404 for non-existent dish', async () => {
      await request(app.getHttpServer())
        .delete('/admin/dishes/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 403 for admin without delete permission', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/dishes/${deleteDishId}`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);
    });

    it('should return 403 for admin with only edit permission', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/dishes/${deleteDishId}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should allow canteen admin to delete their canteen dish', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/dishes/${deleteDishId}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
    });

    it('should forbid canteen admin from deleting other canteen dish', async () => {
      const otherCanteenDish = await prisma.dish.create({
        data: {
          name: '测试菜品-其他食堂',
          price: 15.0,
          canteenId: canteen2Id,
          canteenName: '第二食堂',
          windowName: '面食窗口',
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          availableMealTime: [],
          status: 'offline',
        },
      });

      await request(app.getHttpServer())
        .delete(`/admin/dishes/${otherCanteenDish.id}`)
        .set('Authorization', `Bearer ${canteenAdminToken}`)
        .expect(403);

      // 清理
      await prisma.dish.delete({ where: { id: otherCanteenDish.id } });
    });

    it('should fail to delete dish with sub-dishes', async () => {
      // 创建父菜品和子菜品
      const parentDish = await prisma.dish.create({
        data: {
          name: '测试父菜品',
          price: 20.0,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          availableMealTime: [],
          status: 'offline',
        },
      });

      const childDish = await prisma.dish.create({
        data: {
          name: '测试子菜品',
          price: 10.0,
          parentDishId: parentDish.id,
          canteenId: canteen1Id,
          canteenName: '第一食堂',
          windowName: '川菜窗口',
          tags: [],
          images: [],
          ingredients: [],
          allergens: [],
          availableMealTime: [],
          status: 'offline',
        },
      });

      await request(app.getHttpServer())
        .delete(`/admin/dishes/${parentDish.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      // 清理
      await prisma.dish.delete({ where: { id: childDish.id } });
      await prisma.dish.delete({ where: { id: parentDish.id } });
    });
  });

  describe('/admin/dishes/:id/status (PATCH)', () => {
    it('should update dish status for super admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/dishes/${testDishId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'offline' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('状态修改成功');

      // Verify in DB
      const updatedDish = await prisma.dish.findUnique({
        where: { id: testDishId },
      });
      expect(updatedDish?.status).toBe('offline');
      
      // Restore status
      await prisma.dish.update({
        where: { id: testDishId },
        data: { status: 'online' },
      });
    });

    it('should fail with invalid status', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/dishes/${testDishId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    it('should fail for normal admin without edit permission', async () => {
      // normalAdmin has only view permission
      await request(app.getHttpServer())
        .patch(`/admin/dishes/${testDishId}/status`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({ status: 'offline' })
        .expect(403);
    });
  });
});
