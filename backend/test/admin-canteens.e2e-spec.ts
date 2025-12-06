import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminCanteensController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let normalAdminToken: string; // 只有 dish:view 权限，无 canteen 权限
  let subAdminToken: string; // 只有 dish:view + canteen:view 权限
  let createdCanteenId: string;

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

    // Login as normal admin (只有 dish:view 权限，无 canteen 权限)
    const normalAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'normaladmin', password: 'admin123' });
    normalAdminToken = normalAdminLogin.body.data.token.accessToken;

    // Login as sub admin (只有 dish:view + canteen:view 权限)
    const subAdminLogin = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'subadmin', password: 'subadmin123' });
    subAdminToken = subAdminLogin.body.data.token.accessToken;
  });

  afterAll(async () => {
    if (createdCanteenId) {
      await prisma.canteen.deleteMany({ where: { id: createdCanteenId } });
    }
    await app.close();
  });

  describe('/admin/canteens (POST)', () => {
    it('should create a new canteen', async () => {
      const createDto = {
        name: 'Test Canteen',
        position: 'Test Position',
        description: 'Test Description',
        images: ['http://example.com/image.jpg'],
        openingHours: [
          {
            dayOfWeek: 'Monday',
            slots: [
              { mealType: 'Lunch', openTime: '11:00', closeTime: '13:00' },
            ],
            isClosed: false,
          },
        ],
        floors: [{ level: '1', name: '1F' }],
        windows: [
          {
            name: 'Test Window',
            number: 'W1',
            position: '1F-01',
            description: 'Test Window Desc',
            tags: ['Spicy'],
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/admin/canteens')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(createDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.name).toBe(createDto.name);
      expect(response.body.data.windows).toHaveLength(1);
      expect(response.body.data.windows[0].name).toBe(
        createDto.windows[0].name,
      );

      createdCanteenId = response.body.data.id;
    });
  });

  describe('/admin/canteens (GET)', () => {
    it('should return list of canteens', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/canteens')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toBeInstanceOf(Array);
      const found = response.body.data.items.find(
        (c: any) => c.id === createdCanteenId,
      );
      expect(found).toBeDefined();
      expect(found.name).toBe('Test Canteen');
    });
  });

  describe('/admin/canteens/:id (PUT)', () => {
    it('should update the canteen basic info', async () => {
      const updateDto = {
        name: 'Updated Canteen Name',
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/canteens/${createdCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.name).toBe(updateDto.name);
    });

    it('should update windows and floors (add, update, delete)', async () => {
      // 1. Get current state to get IDs
      const currentCanteen = await prisma.canteen.findUnique({
        where: { id: createdCanteenId },
        include: { windows: true, floors: true },
      });
      const windowId = currentCanteen.windows[0].id;
      const floorId = currentCanteen.floors[0].id;

      // 2. Test Update and Create
      const updateDto = {
        windows: [
          {
            id: windowId,
            name: 'Updated Window',
            number: 'W1-Up',
            position: '1F-01',
            description: 'Desc',
            tags: [],
          }, // Update
          {
            name: 'New Window',
            number: 'W2',
            position: '1F-02',
            description: 'New Desc',
            tags: [],
          }, // Create
        ],
        floors: [
          { id: floorId, level: '1', name: '1F Updated' }, // Update
          { level: '2', name: '2F' }, // Create
        ],
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/canteens/${createdCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.data.windows).toHaveLength(2);
      expect(response.body.data.floors).toHaveLength(2);

      // Verify DB
      const updated = await prisma.canteen.findUnique({
        where: { id: createdCanteenId },
        include: { windows: true, floors: true },
      });
      expect(updated.windows.find((w) => w.id === windowId).name).toBe(
        'Updated Window',
      );
      expect(updated.floors.find((f) => f.id === floorId).name).toBe(
        '1F Updated',
      );
      expect(
        updated.windows.find((w) => w.name === 'New Window'),
      ).toBeDefined();
      expect(updated.floors.find((f) => f.name === '2F')).toBeDefined();

      // 3. Test Delete
      const newWindowId = updated.windows.find(
        (w) => w.name === 'New Window',
      ).id;
      const newFloorId = updated.floors.find((f) => f.name === '2F').id;

      const deleteDto = {
        windows: [
          {
            id: newWindowId,
            name: 'New Window',
            number: 'W2',
            position: '1F-02',
            description: 'New Desc',
            tags: [],
          },
        ], // Keep new, delete old (windowId)
        floors: [{ id: newFloorId, level: '2', name: '2F' }], // Keep new, delete old (floorId)
      };

      await request(app.getHttpServer())
        .put(`/admin/canteens/${createdCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(deleteDto)
        .expect(200);

      const final = await prisma.canteen.findUnique({
        where: { id: createdCanteenId },
        include: { windows: true, floors: true },
      });
      expect(final.windows).toHaveLength(1);
      expect(final.windows[0].id).toBe(newWindowId);
      expect(final.floors).toHaveLength(1);
      expect(final.floors[0].id).toBe(newFloorId);
    });

    it('should return 404 when updating non-existent canteen', async () => {
      await request(app.getHttpServer())
        .put('/admin/canteens/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should sync dish canteenName when canteen name is updated', async () => {
      // Create test canteen
      const testCanteen = await prisma.canteen.create({
        data: {
          name: 'Sync Test Canteen',
          position: 'Test Position',
          description: 'Test Description',
          images: [],
          openingHours: [],
        },
      });

      // Create test dish
      const testDish = await prisma.dish.create({
        data: {
          name: 'Sync Test Dish',
          tags: ['test'],
          price: 10.0,
          priceUnit: '元',
          description: 'Test dish for sync',
          images: [],
          ingredients: ['test'],
          allergens: [],
          canteenId: testCanteen.id,
          canteenName: testCanteen.name,
          windowName: '',
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });

      // Update canteen name
      await request(app.getHttpServer())
        .put(`/admin/canteens/${testCanteen.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Updated Sync Test Canteen' })
        .expect(200);

      // Check dish canteenName was updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: testDish.id },
      });
      expect(updatedDish.canteenName).toBe('Updated Sync Test Canteen');

      // Cleanup
      await prisma.dish.delete({ where: { id: testDish.id } });
      await prisma.canteen.delete({ where: { id: testCanteen.id } });
    });

    it('should sync dish windowName and windowNumber when window name or number is updated', async () => {
      // Create test canteen with window
      const testCanteen = await prisma.canteen.create({
        data: {
          name: 'Window Sync Test Canteen',
          position: 'Test Position',
          description: 'Test Description',
          images: [],
          openingHours: [],
        },
      });

      const testWindow = await prisma.window.create({
        data: {
          canteenId: testCanteen.id,
          name: 'Test Window',
          number: '1',
          position: 'Test Position',
          description: 'Test Window Description',
          tags: ['test'],
        },
      });

      // Create test dish
      const testDish = await prisma.dish.create({
        data: {
          name: 'Window Sync Test Dish',
          tags: ['test'],
          price: 10.0,
          priceUnit: '元',
          description: 'Test dish for window sync',
          images: [],
          ingredients: ['test'],
          allergens: [],
          canteenId: testCanteen.id,
          canteenName: testCanteen.name,
          windowId: testWindow.id,
          windowName: testWindow.name,
          windowNumber: testWindow.number,
          floorName: '',
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });

      // Update window name and number
      await request(app.getHttpServer())
        .put(`/admin/canteens/${testCanteen.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          windows: [
            {
              id: testWindow.id,
              name: 'Updated Test Window',
              number: '2',
              position: 'Test Position',
              description: 'Test Window Description',
              tags: ['test'],
            },
          ],
        })
        .expect(200);

      // Check dish windowName and windowNumber were updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: testDish.id },
      });
      expect(updatedDish.windowName).toBe('Updated Test Window');
      expect(updatedDish.windowNumber).toBe('2');

      // Check that the admin dishes API returns the updated window name from the association
      const dishesResponse = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ keyword: 'Window Sync Test Dish' })
        .expect(200);

      expect(dishesResponse.body.code).toBe(200);
      expect(dishesResponse.body.data.items).toHaveLength(1);
      expect(dishesResponse.body.data.items[0].windowName).toBe(
        'Updated Test Window',
      );

      // Cleanup
      await prisma.dish.delete({ where: { id: testDish.id } });
      await prisma.window.delete({ where: { id: testWindow.id } });
      await prisma.canteen.delete({ where: { id: testCanteen.id } });
    });

    it('should sync dish floorName and floorLevel when floor name or level is updated', async () => {
      // Create test canteen with floor
      const testCanteen = await prisma.canteen.create({
        data: {
          name: 'Floor Sync Test Canteen',
          position: 'Test Position',
          description: 'Test Description',
          images: [],
          openingHours: [],
        },
      });

      const testFloor = await prisma.floor.create({
        data: {
          canteenId: testCanteen.id,
          level: '1',
          name: 'Test Floor',
        },
      });

      // Create test dish
      const testDish = await prisma.dish.create({
        data: {
          name: 'Floor Sync Test Dish',
          tags: ['test'],
          price: 10.0,
          priceUnit: '元',
          description: 'Test dish for floor sync',
          images: [],
          ingredients: ['test'],
          allergens: [],
          canteenId: testCanteen.id,
          canteenName: testCanteen.name,
          floorId: testFloor.id,
          floorName: testFloor.name,
          floorLevel: testFloor.level,
          windowName: '',
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });

      // Update floor name and level
      await request(app.getHttpServer())
        .put(`/admin/canteens/${testCanteen.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          floors: [
            {
              id: testFloor.id,
              level: '2',
              name: 'Updated Test Floor',
            },
          ],
        })
        .expect(200);

      // Check dish floorName and floorLevel were updated
      const updatedDish = await prisma.dish.findUnique({
        where: { id: testDish.id },
      });
      expect(updatedDish.floorName).toBe('Updated Test Floor');
      expect(updatedDish.floorLevel).toBe('2');

      // Cleanup
      await prisma.dish.delete({ where: { id: testDish.id } });
      await prisma.floor.delete({ where: { id: testFloor.id } });
      await prisma.canteen.delete({ where: { id: testCanteen.id } });
    });

    it('should reflect synced window info in admin/dishes API response', async () => {
      // Create test canteen with window
      const testCanteen = await prisma.canteen.create({
        data: {
          name: 'API Sync Test Canteen',
          position: 'Test Position',
          description: 'Test Description',
          images: [],
          openingHours: [],
        },
      });

      const testWindow = await prisma.window.create({
        data: {
          canteenId: testCanteen.id,
          name: 'Original Window Name',
          number: 'W001',
          position: 'Ground Floor',
          description: 'Test window',
          tags: [],
        },
      });

      // Create test dish
      const testDish = await prisma.dish.create({
        data: {
          name: 'API Sync Test Dish',
          tags: ['test'],
          price: 15.0,
          priceUnit: '元',
          description: 'Test dish for API sync verification',
          images: [],
          ingredients: ['test'],
          allergens: [],
          canteenId: testCanteen.id,
          canteenName: testCanteen.name,
          windowId: testWindow.id,
          windowName: testWindow.name,
          windowNumber: testWindow.number,
          availableMealTime: ['lunch'],
          status: 'online',
        },
      });

      // Update window name via admin/canteens API
      await request(app.getHttpServer())
        .put(`/admin/canteens/${testCanteen.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          windows: [
            {
              id: testWindow.id,
              name: 'Updated Window Name',
              number: 'W002',
              position: 'Ground Floor',
              description: 'Test window',
              tags: [],
            },
          ],
        })
        .expect(200);

      // Verify via admin/dishes API that the dish reflects updated window info
      const dishesResponse = await request(app.getHttpServer())
        .get('/admin/dishes')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ keyword: 'API Sync Test Dish' })
        .expect(200);

      expect(dishesResponse.body.code).toBe(200);
      const foundDish = dishesResponse.body.data.items.find(
        (d: any) => d.id === testDish.id,
      );
      expect(foundDish).toBeDefined();
      expect(foundDish.windowName).toBe('Updated Window Name');
      expect(foundDish.windowNumber).toBe('W002');

      // Cleanup
      await prisma.dish.delete({ where: { id: testDish.id } });
      await prisma.window.delete({ where: { id: testWindow.id } });
      await prisma.canteen.delete({ where: { id: testCanteen.id } });
    });
  });

  describe('/admin/canteens/:id (DELETE)', () => {
    it('should return 404 when deleting non-existent canteen', async () => {
      await request(app.getHttpServer())
        .delete('/admin/canteens/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should delete the canteen', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/canteens/${createdCanteenId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Verify deletion
      const check = await prisma.canteen.findUnique({
        where: { id: createdCanteenId },
      });
      expect(check).toBeNull();
      createdCanteenId = ''; // Prevent cleanup failure
    });
  });

  // ========================
  // 权限控制测试
  // ========================
  describe('Permission Control', () => {
    describe('Unauthorized Access (401)', () => {
      it('should return 401 when accessing without token', async () => {
        await request(app.getHttpServer()).get('/admin/canteens').expect(401);
      });

      it('should return 401 when creating without token', async () => {
        await request(app.getHttpServer())
          .post('/admin/canteens')
          .send({ name: 'Test' })
          .expect(401);
      });

      it('should return 401 when updating without token', async () => {
        await request(app.getHttpServer())
          .put('/admin/canteens/some-id')
          .send({ name: 'Test' })
          .expect(401);
      });

      it('should return 401 when deleting without token', async () => {
        await request(app.getHttpServer())
          .delete('/admin/canteens/some-id')
          .expect(401);
      });
    });

    describe('Forbidden Access for normalAdmin (403) - No canteen permissions', () => {
      it('should return 403 when normalAdmin tries to list canteens', async () => {
        await request(app.getHttpServer())
          .get('/admin/canteens')
          .set('Authorization', `Bearer ${normalAdminToken}`)
          .expect(403);
      });

      it('should return 403 when normalAdmin tries to create canteen', async () => {
        await request(app.getHttpServer())
          .post('/admin/canteens')
          .set('Authorization', `Bearer ${normalAdminToken}`)
          .send({
            name: 'Test Canteen',
            position: 'Test Position',
            images: [],
            openingHours: [],
            floors: [],
            windows: [],
          })
          .expect(403);
      });

      it('should return 403 when normalAdmin tries to update canteen', async () => {
        // 先创建一个食堂用于测试
        const canteen = await prisma.canteen.create({
          data: {
            name: 'Permission Test Canteen',
            position: 'Test',
            images: [],
            openingHours: [],
          },
        });

        try {
          await request(app.getHttpServer())
            .put(`/admin/canteens/${canteen.id}`)
            .set('Authorization', `Bearer ${normalAdminToken}`)
            .send({ name: 'Updated Name' })
            .expect(403);
        } finally {
          await prisma.canteen.delete({ where: { id: canteen.id } });
        }
      });

      it('should return 403 when normalAdmin tries to delete canteen', async () => {
        const canteen = await prisma.canteen.create({
          data: {
            name: 'Permission Test Canteen 2',
            position: 'Test',
            images: [],
            openingHours: [],
          },
        });

        try {
          await request(app.getHttpServer())
            .delete(`/admin/canteens/${canteen.id}`)
            .set('Authorization', `Bearer ${normalAdminToken}`)
            .expect(403);
        } finally {
          await prisma.canteen.delete({ where: { id: canteen.id } });
        }
      });
    });

    describe('Partial Access for subAdmin (canteen:view only)', () => {
      let testCanteenId: string;

      beforeAll(async () => {
        const canteen = await prisma.canteen.create({
          data: {
            name: 'SubAdmin Test Canteen',
            position: 'Test Position',
            images: [],
            openingHours: [],
          },
        });
        testCanteenId = canteen.id;
      });

      afterAll(async () => {
        if (testCanteenId) {
          await prisma.canteen.deleteMany({ where: { id: testCanteenId } });
        }
      });

      it('should allow subAdmin to list canteens (has canteen:view)', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/canteens')
          .set('Authorization', `Bearer ${subAdminToken}`)
          .expect(200);

        expect(response.body.code).toBe(200);
        expect(response.body.data.items).toBeInstanceOf(Array);
      });

      it('should return 403 when subAdmin tries to create canteen (no canteen:create)', async () => {
        await request(app.getHttpServer())
          .post('/admin/canteens')
          .set('Authorization', `Bearer ${subAdminToken}`)
          .send({
            name: 'SubAdmin Created Canteen',
            position: 'Test Position',
            images: [],
            openingHours: [],
            floors: [],
            windows: [],
          })
          .expect(403);
      });

      it('should return 403 when subAdmin tries to update canteen (no canteen:edit)', async () => {
        await request(app.getHttpServer())
          .put(`/admin/canteens/${testCanteenId}`)
          .set('Authorization', `Bearer ${subAdminToken}`)
          .send({ name: 'SubAdmin Updated Name' })
          .expect(403);
      });

      it('should return 403 when subAdmin tries to delete canteen (no canteen:delete)', async () => {
        await request(app.getHttpServer())
          .delete(`/admin/canteens/${testCanteenId}`)
          .set('Authorization', `Bearer ${subAdminToken}`)
          .expect(403);
      });
    });
  });
});
