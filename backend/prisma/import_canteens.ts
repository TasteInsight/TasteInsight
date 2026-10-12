import { Prisma, PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

type ImportRow = {
  rowNumber: number;
  canteenName: string;
  floorName: string;
  windowName: string;
  windowNumber: string;
  dishName: string;
  subDishName: string;
  price: number;
  priceUnit: string;
  description: string;
  mealTimes: string[];
  tags: string[];
};

type ExcelCell = string | number | boolean | null | undefined;
const text = (value: ExcelCell): string => String(value ?? '').trim();
const normalizedName = (name: string | null): string =>
  (name ?? '').trim().toLowerCase();
const key = (...parts: (string | null)[]): string => JSON.stringify(parts);
const windowNameKey = (row: ImportRow): string =>
  key(
    normalizedName(row.canteenName),
    normalizedName(row.floorName),
    normalizedName(row.windowName),
  );

function groupByKey<T>(records: T[], identify: (record: T) => string) {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const identity = identify(record);
    const candidates = groups.get(identity) ?? [];
    candidates.push(record);
    groups.set(identity, candidates);
  }
  return groups;
}

function uniqueMatch<T>(
  candidates: T[] | undefined,
  label: string,
): T | undefined {
  if (candidates && candidates.length > 1) {
    throw new Error(`${label}匹配到多个记录，无法唯一确定`);
  }
  return candidates?.[0];
}

function readImportRows(filePath: string): ImportRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch {
    throw new Error(`无法读取 Excel 文件：${filePath}`);
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Excel 文件中没有工作表');

  const source = XLSX.utils.sheet_to_json<Record<string, ExcelCell>>(sheet, {
    defval: '',
  });
  const rows: ImportRow[] = [];
  for (const [index, sourceRow] of source.entries()) {
    const row = Object.fromEntries(
      Object.entries(sourceRow).map(([column, value]) => [
        column.trim(),
        value,
      ]),
    );
    if (Object.values(row).every((value) => text(value) === '')) continue;

    const rowNumber = Number(sourceRow.__rowNum__ ?? index + 1) + 1;
    for (const column of ['食堂', '窗口', '菜品名']) {
      if (!text(row[column])) {
        throw new Error(`Excel 第 ${rowNumber} 行：${column}不能为空`);
      }
    }
    const rawPrice = row['价格'];
    const priceMatch =
      typeof rawPrice === 'string'
        ? rawPrice.trim().match(/^(\d+(?:\.\d+)?)\s*(?:元)?(?:\/(.+))?$/)
        : null;
    const price =
      typeof rawPrice === 'number'
        ? rawPrice
        : priceMatch
          ? Number(priceMatch[1])
          : Number.NaN;
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Excel 第 ${rowNumber} 行：价格必须为非负数`);
    }
    const supplyTime = text(row['供应时间']);
    const mealTimes = [
      ['早餐', 'breakfast'],
      ['午餐', 'lunch'],
      ['晚餐', 'dinner'],
      ['夜宵', 'nightsnack'],
    ]
      .filter(([label]) => supplyTime.includes(label))
      .map(([, value]) => value);
    rows.push({
      rowNumber,
      canteenName: text(row['食堂']),
      floorName: text(row['楼层']),
      windowName: text(row['窗口']),
      windowNumber: text(row['窗口编号']),
      dishName: text(row['菜品名']),
      subDishName: text(row['菜品子项']),
      price,
      priceUnit: priceMatch?.[2] ? `元/${priceMatch[2].trim()}` : '元',
      description: text(row['菜品描述']),
      mealTimes,
      tags: text(row.tags)
        .split(/[,，\s]+/)
        .filter(Boolean),
    });
  }
  if (!rows.length) throw new Error('Excel 文件中没有可导入的数据');
  return rows;
}

function floorLevel(name: string): string {
  if (name.includes('地下')) return '-1';
  const digits = name.match(/-?\d+/);
  if (digits) return digits[0];
  const chinese = '一二三四五六七八九十';
  const index = [...chinese].findIndex((numeral) => name.includes(numeral));
  return index < 0 ? '1' : String(index + 1);
}

export async function importCanteensFromExcel(
  filePath = path.join(__dirname, 'DishesofZijingYuan.xlsx'),
) {
  const rows = readImportRows(filePath);
  const windowRows = groupByKey(rows, windowNameKey);
  const prisma = new PrismaClient();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const [
          existingCanteens,
          existingFloors,
          existingWindows,
          existingDishes,
        ] = await Promise.all([
          tx.canteen.findMany(),
          tx.floor.findMany(),
          tx.window.findMany(),
          tx.dish.findMany(),
        ]);
        const canteens = groupByKey(existingCanteens, (canteen) =>
          normalizedName(canteen.name),
        );
        const floors = groupByKey(existingFloors, (floor) =>
          key(floor.canteenId, normalizedName(floor.name)),
        );
        const windows = groupByKey(existingWindows, (window) =>
          key(window.canteenId, window.floorId, normalizedName(window.name)),
        );
        const dishes = groupByKey(existingDishes, (dish) =>
          key(dish.windowId, dish.name.trim(), dish.parentDishId),
        );
        const usedWindowNumbers = new Map<string, Set<string>>();
        const created = { canteens: 0, floors: 0, windows: 0, dishes: 0 };

        for (const row of rows) {
          const rowLabel = `Excel 第 ${row.rowNumber} 行：`;
          const canteenKey = normalizedName(row.canteenName);
          let canteen = uniqueMatch(
            canteens.get(canteenKey),
            `${rowLabel}食堂“${row.canteenName}”`,
          );
          if (!canteen) {
            canteen = await tx.canteen.create({
              data: { name: row.canteenName, openingHours: [], images: [] },
            });
            canteens.set(canteenKey, [canteen]);
            created.canteens++;
          }

          const floorKey = key(canteen.id, normalizedName(row.floorName));
          let floor = row.floorName
            ? uniqueMatch(
                floors.get(floorKey),
                `${rowLabel}楼层“${row.floorName}”`,
              )
            : undefined;
          if (row.floorName && !floor) {
            floor = await tx.floor.create({
              data: {
                canteenId: canteen.id,
                name: row.floorName,
                level: floorLevel(row.floorName),
              },
            });
            floors.set(floorKey, [floor]);
            created.floors++;
          }

          const windowKey = key(
            canteen.id,
            floor?.id ?? null,
            normalizedName(row.windowName),
          );
          const windowCandidates = windows.get(windowKey) ?? [];
          const windowLabel = `${rowLabel}窗口“${row.windowName}”`;
          let number = row.windowNumber;
          if (!number) {
            const possibleNumbers = new Set([
              ...windowCandidates.map((candidate) => candidate.number.trim()),
              ...windowRows
                .get(windowNameKey(row))!
                .map((item) => item.windowNumber)
                .filter(Boolean),
            ]);
            if (possibleNumbers.size > 1) {
              throw new Error(`${windowLabel}匹配到多个编号，请填写窗口编号`);
            }
            number = [...possibleNumbers][0] ?? '';
          }
          let window = uniqueMatch(
            windowCandidates.filter(
              (candidate) => !number || candidate.number.trim() === number,
            ),
            number ? `${windowLabel}（编号 ${number}）` : windowLabel,
          );
          if (!window) {
            if (!number) {
              let used = usedWindowNumbers.get(canteen.id);
              if (!used) {
                used = new Set(
                  existingWindows
                    .filter((item) => item.canteenId === canteen.id)
                    .map((item) => item.number.trim()),
                );
                for (const item of rows) {
                  if (
                    normalizedName(item.canteenName) === canteenKey &&
                    item.windowNumber
                  ) {
                    used.add(item.windowNumber);
                  }
                }
                usedWindowNumbers.set(canteen.id, used);
              }
              let next = 1;
              while (used.has(`AUTO-${next}`)) next++;
              number = `AUTO-${next}`;
              used.add(number);
            }
            window = await tx.window.create({
              data: {
                canteenId: canteen.id,
                floorId: floor?.id ?? null,
                name: row.windowName,
                number,
                tags: [],
              },
            });
            windows.set(windowKey, [...windowCandidates, window]);
            created.windows++;
          }

          const location = {
            canteenId: canteen.id,
            canteenName: canteen.name,
            floorId: floor?.id ?? null,
            floorLevel: floor?.level ?? null,
            floorName: floor?.name ?? null,
            windowId: window.id,
            windowNumber: window.number,
            windowName: window.name,
            availableMealTime: row.mealTimes,
            tags: row.tags,
            images: [],
            ingredients: [],
            allergens: [],
            status: 'online',
          };
          let parentDishId: string | null = null;
          if (row.subDishName) {
            const parentKey = key(window.id, row.dishName, null);
            let parent = uniqueMatch(
              dishes.get(parentKey),
              `${rowLabel}父菜品“${row.dishName}”`,
            );
            if (!parent) {
              parent = await tx.dish.create({
                data: { ...location, name: row.dishName, price: 0 },
              });
              dishes.set(parentKey, [parent]);
              created.dishes++;
            }
            parentDishId = parent.id;
          }
          const name = row.subDishName || row.dishName;
          const dishKey = key(window.id, name, parentDishId);
          const existingDish = uniqueMatch(
            dishes.get(dishKey),
            `${rowLabel}菜品“${name}”`,
          );
          if (!existingDish) {
            const dish = await tx.dish.create({
              data: {
                ...location,
                name,
                parentDishId,
                price: row.price,
                priceUnit: row.priceUnit,
                description: row.description,
              },
            });
            dishes.set(dishKey, [dish]);
            created.dishes++;
          }
        }
        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60_000,
      },
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importCanteensFromExcel(process.argv[2])
    .then((created) => console.log('Catalog import finished:', created))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
