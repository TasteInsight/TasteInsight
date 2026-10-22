import * as XLSX from 'xlsx';
import { MealTime } from '@/common/enums';
import {
  allergenComparisonKey,
  normalizeAllergenText,
  normalizeAllergenValues,
} from '@/allergens/allergen-values';
import { assertDietaryExclusions } from '@/meal-plans/meal-plan-validation';
import { AdminUploadsService } from '@/admin-uploads/admin-uploads.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { MealPlansService } from '@/meal-plans/meal-plans.service';
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
  it('uses fixed Unicode case folding for database keys, recommendation, plan assertions and alias uniqueness', async () => {
    const comparisons = [
      { left: 'İ', right: 'i', equal: false },
      { left: 'ΟΣ', right: 'οσ', equal: true },
      { left: 'ΟΣ', right: 'ος', equal: true },
      { left: 'Straße', right: 'STRASSE', equal: true },
      { left: 'Ᲊ', right: 'ᲊ', equal: true },
      { left: 'Ɤ', right: 'ɤ', equal: true },
      { left: 'Ꟍ', right: 'ꟍ', equal: true },
      { left: 'Ꟛ', right: 'ꟛ', equal: true },
      { left: 'PiNe Nuts', right: 'pine nuts', equal: true },
      { left: 'Pine Nutshell', right: 'pine nuts', equal: false },
    ];
    const rec = new RecommendationService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      allergens,
    );
    const saved = await db.user.create({
      data: {
        id: prefix + '-unicode-user',
        allergens: comparisons.flatMap(({ left, right }) => [left, right]),
      },
    });
    expect(saved.allergens).toEqual(
      normalizeAllergenValues(
        comparisons.flatMap(({ left, right }) => [left, right]),
      ),
    );
    for (const [index, { left, right, equal }] of comparisons.entries()) {
      const dish = await db.dish.create({
        data: {
          id: prefix + '-unicode-' + index,
          name: 'Unicode comparison',
          canteenId: prefix,
          canteenName: prefix,
          windowName: 'test',
          tags: [],
          images: [],
          ingredients: [],
          availableMealTime: ['lunch'],
          price: 8,
          allergens: [' \uFEFF' + left + '\t'],
        },
      });
      expect(dish).not.toHaveProperty('allergenKeys');
      expect(dish.allergens).toEqual([left]);
      expect(
        await db.dish.findUnique({
          where: { id: dish.id },
          select: { allergenKeys: true },
        }),
      ).toEqual({ allergenKeys: [allergenComparisonKey(left)] });
      const filter = await (rec as any).buildDietaryFilterConditions([right]);
      expect(
        await db.dish.findMany({ where: { id: dish.id, AND: filter } }),
      ).toHaveLength(equal ? 0 : 1);
      const assertPlan = () =>
        assertDietaryExclusions([dish], {
          allergens: [right],
          avoidIngredients: [],
        });
      if (equal) expect(assertPlan).toThrow('忌口');
      else expect(assertPlan).not.toThrow();

      const aliasPrefix = prefix + '-unicode-alias-' + index + ' ';
      await request(app.getHttpServer())
        .post('/admin/allergens')
        .send({
          nameZh: prefix + '-unicode-first-' + index,
          aliases: [aliasPrefix + left],
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/admin/allergens')
        .send({
          nameZh: prefix + '-unicode-second-' + index,
          aliases: [aliasPrefix + right],
        })
        .expect(equal ? 409 : 201);
      expect(
        await db.allergen.count({
          where: { value: prefix + '-unicode-second-' + index },
        }),
      ).toBe(equal ? 0 : 1);
    }
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
            startDate: '2099-11-01',
            endDate: '2099-11-01',
            mealTime: 'lunch',
          },
          { userId: prefix + '-user', sessionId: 'test' },
        ),
      ).rejects.toThrow('忌口');
    }
  });
  it('rechecks current allergens and aliases when saving or changing an existing plan', async () => {
    const userId = prefix + '-save-user';
    await db.user.create({ data: { id: userId, nickname: 'Plan test' } });
    const plans = new MealPlansService(db, allergens);
    const rec = new RecommendationService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      allergens,
    );
    jest
      .spyOn(rec, 'getUserFeaturesWithCache')
      .mockResolvedValue({ allergens: [], preferences: null } as any);
    const tool = new CreateMealPlanTool(new DishesService(db), rec);
    const draft = await tool.execute(
      {
        dishIds: [prefix + '-peanut'],
        startDate: '2099-11-01',
        endDate: '2099-11-01',
        mealTime: 'lunch',
      },
      { userId, sessionId: 'test' },
    );
    const body = draft.confirmAction.body;
    await db.user.update({
      where: { id: userId },
      data: { allergens: ['Peanuts'] },
    });
    await expect(plans.createMealPlan(userId, body)).rejects.toMatchObject({
      response: { code: 'DIETARY_CONFLICT' },
    });
    expect(await db.mealPlan.count({ where: { userId } })).toBe(0);
    const safe = await plans.createMealPlan(userId, {
      ...body,
      dishes: [prefix + '-safe'],
    });
    await expect(
      plans.updateMealPlan(safe.data.id, userId, {
        dishes: [prefix + '-peanut'],
      }),
    ).rejects.toMatchObject({ response: { code: 'DIETARY_CONFLICT' } });
    expect(
      (
        await db.mealPlanDish.findMany({ where: { mealPlanId: safe.data.id } })
      ).map((row) => row.dishId),
    ).toEqual([prefix + '-safe']);
    await db.mealPlan.delete({ where: { id: safe.data.id } });
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
        {
          食堂: prefix,
          窗口: window.name,
          菜品名: '普通菜',
          价格: 9,
          菜品英文名: ' ',
          英文描述: ' ',
          过敏原: 'Pine nuts, Milk protein',
        },
      ]),
      '菜品',
    );
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const parsed = await service.parseBatchExcel(
      { buffer, size: buffer.length } as any,
      admin as any,
    );
    const invalidBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      invalidBook,
      XLSX.utils.json_to_sheet([
        {
          食堂: prefix,
          窗口: window.name,
          菜品名: '超长英文',
          价格: 9,
          菜品英文名: 'x'.repeat(201),
          英文描述: 'y'.repeat(4001),
        },
      ]),
      '菜品',
    );
    const invalidBuffer = XLSX.write(invalidBook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    const invalid = await service.parseBatchExcel(
      { buffer: invalidBuffer, size: invalidBuffer.length } as any,
      admin as any,
    );
    expect(invalid.data.items[0].status).toBe('invalid');
    expect(invalid.data.items[0].message).toContain('英文名称超过长度限制');
    expect(invalid.data.items[0].message).toContain('英文描述超过长度限制');
    expect(parsed.data.items[0].nameEn).toBeUndefined();
    expect(parsed.data.items[0].descriptionEn).toBeUndefined();
    expect(parsed.data.items[0].allergens).toEqual([
      'Pine nuts',
      'Milk protein',
    ]);
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
      allergens: ['Pine nuts', 'Milk protein'],
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
    const exclusions = await (rec as any).buildDietaryFilterConditions([
      'pine nuts',
    ]);
    expect(
      await db.dish.findMany({
        where: { id: prefix + '-safe', AND: exclusions },
      }),
    ).toEqual([]);
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
          {
            dishes: [
              parent,
              { ...parent, nameEn: undefined, descriptionEn: undefined },
            ],
          } as any,
          { ...admin, permissions: ['dish:create'] } as any,
        )
      ).data,
    ).toMatchObject({ successCount: 2, failCount: 0 });
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
  it('uses the ECMAScript whitespace set at the PostgreSQL persistence boundary', async () => {
    const whitespace =
      '\t\n\v\f\r \u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';
    for (const separator of [...whitespace, '\u0085']) {
      const input =
        separator + 'Pine' + separator + separator + 'Nuts' + separator;
      const rows = await db.$queryRaw<
        { value: string }[]
      >`SELECT normalize_allergen_text(${input}) AS value`;
      expect(rows[0].value).toBe(normalizeAllergenText(input));
    }
    const saved = await db.user.create({
      data: {
        id: prefix + '-whitespace-user',
        allergens: [
          ' \uFEFFPine\t\nNuts\u3000',
          'PINE  NUTS',
          '私人\u00A0成分',
          '  ',
        ],
      },
    });
    expect(saved.allergens).toEqual(['Pine Nuts', '私人 成分']);
    const profiles = new UserProfileService(db);
    expect(
      (
        await profiles.updateUserProfile(saved.id, {
          allergens: [' PiNe\t NuTs ', 'pine nuts', 'PRIVATE\u3000phrase'],
        })
      ).data.allergens,
    ).toEqual(['PiNe NuTs', 'PRIVATE phrase']);
  });

  it('normalizes catalog names, keeps one spelling per identity and rolls back alias collisions', async () => {
    const key = prefix + '-whitespace';
    const response = await request(app.getHttpServer())
      .post('/admin/allergens')
      .send({
        nameZh: '  ' + key + '  ',
        nameEn: '  Private\t Oats ' + prefix,
        aliases: [' Shared\talias ' + prefix, 'shared  ALIAS ' + prefix],
      })
      .expect(201);
    expect(response.body.data).toMatchObject({
      value: key,
      nameZh: key,
      nameEn: 'Private Oats ' + prefix,
    });
    expect(
      response.body.data.aliases.filter((name) =>
        name.toLowerCase().startsWith('shared'),
      ),
    ).toEqual(['Shared alias ' + prefix]);
    await request(app.getHttpServer())
      .put(
        '/admin/allergens/' +
          encodeURIComponent('  ' + key.toUpperCase() + '  '),
      )
      .send({ nameZh: key + '-renamed', aliases: [' TrEe\t\nNuTs '] })
      .expect(409);
    expect(
      await db.allergen.findUnique({ where: { value: key } }),
    ).toMatchObject({ nameZh: key });
    await request(app.getHttpServer())
      .post('/admin/allergens')
      .send({
        nameZh: prefix + '-space-conflict',
        aliases: [' sHaReD\u3000ALIAS ' + prefix],
      })
      .expect(409);
    expect(
      await db.allergen.findUnique({
        where: { value: prefix + '-space-conflict' },
      }),
    ).toBeNull();
  });

  it('serializes concurrent normalized alias claims through database uniqueness', async () => {
    const responses = await Promise.all(
      [
        {
          nameZh: prefix + '-race-a',
          aliases: ['Concurrent\t alias ' + prefix],
        },
        {
          nameZh: prefix + '-race-b',
          aliases: ['  CONCURRENT  ALIAS ' + prefix],
        },
      ].map((body) =>
        request(app.getHttpServer()).post('/admin/allergens').send(body),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await db.allergen.count({
        where: { value: { in: [prefix + '-race-a', prefix + '-race-b'] } },
      }),
    ).toBe(1);
  });

  it('keeps recommendation and final plan validation equal for normalized aliases and whole private phrases', async () => {
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
    const ids = [
      '-normalized-known',
      '-normalized-private',
      '-whole-term-safe',
    ].map((suffix) => prefix + suffix);
    await db.dish.createMany({
      data: [
        {
          ...base,
          id: ids[0],
          name: 'Curated',
          allergens: ['  TrEe\t\nNuT\u3000'],
        },
        {
          ...base,
          id: ids[1],
          name: 'Private',
          allergens: [' Pine\u00A0Nuts ', 'PINE  NUTS'],
        },
        {
          ...base,
          id: ids[2],
          name: 'Whole term',
          allergens: ['Tree nutshell', 'Pine nutshell'],
        },
      ],
    });
    expect(
      (await db.dish.findUnique({ where: { id: ids[1] } }))?.allergens,
    ).toEqual(['Pine Nuts']);
    const rec = new RecommendationService(
      db,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      allergens,
    );
    const exclusions = [' \u3000TREE  NUTS ', ' pInE\t\nNuTs '];
    const filter = await (rec as any).buildDietaryFilterConditions(exclusions);
    expect(
      (await db.dish.findMany({ where: { id: { in: ids }, AND: filter } })).map(
        (dish) => dish.id,
      ),
    ).toEqual([ids[2]]);
    jest
      .spyOn(rec, 'getUserFeaturesWithCache')
      .mockResolvedValue({ allergens: exclusions, preferences: null } as any);
    const tool = new CreateMealPlanTool(new DishesService(db), rec);
    for (const id of ids.slice(0, 2)) {
      await expect(
        tool.execute(
          {
            dishIds: [id],
            startDate: '2099-11-01',
            endDate: '2099-11-01',
            mealTime: 'lunch',
          },
          { userId: prefix + '-whitespace-user', sessionId: 'test' },
        ),
      ).rejects.toThrow('忌口');
    }
    await expect(
      tool.execute(
        {
          dishIds: [ids[2]],
          startDate: '2099-11-01',
          endDate: '2099-11-01',
          mealTime: 'lunch',
        },
        { userId: prefix + '-whitespace-user', sessionId: 'test' },
      ),
    ).resolves.toHaveProperty('confirmAction');
    const plans = new MealPlansService(db, allergens);
    const userId = prefix + '-whitespace-user';
    await db.user.update({
      where: { id: userId },
      data: { allergens: exclusions },
    });
    for (const id of ids.slice(0, 2)) {
      await expect(
        plans.createMealPlan(userId, {
          dishes: [id],
          startDate: '2099-11-01',
          endDate: '2099-11-01',
          mealTime: MealTime.LUNCH,
        }),
      ).rejects.toMatchObject({ response: { code: 'DIETARY_CONFLICT' } });
    }
    expect(
      (await allergens.catalog()).some(
        (entry) => entry.value.toLowerCase() === 'pine nuts',
      ),
    ).toBe(false);
  });

  it('normalizes legacy snapshot restoration while retaining historical JSON and conflict checks', async () => {
    const base = {
      canteenId: prefix,
      canteenName: prefix,
      windowName: 'test',
      tags: [],
      images: [],
      ingredients: [],
      availableMealTime: ['lunch'],
      price: 8,
      name: 'Snapshot restore',
    };
    const dish = await db.dish.create({
      data: { ...base, allergens: ['Peanut'] },
    });
    const historical = ['  Pine\t\nNuts ', 'PINE  NUTS'];
    const upload = await db.dishUpload.create({
      data: {
        ...base,
        allergens: [' PEANUT\t'],
        status: 'approved',
        kind: 'update',
        approvedDishId: dish.id,
        targetDishId: dish.id,
        changedFields: ['allergens'],
        baseSnapshot: { allergens: historical },
        approvedSnapshot: { allergens: ['  PEANUT '] },
      },
    });
    expect(upload.allergens).toEqual(['PEANUT']);
    const review = new AdminUploadsService(db);
    await review.revokeUpload(upload.id, admin, 1);
    expect(
      (await db.dish.findUnique({ where: { id: dish.id } }))?.allergens,
    ).toEqual(['Pine Nuts']);
    expect(
      (await db.dishUpload.findUnique({ where: { id: upload.id } }))
        ?.baseSnapshot,
    ).toEqual({ allergens: historical });
  });
});
