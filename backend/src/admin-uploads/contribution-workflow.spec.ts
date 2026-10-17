import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DishesService } from '@/dishes/dishes.service';
import { UserProfileService } from '@/user-profile/user-profile.service';
import { NotificationService } from '@/notifications/notification.service';
import { AdminUploadsService } from './admin-uploads.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { DishStatus } from '@/admin-dishes/dto/admin-dish.dto';

const admin = {
  id: 'admin',
  username: 'admin',
  scope: 'GLOBAL' as const,
  canteenIds: [],
  canteens: [],
  role: 'superadmin',
  permissions: ['upload:approve'],
};
const date = new Date('2026-10-11T00:00:00Z');
const base = {
  name: '鸡肉饭',
  price: 10,
  priceUnit: '份',
  canteenId: 'canteen',
  canteenName: '食堂',
  description: '旧描述',
  tags: [],
  images: ['old.jpg'],
  ingredients: [],
  allergens: [],
  spicyLevel: 0,
  sweetness: 0,
  saltiness: 0,
  oiliness: 0,
  windowId: null,
  windowName: '',
  windowNumber: null,
  floorId: null,
  floorName: null,
  floorLevel: null,
  availableMealTime: ['lunch'],
  availableDates: null,
  parentDishId: null,
};

function fixture() {
  const uploads = new Map<string, any>();
  const dishes = new Map<string, any>([
    [
      'dish',
      {
        ...base,
        id: 'dish',
        status: 'online',
        averageRating: 4.5,
        reviewCount: 3,
        createdAt: date,
        updatedAt: date,
      },
    ],
  ]);
  let serial = 1;
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'userId_clientRequestId')
        return (
          row.userId === value.userId &&
          row.clientRequestId === value.clientRequestId
        );
      if (value && typeof value === 'object') {
        if ('not' in value) return row[key] !== value.not;
        if ('in' in value) return value.in.includes(row[key]);
        if ('contains' in value) return row[key]?.includes(value.contains);
      }
      return row[key] === value;
    });
  const normalize = (data: any) =>
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === Prisma.DbNull ? null : value,
      ]),
    );
  const write = (rows: Map<string, any>, where: any, data: any) => {
    const row = [...rows.values()].find((entry) => matches(entry, where));
    if (!row) throw new Error('P2025');
    Object.assign(row, normalize(data));
    return { ...row };
  };
  const prisma: any = {
    canteen: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === 'canteen' ? { id: 'canteen', name: '食堂' } : null,
      ),
      findFirst: jest.fn(async () => ({ id: 'canteen', name: '食堂' })),
    },
    window: {
      findUnique: jest.fn(async ({ where }) => ({
        id: where.id,
        name: '新窗口',
        number: '2',
        canteenId: 'canteen',
        canteen: { id: 'canteen', name: '食堂' },
        floorId: 'floor',
        floor: { name: '一楼', level: '1' },
      })),
      findFirst: jest.fn(),
    },
    contributionImage: { findMany: jest.fn(async () => []) },
    userSetting: {
      findUnique: jest.fn(async () => ({ reviewReplyAlert: false })),
    },
    notification: { createMany: jest.fn(async () => ({ count: 1 })) },
    notificationCampaign: {
      createMany: jest.fn(async () => ({ count: 1 })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    dishUpload: {
      findUnique: jest.fn(async ({ where }) => {
        const row = [...uploads.values()].find((entry) =>
          matches(entry, where),
        );
        return row
          ? {
              ...row,
              window: row.windowId
                ? {
                    id: row.windowId,
                    floorId: 'floor',
                    floor: { name: '一楼', level: '1' },
                  }
                : null,
            }
          : null;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          [...uploads.values()].find((row) => matches(row, where)) ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        [...uploads.values()].filter((row) => matches(row, where)),
      ),
      count: jest.fn(
        async ({ where }) =>
          [...uploads.values()].filter((row) => matches(row, where)).length,
      ),
      create: jest.fn(async ({ data }) => {
        const id = `upload-${serial++}`;
        const row = {
          id,
          revision: 1,
          createdAt: date,
          updatedAt: date,
          approvedDishId: null,
          parentDishId: null,
          parentUploadId: null,
          changedFields: [],
          ...normalize(data),
        };
        uploads.set(id, row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }) => write(uploads, where, data)),
      updateMany: jest.fn(async ({ where, data }) => {
        const matched = [...uploads.values()].filter((row) =>
          matches(row, where),
        );
        matched.forEach((row) => Object.assign(row, normalize(data)));
        return { count: matched.length };
      }),
    },
    dish: {
      findUnique: jest.fn(async ({ where }) => {
        const row = dishes.get(where.id);
        return row ? { ...row } : null;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          [...dishes.values()].find((row) => matches(row, where)) ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        [...dishes.values()].filter((row) => matches(row, where)),
      ),
      update: jest.fn(async ({ where, data }) => write(dishes, where, data)),
      create: jest.fn(async ({ data }) => {
        const id = `dish-${serial++}`;
        const row = {
          id,
          createdAt: date,
          updatedAt: date,
          ...normalize(data),
        };
        dishes.set(id, row);
        return { ...row };
      }),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (callback) => {
      const save = new Map(
        [...uploads].map(([key, value]) => [key, { ...value }]),
      );
      const saveDishes = new Map(
        [...dishes].map(([key, value]) => [key, { ...value }]),
      );
      try {
        return await callback(prisma);
      } catch (error) {
        uploads.clear();
        save.forEach((value, key) => uploads.set(key, value));
        dishes.clear();
        saveDishes.forEach((value, key) => dishes.set(key, value));
        throw error;
      }
    }),
  };
  const notifications = new NotificationService(prisma, {
    get: () => undefined,
  } as unknown as ConfigService);
  const submit = new DishesService(prisma);
  const users = new UserProfileService(prisma);
  const review = new AdminUploadsService(prisma, notifications);
  const manage = new AdminDishesService(prisma);
  const create = async (input: any = {}) =>
    (await submit.uploadDish({ ...base, ...input }, 'author')).data;
  const correct = async (input: any = {}) =>
    (
      await submit.uploadDish(
        {
          targetDishId: 'dish',
          changedFields: ['price'],
          price: 12,
          ...input,
        },
        'author',
      )
    ).data;
  return {
    uploads,
    dishes,
    prisma,
    submit,
    users,
    review,
    manage,
    create,
    correct,
  };
}

describe('Contribution workflow', () => {
  it.each(['reviewer', 'contributor'])(
    'lets a %s edit and restore a detached dish after its obsolete parent becomes an offline child',
    async (editor) => {
      const state = fixture();
      const upload = await state.create({ parentDishId: 'dish', price: 5 });
      await state.review.approveUpload(upload.id, admin, { revision: 1 });
      const dishId = state.uploads.get(upload.id).approvedDishId;
      await state.manage.updateAdminDish(dishId, { parentDishId: null }, admin);
      await state.manage.updateAdminDish(
        'dish',
        { parentDishId: dishId, status: DishStatus.OFFLINE },
        admin,
      );
      await state.review.revokeUpload(upload.id, admin, 2);
      if (editor === 'reviewer') {
        await expect(
          state.review.editUpload(
            upload.id,
            { revision: 3, parentDishId: 'other' },
            admin,
          ),
        ).rejects.toThrow(BadRequestException);
        await state.review.editUpload(
          upload.id,
          { revision: 3, price: 9 },
          admin,
        );
      } else {
        await expect(
          state.users.updateMyUpload('author', upload.id, {
            ...base,
            revision: 3,
            parentDishId: 'other',
          } as any),
        ).rejects.toThrow(BadRequestException);
        await state.users.updateMyUpload('author', upload.id, {
          ...base,
          revision: 3,
          price: 9,
          parentDishId: 'dish',
        } as any);
      }
      await state.review.approveUpload(upload.id, admin, { revision: 4 });
      expect(state.dishes.get(dishId)).toMatchObject({
        status: 'online',
        parentDishId: null,
        price: 9,
      });
      expect(state.dishes.get('dish')).toMatchObject({
        status: 'offline',
        parentDishId: dishId,
      });
      expect(state.uploads.get(upload.id)).toMatchObject({
        status: 'approved',
        approvedDishId: dishId,
        parentDishId: 'dish',
      });
    },
  );

  async function revokedCreation(formalChanges: Record<string, unknown> = {}) {
    const state = fixture();
    const record = await state.create({
      price: 5,
      description: '原投稿',
      tags: [],
    });
    await state.review.approveUpload(record.id, admin, { revision: 1 });
    const dishId = state.uploads.get(record.id).approvedDishId;
    await state.manage.updateAdminDish(
      dishId,
      {
        price: 7,
        description: '正式资料更新',
        tags: ['正式标签'],
        ...formalChanges,
      },
      admin,
    );
    await state.review.revokeUpload(record.id, admin, 2);
    return { ...state, uploadId: record.id, dishId };
  }

  it('restores a created dish without overwriting later formal price, description or tags', async () => {
    const state = await revokedCreation();
    await state.review.approveUpload(state.uploadId, admin, { revision: 3 });
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'online',
      price: 7,
      description: '正式资料更新',
      tags: ['正式标签'],
    });
  });

  it('applies only explicitly edited draft fields when restoring a created dish', async () => {
    const state = await revokedCreation();
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, price: 8 },
      admin,
    );
    await state.manage.updateAdminDish(
      state.dishId,
      { description: '撤销后的正式描述' },
      admin,
    );
    await state.review.approveUpload(state.uploadId, admin, { revision: 4 });
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'online',
      price: 8,
      description: '撤销后的正式描述',
      tags: ['正式标签'],
    });
  });

  it('rejects a new formal conflict only on the explicitly edited recovery fields', async () => {
    const state = await revokedCreation();
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, price: 8 },
      admin,
    );
    await state.manage.updateAdminDish(state.dishId, { price: 9 }, admin);
    await expect(
      state.review.approveUpload(state.uploadId, admin, { revision: 4 }),
    ).rejects.toThrow(ConflictException);
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'offline',
      price: 9,
    });
    expect(state.uploads.get(state.uploadId)).toMatchObject({
      status: 'pending',
      revision: 4,
    });
  });

  it('does not reject an unedited recovery when formal fields change after revocation', async () => {
    const state = await revokedCreation();
    await state.manage.updateAdminDish(
      state.dishId,
      { price: 9, description: '撤销后更新' },
      admin,
    );
    await state.review.approveUpload(state.uploadId, admin, { revision: 3 });
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'online',
      price: 9,
      description: '撤销后更新',
    });
  });

  it('resets draft and formal recovery baselines on every revocation', async () => {
    const state = await revokedCreation();
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, price: 8 },
      admin,
    );
    await state.review.approveUpload(state.uploadId, admin, { revision: 4 });
    await state.manage.updateAdminDish(
      state.dishId,
      { price: 11, tags: ['第二轮标签'] },
      admin,
    );
    await state.review.revokeUpload(state.uploadId, admin, 5);
    expect(state.uploads.get(state.uploadId)).toMatchObject({
      baseSnapshot: { price: 8, description: '原投稿' },
      approvedSnapshot: { price: 11, tags: ['第二轮标签'] },
    });
    await state.review.approveUpload(state.uploadId, admin, { revision: 6 });
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'online',
      price: 11,
      tags: ['第二轮标签'],
    });
  });

  it('appends recovery images without removing images added to the formal dish', async () => {
    const state = await revokedCreation({ images: ['old.jpg', 'formal.jpg'] });
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, images: ['new.jpg', 'old.jpg'] },
      admin,
    );
    await state.review.approveUpload(state.uploadId, admin, { revision: 4 });
    expect(state.dishes.get(state.dishId).images).toEqual([
      'old.jpg',
      'formal.jpg',
      'new.jpg',
    ]);
    expect(state.dishes.get(state.dishId).price).toBe(7);
  });

  it('restores edited locations as one authoritative window and floor group', async () => {
    const state = await revokedCreation();
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, windowId: 'new-window' },
      admin,
    );
    await state.review.approveUpload(state.uploadId, admin, { revision: 4 });
    expect(state.dishes.get(state.dishId)).toMatchObject({
      windowId: 'new-window',
      windowName: '新窗口',
      windowNumber: '2',
      floorId: 'floor',
      floorName: '一楼',
      floorLevel: '1',
      price: 7,
    });
  });

  it('rejects a formal location change during recovery of the window group', async () => {
    const state = await revokedCreation();
    await state.review.editUpload(
      state.uploadId,
      { revision: 3, windowId: 'new-window' },
      admin,
    );
    await state.manage.updateAdminDish(
      state.dishId,
      { windowId: 'formal-window' },
      admin,
    );
    await expect(
      state.review.approveUpload(state.uploadId, admin, { revision: 4 }),
    ).rejects.toThrow(ConflictException);
    expect(state.dishes.get(state.dishId)).toMatchObject({
      status: 'offline',
      windowId: 'formal-window',
    });
  });

  it('returns the same submission after a lost response and rejects changed payload reuse', async () => {
    const { create, prisma } = fixture();
    const first = await create({ clientRequestId: 'request' });
    expect(await create({ clientRequestId: 'request' })).toEqual(first);
    await expect(
      create({ clientRequestId: 'request', price: 0 }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.dishUpload.create).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'author:request',
    );
  });

  it('scopes idempotency keys to each contributor', async () => {
    const { create, submit, prisma } = fixture();
    await create({ clientRequestId: 'request' });
    await submit.uploadDish(
      { ...base, clientRequestId: 'request' } as any,
      'another',
    );
    expect(prisma.dishUpload.create).toHaveBeenCalledTimes(2);
  });

  it('stores and publishes only declared corrections, appending unique images', async () => {
    const { correct, review, dishes, uploads, prisma } = fixture();
    const record = await correct({
      changedFields: ['price', 'images'],
      images: ['old.jpg', 'new.jpg'],
      name: '忽略未声明名称',
    });
    expect(uploads.get(record.id).name).toBe(base.name);
    await review.approveUpload(record.id, admin, { revision: 1 });
    expect(dishes.get('dish')).toMatchObject({
      name: base.name,
      price: 12,
      images: ['old.jpg', 'new.jpg'],
      averageRating: 4.5,
      reviewCount: 3,
    });
    expect(prisma.dish.create).not.toHaveBeenCalled();
    expect(uploads.get(record.id)).toMatchObject({
      approvedDishId: 'dish',
      status: 'approved',
      refreshPending: true,
      revision: 2,
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'upload_approved',
          targetType: 'dish_upload',
          targetId: record.id,
          userId: 'author',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it.each(['canteenId', 'parentDishId', 'status', 'averageRating'])(
    'rejects correction of privileged field %s',
    async (field) => {
      const { correct } = fixture();
      await expect(
        correct({ changedFields: [field], [field]: 'other' }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects moving the correction to another canteen', async () => {
    await expect(fixture().correct({ canteenId: 'other' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a form opened before the target changed', async () => {
    await expect(
      fixture().correct({ targetDishUpdatedAt: '2026-10-10T00:00:00Z' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects approval when the corrected field changed during review', async () => {
    const { correct, review, dishes, uploads } = fixture();
    const record = await correct();
    dishes.get('dish').price = 13;
    await expect(
      review.approveUpload(record.id, admin, { revision: 1 }),
    ).rejects.toThrow(ConflictException);
    expect(uploads.get(record.id).status).toBe('pending');
    expect(dishes.get('dish').price).toBe(13);
  });

  it('does not block a correction because an unrelated field changed', async () => {
    const { correct, review, dishes } = fixture();
    const record = await correct();
    dishes.get('dish').description = '其他已审核更正';
    await review.approveUpload(record.id, admin, { revision: 1 });
    expect(dishes.get('dish')).toMatchObject({
      description: '其他已审核更正',
      price: 12,
    });
  });

  it('allows explicit moderation baseline confirmation without silently rebasing edits', async () => {
    const { correct, review, dishes, uploads } = fixture();
    const record = await correct();
    dishes.get('dish').price = 15;
    await review.editUpload(record.id, { revision: 1, price: 14 }, admin);
    expect(uploads.get(record.id).baseSnapshot.price).toBe(10);
    await expect(
      review.approveUpload(record.id, admin, { revision: 2 }),
    ).rejects.toThrow(ConflictException);
    await review.editUpload(
      record.id,
      { revision: 2, targetDishUpdatedAt: date.toISOString() },
      admin,
    );
    await review.approveUpload(record.id, admin, { revision: 3 });
    expect(dishes.get('dish').price).toBe(14);
  });

  it('restores only contribution fields on safe correction revoke', async () => {
    const { correct, review, dishes, uploads } = fixture();
    const record = await correct();
    await review.approveUpload(record.id, admin, { revision: 1 });
    dishes.get('dish').description = '后续不相关修改';
    await review.revokeUpload(record.id, admin, 2);
    expect(dishes.get('dish')).toMatchObject({
      price: 10,
      description: '后续不相关修改',
      status: 'online',
    });
    expect(uploads.get(record.id)).toMatchObject({
      approvedDishId: 'dish',
      status: 'pending',
      revision: 3,
    });
  });

  it('keeps created dish identity and engagement statistics through revoke and reapproval', async () => {
    const { create, review, dishes, uploads, prisma } = fixture();
    const record = await create();
    await review.approveUpload(record.id, admin, { revision: 1 });
    const dishId = uploads.get(record.id).approvedDishId;
    Object.assign(dishes.get(dishId), { reviewCount: 7, averageRating: 4.2 });
    await review.revokeUpload(record.id, admin, 2);
    expect(dishes.get(dishId).status).toBe('offline');
    await review.approveUpload(record.id, admin, { revision: 3 });
    expect(uploads.get(record.id).approvedDishId).toBe(dishId);
    expect(dishes.get(dishId)).toMatchObject({
      reviewCount: 7,
      averageRating: 4.2,
      status: 'online',
    });
    expect(prisma.dish.delete).not.toHaveBeenCalled();
    expect(prisma.dish.create).toHaveBeenCalledTimes(1);
  });

  it('requires explicit merge and applies only selected fields', async () => {
    const { create, review, dishes, uploads, prisma } = fixture();
    const record = await create({ price: 7, description: '新描述' });
    await expect(
      review.approveUpload(record.id, admin, {
        revision: 1,
        mergeDishId: 'dish',
        mergeFields: ['description'],
      }),
    ).rejects.toThrow(ConflictException);
    await review.approveUpload(record.id, admin, {
      revision: 1,
      mergeDishId: 'dish',
      mergeDishUpdatedAt: date.toISOString(),
      mergeFields: ['description'],
    });
    expect(dishes.get('dish')).toMatchObject({
      price: 10,
      description: '新描述',
    });
    expect(uploads.get(record.id)).toMatchObject({
      kind: 'create',
      targetDishId: 'dish',
      approvedDishId: 'dish',
      changedFields: ['description'],
    });
    expect(prisma.dish.create).not.toHaveBeenCalled();
  });

  it('does not automatically merge matching names', async () => {
    const { create, review, prisma } = fixture();
    const record = await create();
    await review.approveUpload(record.id, admin, { revision: 1 });
    expect(prisma.dish.create).toHaveBeenCalledTimes(1);
  });

  it('checks ownership and optimistic revision for user edits and withdrawal', async () => {
    const { create, users, review, uploads } = fixture();
    const record = await create();
    await expect(users.getMyUpload('another', record.id)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      users.updateMyUpload('another', record.id, {
        ...base,
        revision: 1,
      } as any),
    ).rejects.toThrow(NotFoundException);
    await review.rejectUpload(record.id, '  请核对价格  ', admin, 1);
    expect(uploads.get(record.id).rejectReason).toBe('请核对价格');
    await expect(
      users.updateMyUpload('author', record.id, {
        ...base,
        revision: 1,
      } as any),
    ).rejects.toThrow(ConflictException);
    await users.updateMyUpload('author', record.id, {
      ...base,
      price: 0,
      revision: 2,
    } as any);
    expect(uploads.get(record.id)).toMatchObject({
      price: 0,
      revision: 3,
      status: 'pending',
      rejectReason: null,
    });
    await users.withdrawMyUpload('author', record.id, 3);
    expect(uploads.get(record.id)).toMatchObject({
      revision: 4,
      status: 'withdrawn',
    });
    await expect(
      review.approveUpload(record.id, admin, { revision: 4 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resubmits a correction with the current target baseline after rejection', async () => {
    const { correct, review, users, dishes, uploads } = fixture();
    const record = await correct();
    await review.rejectUpload(record.id, '核对', admin, 1);
    dishes.get('dish').price = 15;
    await users.updateMyUpload('author', record.id, {
      ...base,
      targetDishId: 'dish',
      changedFields: ['price'],
      price: 16,
      revision: 2,
    } as any);
    expect(uploads.get(record.id).baseSnapshot.price).toBe(15);
    await review.approveUpload(record.id, admin, { revision: 3 });
    expect(dishes.get('dish').price).toBe(16);
  });

  it('rejects review edits outside canteen scope', async () => {
    const { create, review } = fixture();
    const record = await create();
    await expect(
      review.editUpload(
        record.id,
        { revision: 1, price: 0 },
        { ...admin, scope: 'CANTEENS' as const, canteenIds: ['other'] },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('derives authoritative window and floor information when a reviewer adds a field', async () => {
    const { correct, review, dishes, uploads } = fixture();
    const record = await correct();
    await review.editUpload(
      record.id,
      { revision: 1, windowId: 'window' },
      admin,
    );
    expect(uploads.get(record.id).changedFields).toEqual(
      expect.arrayContaining([
        'price',
        'windowId',
        'windowName',
        'windowNumber',
      ]),
    );
    await review.approveUpload(record.id, admin, { revision: 2 });
    expect(dishes.get('dish')).toMatchObject({
      windowId: 'window',
      windowName: '新窗口',
      floorId: 'floor',
      floorName: '一楼',
    });
  });
});
