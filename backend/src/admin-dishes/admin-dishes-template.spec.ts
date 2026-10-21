import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { AdminDishesController } from './admin-dishes.controller';
import { AdminDishesService } from './admin-dishes.service';
import { PrismaService } from '@/prisma.service';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';

// Database reads describe the sample locations; no business data is written.
const prisma = {
  canteen: {
    findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: '示例食堂' }]),
  },
  floor: {
    findMany: jest.fn().mockResolvedValue([{ canteenId: 'c1', name: '一层' }]),
  },
  window: {
    findMany: jest
      .fn()
      .mockResolvedValue([{ canteenId: 'c1', name: '示例窗口' }]),
  },
};

describe('Batch Excel template HTTP contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminDishesController],
      providers: [
        AdminDishesService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          req.admin = {
            id: 'a1',
            username: 'admin',
            role: 'admin',
            scope: 'GLOBAL',
            canteenIds: [],
            permissions: req.headers['x-no-create']
              ? ['dish:view']
              : ['dish:create'],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a real XLSX and round-trips the sample through the upload parser', async () => {
    const download = await request(app.getHttpServer())
      .get('/admin/dishes/batch/template')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect(
        'Content-Type',
        /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/,
      )
      .expect('Content-Disposition', /attachment;.*\.xlsx/);
    expect(download.body.subarray(0, 2).toString()).toBe('PK');
    const workbook = XLSX.read(download.body, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['菜品导入', '填写说明']);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets['菜品导入']);
    expect(data).toHaveLength(1);
    const instructions = XLSX.utils.sheet_to_csv(workbook.Sheets['填写说明']);
    expect(instructions).toContain('食堂、窗口、菜品名、价格');
    expect(instructions).toContain('全局管理范围及“创建食堂/窗口”权限');
    expect(instructions).toContain('自动创建未知窗口需要“创建食堂/窗口”权限');
    const parsed = await request(app.getHttpServer())
      .post('/admin/dishes/batch/parse')
      .attach('file', download.body, 'template.xlsx')
      .expect(200);
    expect(parsed.body.data).toMatchObject({
      total: 1,
      validCount: 1,
      invalidCount: 0,
      warningCount: 0,
    });
    expect(parsed.body.data.items[0]).toMatchObject({
      canteenName: '示例食堂',
      floorName: '一层',
      windowName: '示例窗口',
      windowNumber: '01',
      name: '番茄炒蛋',
      price: 8,
      priceUnit: '元/份',
      supplyTime: '常年供应',
      supplyPeriod: ['午餐', '晚餐'],
      subDishNames: [],
      description: '番茄与鸡蛋炒制',
      tags: ['家常菜'],
      ingredients: ['番茄', '鸡蛋'],
      allergens: ['蛋'],
      status: 'valid',
    });
  });

  it('requires the same create permission as the import entry point', async () => {
    await request(app.getHttpServer())
      .get('/admin/dishes/batch/template')
      .set('x-no-create', '1')
      .expect(403);
  });
});
