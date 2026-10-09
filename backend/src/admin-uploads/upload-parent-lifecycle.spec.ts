import { BadRequestException } from '@nestjs/common';
import { AdminUploadsService } from './admin-uploads.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';

describe('Upload parent identity across lifecycle transitions', () => {
  const admin = {
    id: 'admin',
    username: 'admin',
    role: 'superadmin',
    canteenId: null,
    permissions: [],
  };
  const location = {
    id: 'window',
    canteenId: 'canteen',
    name: '窗口',
    number: '1',
    floor: null,
    canteen: { id: 'canteen', name: '食堂' },
  };

  const fixture = (hasSource = true) => {
    const uploads = new Map<string, any>();
    const dishes = new Map<string, any>([
      [
        'parent-dish',
        {
          id: 'parent-dish',
          name: '父菜品',
          canteenId: 'canteen',
          parentDishId: null,
        },
      ],
    ]);
    let nextUpload = 1;
    let nextDish = 1;
    if (hasSource)
      uploads.set('parent-upload', {
        id: 'parent-upload',
        name: '父菜品',
        price: 10,
        priceUnit: null,
        description: '',
        tags: [],
        ingredients: [],
        allergens: [],
        images: [],
        spicyLevel: 0,
        sweetness: 0,
        saltiness: 0,
        oiliness: 0,
        availableMealTime: ['lunch'],
        availableDates: null,
        adminId: admin.id,
        canteenId: 'canteen',
        canteenName: '食堂',
        windowId: location.id,
        windowNumber: '1',
        windowName: '窗口',
        status: 'approved',
        approvedDishId: 'parent-dish',
        parentDishId: null,
        parentUploadId: null,
      });
    const matches = (row: any, where: any) =>
      Object.entries(where).every(([key, value]) =>
        value && typeof value === 'object' && 'not' in value
          ? row[key] !== value.not
          : row[key] === value,
      );
    const readUpload = (id: string) => {
      const row = uploads.get(id);
      return row
        ? { ...row, window: location, canteen: location.canteen }
        : null;
    };
    const database: any = {
      window: { findUnique: async () => location },
      dishUpload: {
        findUnique: async ({ where }: any) => readUpload(where.id),
        findFirst: async ({ where }: any) => {
          const row = [...uploads.values()].find((value) =>
            matches(value, where),
          );
          return row ? { ...row } : null;
        },
        create: async ({ data }: any) => {
          const id = `upload-${nextUpload++}`;
          const defined = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          );
          uploads.set(id, {
            id,
            parentDishId: null,
            parentUploadId: null,
            approvedDishId: null,
            ...defined,
          });
          return readUpload(id);
        },
        update: async ({ where, data }: any) => {
          Object.assign(uploads.get(where.id), data);
          return readUpload(where.id);
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const row of uploads.values())
            if (matches(row, where)) {
              Object.assign(row, data);
              count++;
            }
          return { count };
        },
      },
      dish: {
        findUnique: async ({ where }: any) => {
          const row = dishes.get(where.id);
          return row
            ? {
                ...row,
                subDishes: [...dishes.values()].filter(
                  (value) => value.parentDishId === where.id,
                ),
              }
            : null;
        },
        findFirst: async ({ where }: any) => {
          const row = [...dishes.values()].find((value) =>
            matches(value, where),
          );
          return row ? { ...row } : null;
        },
        create: async ({ data }: any) => {
          const id = `dish-${nextDish++}`;
          dishes.set(id, { id, ...data });
          return { id, ...data };
        },
        delete: async ({ where }: any) => {
          dishes.delete(where.id);
          // Model the persisted nullable foreign keys' ON DELETE SET NULL behavior.
          for (const row of uploads.values())
            if (row.parentDishId === where.id) row.parentDishId = null;
          for (const row of dishes.values())
            if (row.parentDishId === where.id) row.parentDishId = null;
        },
      },
      $queryRaw: async () => [],
      $transaction: async (callback: any) => {
        const savedUploads = new Map(
          [...uploads].map(([id, value]) => [id, { ...value }]),
        );
        const savedDishes = new Map(
          [...dishes].map(([id, value]) => [id, { ...value }]),
        );
        try {
          return await callback(database);
        } catch (error) {
          uploads.clear();
          savedUploads.forEach((value, id) => uploads.set(id, value));
          dishes.clear();
          savedDishes.forEach((value, id) => dishes.set(id, value));
          throw error;
        }
      },
    };
    const review = new AdminUploadsService(database);
    const manage = new AdminDishesService(database);
    const createChild = async () =>
      (
        await manage.createAdminDish(
          {
            name: '子菜品',
            price: 5,
            windowId: location.id,
            parentDishId: 'parent-dish',
          },
          admin,
        )
      ).data.id;
    const restoreAndApprove = async (childId: string) => {
      await review.revokeUpload(childId, admin);
      await expect(review.approveUpload(childId, admin)).rejects.toThrow(
        BadRequestException,
      );
      await review.revokeUpload('parent-upload', admin);
      await review.approveUpload('parent-upload', admin);
      await review.approveUpload(childId, admin);
      const parentDishId = uploads.get('parent-upload').approvedDishId;
      expect(dishes.get(uploads.get(childId).approvedDishId).parentDishId).toBe(
        parentDishId,
      );
      expect(parentDishId).not.toBe('parent-dish');
    };
    return { uploads, dishes, review, manage, createChild, restoreAndApprove };
  };

  it('retains rejected child identity through rejection, parent revoke and resubmission', async () => {
    const state = fixture();
    const childId = await state.createChild();
    await state.review.rejectUpload(childId, '退回审核', admin);
    await state.review.revokeUpload('parent-upload', admin);
    expect(state.uploads.get(childId)).toMatchObject({
      status: 'rejected',
      parentDishId: null,
      parentUploadId: 'parent-upload',
    });
    await state.restoreAndApprove(childId);
  });

  it('retains approved child history after deleting its dish and revoking the parent', async () => {
    const state = fixture();
    const childId = await state.createChild();
    await state.review.approveUpload(childId, admin);
    await state.manage.deleteAdminDish(
      state.uploads.get(childId).approvedDishId,
      admin,
    );
    await state.review.revokeUpload('parent-upload', admin);
    expect(state.uploads.get(childId)).toMatchObject({
      status: 'approved',
      approvedDishId: null,
      parentDishId: null,
      parentUploadId: 'parent-upload',
    });
    await state.restoreAndApprove(childId);
  });

  it('preserves every child upload when deleting a dish with a source approval', async () => {
    const state = fixture();
    const rejected = await state.createChild();
    await state.review.rejectUpload(rejected, '退回审核', admin);
    const pending = await state.createChild();
    await state.manage.deleteAdminDish('parent-dish', admin);
    expect(state.uploads.get('parent-upload')).toMatchObject({
      status: 'approved',
      approvedDishId: null,
    });
    for (const id of [rejected, pending])
      expect(state.uploads.get(id)).toMatchObject({
        parentDishId: null,
        parentUploadId: 'parent-upload',
      });
    await state.restoreAndApprove(rejected);
    await state.review.approveUpload(pending, admin);
    expect(
      state.dishes.get(state.uploads.get(pending).approvedDishId).parentDishId,
    ).toBe(state.uploads.get('parent-upload').approvedDishId);
  });

  it('keeps a source-less legacy parent while any child upload still references it', async () => {
    const state = fixture(false);
    const childId = await state.createChild();
    await state.review.rejectUpload(childId, '退回审核', admin);
    await expect(
      state.manage.deleteAdminDish('parent-dish', admin),
    ).rejects.toThrow(BadRequestException);
    expect(state.dishes.has('parent-dish')).toBe(true);
    expect(state.uploads.get(childId)).toMatchObject({
      status: 'rejected',
      parentDishId: 'parent-dish',
      parentUploadId: null,
    });
    expect(state.uploads.size).toBe(1);
  });

  it('still allows deleting a source-less dish without child references', async () => {
    const state = fixture(false);
    await state.manage.deleteAdminDish('parent-dish', admin);
    expect(state.dishes.has('parent-dish')).toBe(false);
    expect(state.uploads.size).toBe(0);
  });
});
