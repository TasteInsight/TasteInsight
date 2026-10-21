import { canonicalModerationImageUrls } from '@/upload/moderation-image-url';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Dish } from '@prisma/client';
import { createHash } from 'crypto';

export const CONTRIBUTION_FIELDS = [
  'name',
  'tags',
  'price',
  'priceUnit',
  'description',
  'images',
  'ingredients',
  'allergens',
  'spicyLevel',
  'sweetness',
  'saltiness',
  'oiliness',
  'calories',
  'protein',
  'carbohydrate',
  'fat',

  'windowId',
  'windowName',
  'windowNumber',
  'availableMealTime',
  'availableDates',
] as const;
const locationFields = ['windowId', 'windowName', 'windowNumber'];
const dishFields = [
  ...CONTRIBUTION_FIELDS,
  'floorId',
  'floorLevel',
  'floorName',
];
const nullableFields = new Set([
  'calories',
  'protein',
  'carbohydrate',
  'fat',

  'priceUnit',
  'description',
  'windowId',
  'windowNumber',
  'availableDates',
]);

export function assertRevision(
  current: { revision?: number },
  revision?: number,
) {
  if (revision !== undefined && revision !== (current.revision ?? 1)) {
    throw new ConflictException('提交记录已更新，请刷新后重试');
  }
}

export function checkedFields(fields: string[] | undefined): string[] {
  if (
    !fields?.length ||
    fields.some(
      (field) => !(CONTRIBUTION_FIELDS as readonly string[]).includes(field),
    )
  ) {
    throw new BadRequestException('请明确选择允许补全的字段');
  }
  return [...new Set(fields)];
}

export function contributionSnapshot(
  dish: Record<string, any>,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    [...dishFields, 'canteenId', 'parentDishId', 'status', 'updatedAt'].map(
      (field) => [
        field,
        field === 'images' && Array.isArray(dish[field])
          ? canonicalModerationImageUrls(dish[field])
          : dish[field] instanceof Date
            ? dish[field].toISOString()
            : (dish[field] ?? null),
      ],
    ),
  );
}

export function sameValue(
  left: unknown,
  right: unknown,
  field?: string,
): boolean {
  const comparable = (value: unknown) =>
    field === 'images' && Array.isArray(value)
      ? canonicalModerationImageUrls(value)
      : value;
  return (
    JSON.stringify(comparable(left) ?? null) ===
    JSON.stringify(comparable(right) ?? null)
  );
}

export function publicationFields(fields: string[]): string[] {
  return [
    ...new Set(
      fields.flatMap((field) =>
        locationFields.includes(field)
          ? [...locationFields, 'floorId', 'floorLevel', 'floorName']
          : [field],
      ),
    ),
  ];
}

export function changedDishData(
  upload: Record<string, any>,
  target: Record<string, any>,
  fields: string[],
) {
  return Object.fromEntries(
    publicationFields(fields).map((field) => [
      field,
      field === 'images'
        ? canonicalModerationImageUrls([
            ...(target.images ?? []),
            ...(upload.images ?? []),
          ])
        : field === 'floorId'
          ? (upload.window?.floorId ?? null)
          : field === 'floorLevel'
            ? (upload.window?.floor?.level ?? null)
            : field === 'floorName'
              ? (upload.window?.floor?.name ?? null)
              : (upload[field] ?? null),
    ]),
  );
}

export function assertBaseline(
  target: Record<string, any>,
  snapshot: any,
  fields: string[],
) {
  if (
    !snapshot ||
    publicationFields(fields).some(
      (field) => !sameValue(target[field], snapshot[field], field),
    )
  ) {
    throw new ConflictException('正式菜品资料已变化，请刷新并重新提交审核');
  }
}

export function requestFingerprint(input: Record<string, any>): string {
  const canonical = (value: any): any =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .filter(
                (key) => value[key] !== undefined && key !== 'clientRequestId',
              )
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return createHash('sha256')
    .update(
      JSON.stringify(
        canonical({
          ...input,
          ...(Array.isArray(input.images)
            ? { images: canonicalModerationImageUrls(input.images) }
            : {}),
        }),
      ),
    )
    .digest('hex');
}

export async function prepareContribution(
  tx: Prisma.TransactionClient,
  input: Record<string, any>,
  target?: Dish | null,
  previous?: Record<string, any>,
): Promise<Record<string, any>> {
  const fields = target ? checkedFields(input.changedFields) : undefined;
  if (target && input.canteenId && input.canteenId !== target.canteenId) {
    throw new BadRequestException('补全不能变更菜品所属食堂');
  }
  if (
    target &&
    input.targetDishUpdatedAt &&
    new Date(input.targetDishUpdatedAt).getTime() !== target.updatedAt.getTime()
  ) {
    throw new ConflictException('菜品资料已更新，请刷新后补全');
  }
  if (target && target.status !== 'online')
    throw new BadRequestException('该菜品暂不可补全');
  for (const field of fields ?? CONTRIBUTION_FIELDS) {
    if (fields && input[field] === undefined)
      throw new BadRequestException(`缺少补全字段：${field}`);
    if (input[field] === null && !nullableFields.has(field))
      throw new BadRequestException(`字段不能为空：${field}`);
  }
  const source = {
    ...(target ?? previous ?? {}),
    ...Object.fromEntries(
      (fields ?? CONTRIBUTION_FIELDS)
        .filter((field) => input[field] !== undefined)
        .map((field) => [field, input[field]]),
    ),
  };
  if (
    !Number.isFinite(source.price) ||
    source.price < 0 ||
    !Array.isArray(source.availableMealTime)
  ) {
    throw new BadRequestException('价格和供应时段不能为空');
  }
  const canteenId = target?.canteenId ?? input.canteenId ?? previous?.canteenId;
  const canteen = canteenId
    ? await tx.canteen.findUnique({ where: { id: canteenId } })
    : await tx.canteen.findFirst({ where: { name: input.canteenName } });
  if (!canteen) throw new BadRequestException('指定的食堂不存在');
  const locationChanged = fields?.some((field) =>
    locationFields.includes(field),
  );
  const location = locationChanged
    ? Object.fromEntries(
        locationFields
          .filter((field) => fields!.includes(field))
          .map((field) => [field, input[field]]),
      )
    : source;
  let window: any = null;
  if (location.windowId) {
    window = await tx.window.findUnique({ where: { id: location.windowId } });
    if (!window) throw new BadRequestException('指定的窗口不存在');
    if (window.canteenId !== canteen.id)
      throw new BadRequestException('指定的窗口不属于该食堂');
  } else if (location.windowName) {
    window = await tx.window.findFirst({
      where: { canteenId: canteen.id, name: location.windowName },
    });
  } else if (location.windowNumber) {
    window = await tx.window.findFirst({
      where: { canteenId: canteen.id, number: location.windowNumber },
    });
  }
  if (
    !window &&
    (location.windowId || location.windowName || location.windowNumber)
  ) {
    throw new BadRequestException('指定的窗口不存在或信息不完整');
  }
  if (!target && !previous?.approvedDishId && input.parentDishId) {
    const parent = await tx.dish.findUnique({
      where: { id: input.parentDishId },
    });
    if (
      !parent ||
      parent.canteenId !== canteen.id ||
      parent.status !== 'online'
    ) {
      throw new BadRequestException('父菜品必须是同食堂已上架菜品');
    }
  }
  return {
    name: source.name?.trim() || '未命名菜品',
    tags: source.tags ?? [],
    price: source.price,
    priceUnit: source.priceUnit ?? null,
    description: source.description ?? null,
    images: canonicalModerationImageUrls(source.images ?? []),
    ingredients: source.ingredients ?? [],
    allergens: source.allergens ?? [],
    spicyLevel: source.spicyLevel ?? 0,
    sweetness: source.sweetness ?? 0,
    saltiness: source.saltiness ?? 0,
    oiliness: source.oiliness ?? 0,
    calories: source.calories ?? null,
    protein: source.protein ?? null,
    carbohydrate: source.carbohydrate ?? null,
    fat: source.fat ?? null,

    canteenId: canteen.id,
    canteenName: canteen.name,
    windowId: window?.id ?? null,
    windowName: window?.name ?? '',
    windowNumber: window?.number ?? null,
    availableMealTime: source.availableMealTime,
    availableDates: source.availableDates ?? Prisma.DbNull,
    ...(fields
      ? {
          changedFields: publicationFields(fields).filter(
            (field) => !field.startsWith('floor'),
          ),
        }
      : {}),
  };
}
