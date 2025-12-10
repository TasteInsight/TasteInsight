import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma.service';
import * as XLSX from 'xlsx';

const TEST_CANTEEN_NAME = '批量导入测试食堂';
const TEST_WINDOW_NAME = '批量导入窗口';
const TEST_DISH_NAME = '批量导入套餐';

function buildExcelBuffer() {
  const data = [
    [
      '食堂',
      '楼层',
      '窗口',
      '窗口编号',
      '菜品名',
      '菜品子项',
      '价格',
      '供应时间',
      '供应时段',
      '菜品描述',
      'Tags',
    ],
    [
      TEST_CANTEEN_NAME,
      '一楼',
      TEST_WINDOW_NAME,
      'B-01',
      TEST_DISH_NAME,
      '',
      '15.5元/份',
      '2025-01-01 至 2025-12-31',
      '早餐,午餐',
      '主菜描述',
      '推荐,新品',
    ],
    [
      TEST_CANTEEN_NAME,
      '一楼',
      TEST_WINDOW_NAME,
      'B-01',
      TEST_DISH_NAME,
      '子菜1,子菜2',
      '12',
      '',
      '午餐/晚餐',
      '子菜描述',
      '子菜标签',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

describe('Admin dishes batch APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: 'testadmin', password: 'password123' });
    superAdminToken = loginRes.body.data.token.accessToken;
  });

  afterAll(async () => {
    const canteen = await prisma.canteen.findFirst({
      where: { name: TEST_CANTEEN_NAME },
    });
    if (canteen) {
      await prisma.dish.deleteMany({ where: { canteenId: canteen.id } });
      await prisma.window.deleteMany({ where: { canteenId: canteen.id } });
      await prisma.floor.deleteMany({ where: { canteenId: canteen.id } });
      await prisma.canteen.delete({ where: { id: canteen.id } });
    }
    await app.close();
  });

  const parseBatchFile = async () => {
    const buffer = buildExcelBuffer();
    const response = await request(app.getHttpServer())
      .post('/admin/dishes/batch/parse')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', buffer, 'batch-test.xlsx')
      .expect(200);
    return response.body.data.items;
  };

  describe('/admin/dishes/batch/parse (POST)', () => {
    it('should parse excel file and return preview items', async () => {
      const buffer = buildExcelBuffer();
      const response = await request(app.getHttpServer())
        .post('/admin/dishes/batch/parse')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', buffer, 'batch-preview.xlsx')
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
      const firstItem = response.body.data.items[0];
      expect(firstItem.canteenName).toBe(TEST_CANTEEN_NAME);
      expect(firstItem.windowName).toBe(TEST_WINDOW_NAME);
      expect(firstItem.price).toBeCloseTo(15.5);
      expect(response.body.data.warningCount).toBeGreaterThanOrEqual(1);
    });

    it('should reject when no file is provided', async () => {
      await request(app.getHttpServer())
        .post('/admin/dishes/batch/parse')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });
  });

  describe('/admin/dishes/batch/confirm (POST)', () => {
    it('should import parsed dishes and create records', async () => {
      const parsedItems = await parseBatchFile();
      const response = await request(app.getHttpServer())
        .post('/admin/dishes/batch/confirm')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ dishes: parsedItems })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.successCount).toBe(parsedItems.length);
      expect(response.body.data.failCount).toBe(0);

      const canteen = await prisma.canteen.findFirst({
        where: { name: TEST_CANTEEN_NAME },
      });
      expect(canteen).toBeTruthy();
      const window = await prisma.window.findFirst({
        where: { canteenId: canteen?.id ?? '', name: TEST_WINDOW_NAME },
      });
      expect(window).toBeTruthy();
      const parentDish = await prisma.dish.findFirst({
        where: {
          canteenId: canteen?.id ?? '',
          name: TEST_DISH_NAME,
          parentDishId: null,
        },
      });
      expect(parentDish).toBeTruthy();
      const childDish = await prisma.dish.findFirst({
        where: {
          parentDishId: parentDish?.id ?? '',
          name: '子菜1',
        },
      });
      expect(childDish).toBeTruthy();
    });
  });
});
