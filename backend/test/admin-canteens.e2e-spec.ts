import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';

describe('AdminCanteensController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
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
      expect(response.body.data.windows[0].name).toBe(createDto.windows[0].name);
      
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
});
