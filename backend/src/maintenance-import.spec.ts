import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as XLSX from 'xlsx';

type CatalogTable = 'canteen' | 'floor' | 'window' | 'dish';
type CatalogRecord = { id: string; [key: string]: unknown };
type Catalog = Record<CatalogTable, CatalogRecord[]>;

function fixtureDatabase(initial: Partial<Catalog> = {}) {
  let records: Catalog = {
    canteen: [],
    floor: [],
    window: [],
    dish: [],
    ...structuredClone(initial),
  };
  const attempts: Array<{ table: CatalogTable; data: CatalogRecord }> = [];
  const forbiddenDelete = jest.fn(() => new Promise(() => {}));
  const client = {
    // Keep the legacy seed suspended after its first destructive call.
    mealPlanDish: { deleteMany: forbiddenDelete },
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn(async (action) => {
      const draft = structuredClone(records);
      const transaction = Object.fromEntries(
        (Object.keys(draft) as CatalogTable[]).map((table) => [
          table,
          {
            findMany: jest.fn(() =>
              Promise.resolve(structuredClone(draft[table])),
            ),
            create: jest.fn(({ data }) => {
              const record: CatalogRecord = {
                id: `${table}-${draft[table].length + 1}`,
                ...(table === 'window' ? { floorId: null } : {}),
                ...(table === 'dish' ? { parentDishId: null } : {}),
                ...data,
              };
              attempts.push({ table, data: record });
              if (table === 'dish' && data.name === '写入失败') {
                throw new Error('fixture transaction failed');
              }
              draft[table].push(record);
              return Promise.resolve(record);
            }),
          },
        ]),
      );
      const result = await action(transaction);
      records = draft;
      return result;
    }),
  };
  return {
    client,
    attempts,
    forbiddenDelete,
    get records() {
      return records;
    },
  };
}

describe('maintenance catalog import', () => {
  let directory: string;
  let database: ReturnType<typeof fixtureDatabase>;
  let constructor: jest.Mock;
  let imported: typeof import('../prisma/import_canteens');

  const row = (overrides: Record<string, unknown> = {}) => ({
    食堂: '紫荆园',
    楼层: '一楼',
    窗口: '家常菜',
    菜品名: '番茄炒蛋',
    价格: 8,
    供应时间: '午餐、晚餐',
    ...overrides,
  });

  function workbook(rows: Record<string, unknown>[]) {
    const file = join(directory, 'catalog.xlsx');
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), '菜品');
    XLSX.writeFile(book, file);
    return file;
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'tasteinsight-import-'));
    database = fixtureDatabase();
    constructor = jest.fn(() => database.client);
    jest.resetModules();
    jest.doMock('@prisma/client', () => ({
      ...jest.requireActual('@prisma/client'),
      PrismaClient: constructor,
    }));
    imported = jest.requireActual('../prisma/import_canteens');
  });

  afterEach(() => {
    jest.dontMock('@prisma/client');
    rmSync(directory, { recursive: true, force: true });
  });

  it('module import does not construct Prisma', () => {
    expect(constructor).not.toHaveBeenCalled();
  });

  it('module import does not execute database work', () => {
    expect(database.forbiddenDelete).not.toHaveBeenCalled();
    expect(database.client.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a missing workbook before creating a database client', async () => {
    await expect(
      imported.importCanteensFromExcel(join(directory, 'missing.xlsx')),
    ).rejects.toThrow('Excel');
    expect(constructor).not.toHaveBeenCalled();
  });

  it('rejects unreadable workbook data before creating a database client', async () => {
    const file = join(directory, 'broken.xlsx');
    writeFileSync(file, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff]));
    await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
      'Excel',
    );
    expect(constructor).not.toHaveBeenCalled();
  });

  it('rejects a workbook with no data rows', async () => {
    const file = workbook([]);
    await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
      '数据',
    );
    expect(constructor).not.toHaveBeenCalled();
  });

  it.each([
    ['食堂', ''],
    ['窗口', '   '],
    ['菜品名', ''],
    ['价格', ''],
    ['价格', '8元garbage'],
    ['价格', -1],
    ['价格', true],
  ])(
    'validates later row %s=%s before any database access',
    async (key, value) => {
      const file = workbook([row(), row({ [key]: value })]);
      await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
        /第 3 行/,
      );
      expect(constructor).not.toHaveBeenCalled();
      expect(database.attempts).toEqual([]);
    },
  );

  it('imports new catalog records and parent/child dishes once across repeated runs', async () => {
    const file = workbook([
      row({
        菜品名: '套餐',
        菜品子项: '小份',
        价格: '12.5元/份',
        tags: '推荐，午餐',
      }),
      row({ 菜品名: '套餐', 菜品子项: '大份', 价格: 18 }),
      row({ 菜品名: '套餐', 菜品子项: '小份', 价格: '12.5元/份' }),
      row({ 价格: 0 }),
    ]);

    await expect(imported.importCanteensFromExcel(file)).resolves.toEqual({
      canteens: 1,
      floors: 1,
      windows: 1,
      dishes: 4,
    });
    const saved = structuredClone(database.records);
    const parent = saved.dish.find((dish) => dish.name === '套餐')!;
    const child = saved.dish.find((dish) => dish.name === '小份')!;
    expect(parent).toMatchObject({ price: 0, parentDishId: null });
    expect(child).toMatchObject({
      price: 12.5,
      priceUnit: '元/份',
      parentDishId: parent.id,
      tags: ['推荐', '午餐'],
      availableMealTime: ['lunch', 'dinner'],
    });
    expect(saved.dish.find((dish) => dish.name === '番茄炒蛋')?.price).toBe(0);

    await expect(imported.importCanteensFromExcel(file)).resolves.toEqual({
      canteens: 0,
      floors: 0,
      windows: 0,
      dishes: 0,
    });
    expect(database.records).toEqual(saved);
    expect(database.forbiddenDelete).not.toHaveBeenCalled();
    expect(database.client.$disconnect).toHaveBeenCalledTimes(2);
  });

  it('reuses catalog identities without overwriting existing records', async () => {
    database = fixtureDatabase({
      canteen: [{ id: 'c1', name: '紫荆园', description: '保留食堂介绍' }],
      floor: [{ id: 'f1', canteenId: 'c1', name: '一楼', level: '1' }],
      window: [
        {
          id: 'w1',
          canteenId: 'c1',
          floorId: 'f1',
          name: '家常菜',
          number: 'A-9',
        },
      ],
      dish: [
        {
          id: 'd1',
          canteenId: 'c1',
          windowId: 'w1',
          name: '番茄炒蛋',
          parentDishId: null,
          price: 21,
          status: 'offline',
          reviewCount: 12,
        },
      ],
    });
    const before = structuredClone(database.records);
    const file = workbook([
      row({ 食堂: ' 紫荆园 ', 窗口: ' 家常菜 ', 价格: 9 }),
      row({ 菜品名: '新品', 价格: 10 }),
    ]);
    await expect(imported.importCanteensFromExcel(file)).resolves.toEqual({
      canteens: 0,
      floors: 0,
      windows: 0,
      dishes: 1,
    });
    expect(database.records.canteen).toEqual(before.canteen);
    expect(database.records.floor).toEqual(before.floor);
    expect(database.records.window).toEqual(before.window);
    expect(database.records.dish[0]).toEqual(before.dish[0]);
    expect(database.records.dish[1]).toMatchObject({
      canteenId: 'c1',
      floorId: 'f1',
      windowId: 'w1',
      windowNumber: 'A-9',
    });
    expect(database.forbiddenDelete).not.toHaveBeenCalled();
  });

  it('keeps same-name windows and their dishes on distinct floors', async () => {
    const file = workbook([row(), row({ 楼层: '二楼' })]);
    await imported.importCanteensFromExcel(file);
    expect(database.records.floor).toHaveLength(2);
    expect(database.records.window).toHaveLength(2);
    expect(database.records.dish).toHaveLength(2);
    expect(database.records.dish[1]).toMatchObject({
      floorId: database.records.floor[1].id,
      floorLevel: '2',
      windowId: database.records.window[1].id,
    });
    await imported.importCanteensFromExcel(file);
    expect(database.records.window).toHaveLength(2);
    expect(database.records.dish).toHaveLength(2);
  });

  it('supports an optional floor without inventing a blank floor record', async () => {
    const file = workbook([row({ 楼层: '' })]);
    await imported.importCanteensFromExcel(file);
    expect(database.records.floor).toEqual([]);
    expect(database.records.window[0].floorId).toBeNull();
    expect(database.records.dish[0].floorId).toBeNull();
  });

  const existingHierarchy: Partial<Catalog> = {
    canteen: [{ id: 'c1', name: '紫荆园' }],
    floor: [{ id: 'f1', canteenId: 'c1', name: '一楼', level: '1' }],
    window: [
      { id: 'w1', canteenId: 'c1', floorId: 'f1', name: '家常菜', number: '1' },
      { id: 'w2', canteenId: 'c1', floorId: 'f1', name: '家常菜', number: '2' },
    ],
  };

  it('matches explicit window numbers instead of the last same-name record', async () => {
    database = fixtureDatabase(existingHierarchy);
    const file = workbook([row({ 窗口编号: '1' }), row({ 窗口编号: '2' })]);
    await imported.importCanteensFromExcel(file);
    expect(database.records.dish).toHaveLength(2);
    expect(database.records.dish[0]).toMatchObject({
      windowId: 'w1',
      windowNumber: '1',
    });
    expect(database.records.dish[1]).toMatchObject({
      windowId: 'w2',
      windowNumber: '2',
    });
    await imported.importCanteensFromExcel(file);
    expect(database.records.dish).toHaveLength(2);
    expect(database.records.window).toEqual(existingHierarchy.window);
  });

  it('creates distinct explicitly numbered same-name windows once in one workbook', async () => {
    const file = workbook([row({ 窗口编号: '1' }), row({ 窗口编号: '2' })]);
    await imported.importCanteensFromExcel(file);
    expect(database.records.window.map((window) => window.number)).toEqual([
      '1',
      '2',
    ]);
    expect(database.records.dish).toHaveLength(2);
    const saved = structuredClone(database.records);
    await imported.importCanteensFromExcel(file);
    expect(database.records).toEqual(saved);
  });

  it.each([
    {
      field: '食堂',
      initial: {
        canteen: [
          { id: 'c1', name: '紫荆园' },
          { id: 'c2', name: '紫荆园' },
        ],
      },
      values: {},
    },
    {
      field: '楼层',
      initial: {
        ...existingHierarchy,
        floor: [
          { id: 'f1', canteenId: 'c1', name: '一楼', level: '1' },
          { id: 'f2', canteenId: 'c1', name: '一楼', level: '1' },
        ],
      },
      values: {},
    },
    { field: '窗口', initial: existingHierarchy, values: {} },
    {
      field: '窗口',
      initial: {
        ...existingHierarchy,
        window: existingHierarchy.window!.map((window) => ({
          ...window,
          number: '1',
        })),
      },
      values: { 窗口编号: '1' },
    },
    {
      field: '菜品',
      initial: {
        ...existingHierarchy,
        window: existingHierarchy.window!.slice(0, 1),
        dish: [
          { id: 'd1', windowId: 'w1', name: '套餐', parentDishId: null },
          { id: 'd2', windowId: 'w1', name: '套餐', parentDishId: null },
        ],
      },
      values: { 菜品名: '套餐', 菜品子项: '小份' },
    },
  ])(
    'rolls back when a used $field identity remains ambiguous',
    async ({ field, initial, values }) => {
      database = fixtureDatabase(initial);
      const before = structuredClone(database.records);
      const file = workbook([row({ 食堂: '新食堂' }), row(values)]);
      await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
        new RegExp(`第 3 行.*${field}.*多个`),
      );
      expect(database.attempts.length).toBeGreaterThan(0);
      expect(database.records).toEqual(before);
      expect(database.client.$disconnect).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores ambiguous catalog identities not referenced by the workbook', async () => {
    database = fixtureDatabase({
      ...existingHierarchy,
      canteen: [...existingHierarchy.canteen!, { id: 'c2', name: '紫荆园' }],
      floor: [
        ...existingHierarchy.floor!,
        { id: 'f2', canteenId: 'c1', name: '一楼' },
      ],
    });
    const before = structuredClone(database.records);
    const file = workbook([row({ 食堂: '新食堂' })]);
    await expect(imported.importCanteensFromExcel(file)).resolves.toEqual({
      canteens: 1,
      floors: 1,
      windows: 1,
      dishes: 1,
    });
    expect(database.records.canteen.slice(0, 2)).toEqual(before.canteen);
    expect(database.records.floor.slice(0, 2)).toEqual(before.floor);
    expect(database.records.window.slice(0, 2)).toEqual(before.window);
  });

  it('rejects an unnumbered row when its workbook also names multiple window numbers', async () => {
    const file = workbook([
      row({ 窗口编号: '1' }),
      row({ 菜品名: '未指定窗口菜品' }),
      row({ 窗口编号: '2' }),
    ]);
    await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
      /窗口.*多个/,
    );
    expect(database.records.window).toEqual([]);
    expect(database.records.dish).toEqual([]);
  });

  it('uses the sole window number declared later in the workbook for an unnumbered row', async () => {
    const file = workbook([row(), row({ 窗口编号: '1', 菜品名: '第二道菜' })]);
    await imported.importCanteensFromExcel(file);
    expect(database.records.window).toHaveLength(1);
    expect(database.records.window[0].number).toBe('1');
    expect(database.records.dish.map((dish) => dish.windowId)).toEqual([
      database.records.window[0].id,
      database.records.window[0].id,
    ]);
    const saved = structuredClone(database.records);
    await imported.importCanteensFromExcel(file);
    expect(database.records).toEqual(saved);
  });

  it('does not infer a later explicit number over a different existing window', async () => {
    database = fixtureDatabase({
      ...existingHierarchy,
      window: existingHierarchy.window!.slice(0, 1),
    });
    const before = structuredClone(database.records);
    const file = workbook([row(), row({ 窗口编号: '2' })]);
    await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
      /窗口.*多个/,
    );
    expect(database.records).toEqual(before);
  });

  it.each(['AUTO-1', ' AUTO-1 '])(
    'generates window numbers without reusing %s or explicit numbers',
    async (existingNumber) => {
      database = fixtureDatabase({
        canteen: [{ id: 'c1', name: '紫荆园' }],
        window: [
          {
            id: 'w1',
            canteenId: 'c1',
            floorId: null,
            name: '现有窗口',
            number: existingNumber,
          },
        ],
      });
      const file = workbook([
        row(),
        row({ 窗口: '指定窗口', 窗口编号: 'AUTO-2' }),
      ]);
      await imported.importCanteensFromExcel(file);
      expect(database.records.window.map((window) => window.number)).toEqual([
        existingNumber,
        'AUTO-3',
        'AUTO-2',
      ]);
    },
  );

  it('rolls back the whole catalog transaction on a later write failure', async () => {
    const before = structuredClone(database.records);
    const file = workbook([row(), row({ 菜品名: '写入失败' })]);
    await expect(imported.importCanteensFromExcel(file)).rejects.toThrow(
      'fixture transaction failed',
    );
    expect(database.attempts.length).toBeGreaterThan(1);
    expect(database.records).toEqual(before);
    expect(database.client.$transaction).toHaveBeenCalledTimes(1);
    expect(database.client.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(database.client.$disconnect).toHaveBeenCalledTimes(1);
  });
});
