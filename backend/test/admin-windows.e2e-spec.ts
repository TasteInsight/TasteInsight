import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminWindowsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let testCanteenId: string;
  let testFloorId: string;
  let createdWindowId: string;

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

    // Get test canteen (第一食堂 created in seed)
    const canteen = await prisma.canteen.findFirst({
      where: { name: '第一食堂' },
      include: { floors: true },
    });
    testCanteenId = canteen!.id;
    testFloorId = canteen!.floors[0]?.id;
  });

  afterAll(async () => {
    // Clean up created window if it exists
    if (createdWindowId) {
      try {
        await prisma.window.delete({ where: { id: createdWindowId } });
      } catch {
        // Ignore if already deleted
      }
    }
    await app.close();
  });

  describe('/admin/canteens/:canteenId/windows (GET)', () => {
    it('should return list of windows for a canteen', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/canteens/${testCanteenId}/windows`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.meta).toBeDefined();
      expect(response.body.data.meta.page).toBe(1);
      expect(response.body.data.meta.total).toBeGreaterThanOrEqual(0);

      // Verify window structure
      if (response.body.data.items.length > 0) {
        const window = response.body.data.items[0];
        expect(window).toHaveProperty('id');
        expect(window).toHaveProperty('canteenId');
        expect(window).toHaveProperty('name');
        expect(window).toHaveProperty('number');
        expect(window).toHaveProperty('tags');
        expect(window).toHaveProperty('floor');
      }
    });

    it('should return paginated results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/canteens/${testCanteenId}/windows?page=1&pageSize=1`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.meta.pageSize).toBe(1);
      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
    });

    it('should return 404 for non-existent canteen', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/canteens/non-existent-id/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get(`/admin/canteens/${testCanteenId}/windows`)
        .expect(401);
    });
  });

  describe('/admin/windows/:id (GET)', () => {
    it('should return window details by id', async () => {
      // First, get a window from the list
      const listResponse = await request(app.getHttpServer())
        .get(`/admin/canteens/${testCanteenId}/windows`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      if (listResponse.body.data.items.length > 0) {
        const windowId = listResponse.body.data.items[0].id;

        const response = await request(app.getHttpServer())
          .get(`/admin/windows/${windowId}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.message).toBe('success');
        expect(response.body.data).toHaveProperty('id', windowId);
        expect(response.body.data).toHaveProperty('canteenId');
        expect(response.body.data).toHaveProperty('name');
        expect(response.body.data).toHaveProperty('number');
        expect(response.body.data).toHaveProperty('tags');
        expect(response.body.data).toHaveProperty('floor');
      }
    });

    it('should return 404 for non-existent window', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/windows/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get('/admin/windows/some-id')
        .expect(401);
    });
  });

  describe('/admin/windows (POST)', () => {
    it('should create a new window with floor', async () => {
      const createDto = {
        canteenId: testCanteenId,
        name: 'Test Window',
        number: 'T1',
        position: 'Test Position',
        description: 'Test Description',
        floor: {
          level: '1',
          name: '一楼',
        },
        tags: ['测试', '新窗口'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.name).toBe(createDto.name);
      expect(response.body.data.number).toBe(createDto.number);
      expect(response.body.data.canteenId).toBe(testCanteenId);
      expect(response.body.data.tags).toEqual(createDto.tags);
      expect(response.body.data.floor).toBeDefined();
      expect(response.body.data.floor.level).toBe('1');

      createdWindowId = response.body.data.id;
    });

    it('should create a new window with new floor level', async () => {
      const createDto = {
        canteenId: testCanteenId,
        name: 'Second Floor Window',
        number: 'T2',
        position: 'Second Floor Position',
        description: 'Second Floor Description',
        floor: {
          level: '2',
          name: '二楼',
        },
        tags: ['二楼'],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.floor.level).toBe('2');
      expect(response.body.data.floor.name).toBe('二楼');

      // Clean up
      await prisma.window.delete({ where: { id: response.body.data.id } });
      // Also clean up the new floor
      await prisma.floor.delete({ where: { id: response.body.data.floorId } });
    });

    it('should create a window without floor', async () => {
      const createDto = {
        canteenId: testCanteenId,
        name: 'No Floor Window',
        number: 'T3',
        tags: [],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.floor).toBeNull();

      // Clean up
      await prisma.window.delete({ where: { id: response.body.data.id } });
    });

    it('should return 404 for non-existent canteen', async () => {
      const createDto = {
        canteenId: 'non-existent-id',
        name: 'Test Window',
        number: 'T1',
      };

      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          // Missing required fields
          description: 'Only description',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('/admin/windows/:id (PUT)', () => {
    it('should update the window', async () => {
      const updateDto = {
        name: 'Updated Window Name',
        number: 'T1-Updated',
        position: 'Updated Position',
        description: 'Updated Description',
        floor: {
          level: '1',
          name: '一楼',
        },
        tags: ['更新后', '测试'],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/windows/${createdWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.name).toBe(updateDto.name);
      expect(response.body.data.number).toBe(updateDto.number);
      expect(response.body.data.position).toBe(updateDto.position);
      expect(response.body.data.tags).toEqual(updateDto.tags);
    });

    it('should update window with different floor level', async () => {
      // Use a unique level that doesn't exist yet
      const uniqueLevel = '99';

      const updateDto = {
        name: 'Window on 99th Floor',
        number: 'T1-99F',
        floor: {
          level: uniqueLevel,
          name: '九十九楼',
        },
        tags: [],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/windows/${createdWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.floor.level).toBe(uniqueLevel);
      expect(response.body.data.floor.name).toBe('九十九楼');

      // Verify the floor was created
      const createdFloor = await prisma.floor.findFirst({
        where: { canteenId: testCanteenId, level: uniqueLevel },
      });
      expect(createdFloor).not.toBeNull();
      expect(response.body.data.floorId).toBe(createdFloor?.id);
    });

    it('should update window without changing floor when floor is not provided', async () => {
      // Get current window state
      const currentWindow = await prisma.window.findUnique({
        where: { id: createdWindowId },
        include: { floor: true },
      });
      const originalFloorId = currentWindow?.floorId;

      const updateDto = {
        name: 'Updated Name Only',
        number: 'T1-NameOnly',
        // floor is not provided - should keep existing floor
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/windows/${createdWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.name).toBe(updateDto.name);
      expect(response.body.data.number).toBe(updateDto.number);
      // Floor should remain unchanged
      expect(response.body.data.floorId).toBe(originalFloorId);
    });

    it('should return 404 for non-existent window', async () => {
      const updateDto = {
        name: 'Test',
        number: 'T1',
      };

      const response = await request(app.getHttpServer())
        .put('/admin/windows/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/windows/${createdWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          // Missing required fields
          description: 'Only description',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('/admin/windows/:id (DELETE)', () => {
    it('should return 404 for non-existent window', async () => {
      const response = await request(app.getHttpServer())
        .delete('/admin/windows/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 when trying to delete window with dishes', async () => {
      // Get a window that has dishes (from seed data)
      const windowWithDishes = await prisma.window.findFirst({
        where: {
          dishes: {
            some: {},
          },
        },
      });

      if (windowWithDishes) {
        const response = await request(app.getHttpServer())
          .delete(`/admin/windows/${windowWithDishes.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .expect(400);

        expect(response.body.statusCode).toBe(400);
        expect(response.body.message).toContain('菜品');
      }
    });

    it('should delete the window', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/admin/windows/${createdWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('操作成功');
      expect(response.body.data).toBeNull();

      // Verify deletion
      const check = await prisma.window.findUnique({
        where: { id: createdWindowId },
      });
      expect(check).toBeNull();

      // Prevent cleanup failure
      createdWindowId = '';
    });
  });

  describe('Permission tests', () => {
    let normalAdminToken: string;

    beforeAll(async () => {
      // Login as normal admin (only has dish:view permission)
      const normalAdminLogin = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ username: 'normaladmin', password: 'admin123' });
      normalAdminToken = normalAdminLogin.body.data.token.accessToken;
    });

    it('should deny access to windows list for admin without canteen:view permission', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/canteens/${testCanteenId}/windows`)
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it('should deny access to create window for admin without canteen:create permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/windows')
        .set('Authorization', `Bearer ${normalAdminToken}`)
        .send({
          canteenId: testCanteenId,
          name: 'Test',
          number: 'T1',
        })
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });
  });

  describe('Dish Sync on Window Update', () => {
    let syncTestCanteenId: string;
    let syncTestWindowId: string;
    let syncTestFloorId: string;
    let syncTestFloor2Id: string;
    let syncTestDishId: string;

    beforeAll(async () => {
      // Create a test canteen with floors for sync tests
      const canteen = await prisma.canteen.create({
        data: {
          name: 'Window Sync Test Canteen',
          position: 'Test Position',
          description: 'Test Description',
          images: [],
          openingHours: [],
        },
      });
      syncTestCanteenId = canteen.id;

      // Create two floors
      const floor1 = await prisma.floor.create({
        data: {
          canteenId: syncTestCanteenId,
          level: '1',
          name: 'Original Floor',
        },
      });
      syncTestFloorId = floor1.id;

      const floor2 = await prisma.floor.create({
        data: {
          canteenId: syncTestCanteenId,
          level: '2',
          name: 'New Floor',
        },
      });
      syncTestFloor2Id = floor2.id;

      // Create a window
      const window = await prisma.window.create({
        data: {
          canteenId: syncTestCanteenId,
          floorId: syncTestFloorId,
          name: 'Original Window Name',
          number: 'W1',
          position: '1F',
          description: 'Test Window',
          tags: [],
        },
      });
      syncTestWindowId = window.id;

      // Create a dish associated with this window
      const dish = await prisma.dish.create({
        data: {
          name: 'Window Sync Test Dish',
          tags: ['test'],
          price: 10.0,
          priceUnit: '元',
          description: 'Test dish for window sync',
          images: [],
          ingredients: ['test'],
          allergens: [],
          canteenId: syncTestCanteenId,
          canteenName: canteen.name,
          floorId: syncTestFloorId,
          floorLevel: '1',
          floorName: 'Original Floor',
          windowId: syncTestWindowId,
          windowNumber: 'W1',
          windowName: 'Original Window Name',
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });
      syncTestDishId = dish.id;
    });

    afterAll(async () => {
      // Clean up in reverse order
      if (syncTestDishId) {
        await prisma.dish
          .delete({ where: { id: syncTestDishId } })
          .catch(() => {});
      }
      if (syncTestWindowId) {
        await prisma.window
          .delete({ where: { id: syncTestWindowId } })
          .catch(() => {});
      }
      if (syncTestFloorId) {
        await prisma.floor
          .delete({ where: { id: syncTestFloorId } })
          .catch(() => {});
      }
      if (syncTestFloor2Id) {
        await prisma.floor
          .delete({ where: { id: syncTestFloor2Id } })
          .catch(() => {});
      }
      if (syncTestCanteenId) {
        await prisma.canteen
          .delete({ where: { id: syncTestCanteenId } })
          .catch(() => {});
      }
    });

    it('should sync dish windowName when window name is updated', async () => {
      // Update window name
      await request(app.getHttpServer())
        .put(`/admin/windows/${syncTestWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          canteenId: syncTestCanteenId,
          name: 'Updated Window Name',
          number: 'W1',
        })
        .expect(200);

      // Verify dish was updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: syncTestDishId },
      });
      expect(updatedDish?.windowName).toBe('Updated Window Name');
    });

    it('should sync dish windowNumber when window number is updated', async () => {
      // Update window number
      await request(app.getHttpServer())
        .put(`/admin/windows/${syncTestWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          canteenId: syncTestCanteenId,
          name: 'Updated Window Name',
          number: 'W2-Updated',
        })
        .expect(200);

      // Verify dish was updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: syncTestDishId },
      });
      expect(updatedDish?.windowNumber).toBe('W2-Updated');
    });

    it('should sync dish floor info when window floor is changed', async () => {
      // Update window floor - use floor object, not floorId
      await request(app.getHttpServer())
        .put(`/admin/windows/${syncTestWindowId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Updated Window Name',
          number: 'W2-Updated',
          floor: { level: '2', name: 'New Floor' },
        })
        .expect(200);

      // Verify dish floor info was updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: syncTestDishId },
      });
      expect(updatedDish?.floorId).toBe(syncTestFloor2Id);
      expect(updatedDish?.floorName).toBe('New Floor');
      expect(updatedDish?.floorLevel).toBe('2');
    });

    it('should reflect updated window info in admin/dishes API response', async () => {
      // Get dish via API
      const response = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ keyword: 'Window Sync Test Dish' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      const dish = response.body.data.items.find(
        (d: any) => d.id === syncTestDishId,
      );
      expect(dish).toBeDefined();
      expect(dish.windowName).toBe('Updated Window Name');
      expect(dish.floorName).toBe('New Floor');
    });
  });
});
