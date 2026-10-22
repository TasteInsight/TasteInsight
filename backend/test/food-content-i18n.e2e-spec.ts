import * as XLSX from 'xlsx';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { CreateMealPlanTool } from '@/ai-chat/tools/create-meal-plan.tool';
import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { AllergensService } from '@/allergens/allergens.service';
import {
  AllergensController,
  AdminAllergensController,
} from '@/allergens/allergens.controller';
import { AdminAuthGuard } from '@/auth/guards/admin-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { DishesService } from '@/dishes/dishes.service';
import {
  contributionSnapshot,
  changedDishData,
} from '@/dishes/contribution-fields';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadDishDto } from '@/dishes/dto/upload-dish.dto';
import { contributionModerationText } from '@/content-moderation/moderation.types';

describe('food content localization (PostgreSQL)', () => {
  const db = new PrismaService();
  const prefix = 'content-' + randomUUID();
  const allergens = new AllergensService(db);
  const value = prefix + '-燕麦';
  let app: INestApplication;
  const admin = {
    id: prefix,
    username: prefix,
    role: 'admin',
    scope: 'GLOBAL',
    canteenIds: [],
    permissions: ['config:view', 'config:edit'],
  };
  beforeAll(async () => {
    await db.admin.create({
      data: {
        id: prefix,
        username: prefix,
        password: 'test-only',
        scope: 'GLOBAL',
      },
    });
    await db.canteen.create({
      data: { id: prefix, name: prefix, images: [], openingHours: {} },
    });
    const module = await Test.createTestingModule({
      controllers: [AllergensController, AdminAllergensController],
      providers: [
        { provide: AllergensService, useValue: allergens },
        PermissionsGuard,
      ],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.admin = {
            ...admin,
            scope: req.headers['x-test-scope'] || 'GLOBAL',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await db.operationLog.deleteMany({ where: { adminId: prefix } });
    await db.allergen.deleteMany({ where: { value: { startsWith: prefix } } });
    await db.dishUpload.deleteMany({ where: { canteenId: prefix } });
    await db.dish.deleteMany({ where: { canteenId: prefix } });
    await db.canteen.delete({ where: { id: prefix } });
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.admin.delete({ where: { id: prefix } });
    await db.$disconnect();
  });
  it('publishes curated bilingual entries and preserves old aliases when names change', async () => {
    await request(app.getHttpServer())
      .post('/admin/allergens')
      .send({
        nameZh: value,
        nameEn: 'Test oats ' + prefix,
        aliases: ['Test oatmeal ' + prefix],
      })
      .expect(201);
    await request(app.getHttpServer())
      .put('/admin/allergens/' + encodeURIComponent(value))
      .send({ nameZh: value + '新名', nameEn: 'Renamed oats ' + prefix })
      .expect(200);
    const entries = (
      await request(app.getHttpServer()).get('/allergens').expect(200)
    ).body.data;
    expect(entries.find((e) => e.value === value)).toMatchObject({
      nameZh: value + '新名',
      aliases: expect.arrayContaining([
        'Test oats ' + prefix,
        'Test oatmeal ' + prefix,
      ]),
    });
    expect(await db.operationLog.count({ where: { adminId: prefix } })).toBe(2);
  });
  it('rejects alias collisions atomically and limits mutations to global administrators', async () => {
    await request(app.getHttpServer())
      .post('/admin/allergens')
      .send({ nameZh: prefix + '-conflict', aliases: ['pEaNuT'] })
      .expect(409);
    expect(
      await db.allergen.findUnique({ where: { value: prefix + '-conflict' } }),
    ).toBeNull();
    await request(app.getHttpServer())
      .post('/admin/allergens')
      .set('x-test-scope', 'CANTEENS')
      .send({ nameZh: prefix + '-forbidden' })
      .expect(403);
  });
  it('matches languages and case in the real recommendation predicate while preserving free text', async () => {
    const base = {
      canteenId: prefix,
      canteenName: prefix,
      windowName: 'test',
      tags: [],
      images: [],
      ingredients: [],
      availableMealTime: ['lunch'],
      price: 8,
    };
    await db.dish.createMany({
      data: [
        {
          ...base,
          id: prefix + '-peanut',
          name: '花生菜',
          allergens: ['PEANUT'],
        },
        {
          ...base,
          id: prefix + '-custom',
          name: '自定义菜',
          allergens: ['Pine Nuts'],
        },
        { ...base, id: prefix + '-safe', name: '普通菜', allergens: [] },
      ],
    });
    const rec = new RecommendationService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      allergens,
    );
    const filter = await (rec as any).buildDietaryFilterConditions([
      '花生',
      'pine nuts',
    ]);
    expect(
      (
        await db.dish.findMany({ where: { canteenId: prefix, AND: filter } })
      ).map((d) => d.id),
    ).toEqual([prefix + '-safe']);
    const user = await db.user.create({
      data: {
        id: prefix + '-user',
        allergens: ['Pine nuts', '私人自定义成分'],
      },
    });
    const profiles = new UserProfileService(db);
    await profiles.updateUserProfile(user.id, {
      allergens: ['Pine nuts', '私人自定义成分'],
    });
    expect((await profiles.getUserProfile(user.id)).data.allergens).toEqual([
      'Pine nuts',
      '私人自定义成分',
    ]);
    expect(
      (await allergens.catalog()).some((e) => e.value === '私人自定义成分'),
    ).toBe(false);
  });
  it('keeps English fields through snapshots, merge patches, DTO validation and moderation', async () => {
    const dto = plainToInstance(UploadDishDto, {
      nameEn: '  English name  ',
      descriptionEn: '',
      targetDishId: prefix,
      changedFields: ['nameEn', 'descriptionEn'],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.nameEn).toBe('English name');
    expect(dto.descriptionEn).toBeNull();
    const snapshot = contributionSnapshot({
      name: '原名',
      nameEn: 'Original',
      descriptionEn: 'Old description',
    });
    expect(snapshot).toMatchObject({
      nameEn: 'Original',
      descriptionEn: 'Old description',
    });
    expect(
      changedDishData({ nameEn: 'Edited', descriptionEn: null }, {}, [
        'nameEn',
        'descriptionEn',
      ]),
    ).toEqual({ nameEn: 'Edited', descriptionEn: null });
    expect(
      contributionModerationText({
        name: '原名',
        nameEn: 'English',
        descriptionEn: 'English description',
        tags: [],
        ingredients: [],
        allergens: [],
      } as any),
    ).toContain('English description');
    const dish = await db.dish.update({
      where: { id: prefix + '-safe' },
      data: {
        nameEn: 'English searchable dish ' + prefix,
        descriptionEn: 'English details',
      },
    });
    const service = new DishesService(db);
    expect((await service.getDishById(dish.id)).data).toMatchObject({
      name: dish.name,
      nameEn: dish.nameEn,
      descriptionEn: 'English details',
    });
    const result = await service.getDishes({
      filter: {},
      search: { keyword: 'English searchable dish' },
      sort: { field: 'name', order: 'asc' },
      pagination: { page: 1, pageSize: 20 },
    } as any);
    expect(result.data.items.map((d) => d.id)).toContain(dish.id);
  });
  it('rechecks curated aliases and custom phrases in the final AI plan assertion', async () => {
    const rec = new RecommendationService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      allergens,
    );
    jest.spyOn(rec, 'getUserFeaturesWithCache').mockResolvedValue({
      allergens: ['花生', 'pine nuts'],
      preferences: null,
    } as any);
    const tool = new CreateMealPlanTool(new DishesService(db), rec);
    for (const suffix of ['-peanut', '-custom']) {
      await expect(
        tool.execute(
          {
            dishIds: [prefix + suffix],
            startDate: '2026-11-01',
            endDate: '2026-11-01',
            mealTime: 'lunch',
          },
          { userId: prefix + '-user', sessionId: 'test' },
        ),
      ).rejects.toThrow('忌口');
    }
  });
  it('preserves maintained English fields on old Excel imports and keeps sub-dish translations independent', async () => {
    const window = await db.window.create({
      data: { canteenId: prefix, name: prefix + '-window', number: '1' },
    });
    await db.dish.update({
      where: { id: prefix + '-safe' },
      data: {
        windowId: window.id,
        nameEn: 'Maintained English',
        descriptionEn: 'Maintained description',
      },
    });
    const service = new AdminDishesService(db);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { 食堂: prefix, 窗口: window.name, 菜品名: '普通菜', 价格: 9 },
      ]),
      '菜品',
    );
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const parsed = await service.parseBatchExcel(
      { buffer, size: buffer.length } as any,
      admin as any,
    );
    expect(parsed.data.items[0].nameEn).toBeUndefined();
    const imported = await service.confirmBatchImport(
      { dishes: parsed.data.items } as any,
      { ...admin, permissions: ['dish:create', 'dish:edit'] } as any,
    );
    expect(imported.data.errors).toEqual([]);
    expect(imported.data).toMatchObject({ successCount: 1, failCount: 0 });
    expect(
      await db.dish.findUnique({ where: { id: prefix + '-safe' } }),
    ).toMatchObject({
      nameEn: 'Maintained English',
      descriptionEn: 'Maintained description',
      price: 9,
    });
    const parent = {
      ...parsed.data.items[0],
      name: prefix + '-parent',
      nameEn: 'Parent English',
      descriptionEn: 'Parent description',
      subDishNames: [prefix + '-child'],
    };
    expect(
      (
        await service.confirmBatchImport(
          { dishes: [parent] } as any,
          { ...admin, permissions: ['dish:create'] } as any,
        )
      ).data,
    ).toMatchObject({ successCount: 1, failCount: 0 });
    const uploads = await db.dishUpload.findMany({
      where: { canteenId: prefix },
    });
    expect(uploads.find((u) => u.name === parent.name)).toMatchObject({
      nameEn: 'Parent English',
    });
    expect(uploads.find((u) => u.name === prefix + '-child')).toMatchObject({
      nameEn: null,
      descriptionEn: null,
    });
  });
});
