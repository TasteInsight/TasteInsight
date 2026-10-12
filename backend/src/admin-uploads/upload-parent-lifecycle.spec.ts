import { BadRequestException } from '@nestjs/common';
import { AdminUploadsService } from './admin-uploads.service';
import { AdminDishesService } from '@/admin-dishes/admin-dishes.service';
import { DishStatus } from '@/admin-dishes/dto/admin-dish.dto';

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
          status: 'online',
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
        kind: 'create',
        targetDishId: null,
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
      notificationCampaign: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
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
              Object.assign(row, {
                ...data,
                ...(data.revision
                  ? { revision: (row.revision ?? 1) + data.revision.increment }
                  : {}),
              });
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
        update: async ({ where, data }: any) => {
          Object.assign(dishes.get(where.id), data);
          return { ...dishes.get(where.id) };
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
      $executeRaw: async () => 0,
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
    expect(state.uploads.get('parent-upload').approvedDishId).toBe(
      'parent-dish',
    );
  });

  it.each([false, true])(
    'preserves the current formal parent relation on reapproval (old parent now child: %s)',
    async (reverseParent) => {
      const state = fixture();
      const uploadId = await state.createChild();
      await state.review.approveUpload(uploadId, admin, { revision: 1 });
      const childDishId = state.uploads.get(uploadId).approvedDishId;
      await state.review.revokeUpload(uploadId, admin, 2);
      expect(state.uploads.get(uploadId).approvedSnapshot.parentDishId).toBe(
        'parent-dish',
      );
      await state.manage.updateAdminDish(
        childDishId,
        { parentDishId: null },
        admin,
      );
      if (reverseParent) {
        await state.manage.updateAdminDish(
          'parent-dish',
          { parentDishId: childDishId },
          admin,
        );
      }

      await state.review.approveUpload(uploadId, admin, { revision: 3 });
      expect(state.uploads.get(uploadId)).toMatchObject({
        status: 'approved',
        revision: 4,
        approvedDishId: childDishId,
      });
      expect(state.dishes.get(childDishId)).toMatchObject({
        parentDishId: null,
        status: 'online',
      });
      expect(state.dishes.get('parent-dish').parentDishId).toBe(
        reverseParent ? childDishId : null,
      );
    },
  );

  it('does not revive an obsolete parent relation changed before revocation', async () => {
    const state = fixture();
    const uploadId = await state.createChild();
    await state.review.approveUpload(uploadId, admin, { revision: 1 });
    const childDishId = state.uploads.get(uploadId).approvedDishId;
    await state.manage.updateAdminDish(
      childDishId,
      { parentDishId: null },
      admin,
    );
    await state.manage.updateAdminDish(
      'parent-dish',
      { parentDishId: childDishId, status: DishStatus.OFFLINE },
      admin,
    );
    await state.review.revokeUpload(uploadId, admin, 2);
    expect(state.uploads.get(uploadId)).toMatchObject({
      parentDishId: 'parent-dish',
      approvedSnapshot: { parentDishId: null },
    });
    await state.manage.updateDishStatus(
      'parent-dish',
      DishStatus.ONLINE,
      admin,
    );

    await state.review.approveUpload(uploadId, admin, { revision: 3 });
    expect(state.uploads.get(uploadId)).toMatchObject({
      approvedDishId: childDishId,
      status: 'approved',
      revision: 4,
    });
    expect(state.dishes.get(childDishId)).toMatchObject({
      parentDishId: null,
      status: 'online',
    });
    expect(state.dishes.get('parent-dish').parentDishId).toBe(childDishId);
  });

  it('does not require an obsolete parent to be online when restoring a detached dish', async () => {
    const state = fixture();
    const uploadId = await state.createChild();
    await state.review.approveUpload(uploadId, admin, { revision: 1 });
    const childDishId = state.uploads.get(uploadId).approvedDishId;
    await state.review.revokeUpload(uploadId, admin, 2);
    await state.manage.updateAdminDish(
      childDishId,
      { parentDishId: null },
      admin,
    );
    await state.manage.updateDishStatus(
      'parent-dish',
      DishStatus.OFFLINE,
      admin,
    );

    await state.review.approveUpload(uploadId, admin, { revision: 3 });
    expect(state.dishes.get(childDishId)).toMatchObject({
      parentDishId: null,
      status: 'online',
    });
  });

  it('validates the current formal parent before restoring a reparented dish', async () => {
    const state = fixture();
    const uploadId = await state.createChild();
    await state.review.approveUpload(uploadId, admin, { revision: 1 });
    const childDishId = state.uploads.get(uploadId).approvedDishId;
    await state.review.revokeUpload(uploadId, admin, 2);
    state.dishes.set('current-parent', {
      id: 'current-parent',
      canteenId: 'canteen',
      parentDishId: null,
      status: 'offline',
    });
    await state.manage.updateAdminDish(
      childDishId,
      { parentDishId: 'current-parent' },
      admin,
    );

    await expect(
      state.review.approveUpload(uploadId, admin, { revision: 3 }),
    ).rejects.toThrow('父菜品不存在或未上架');
    expect(state.uploads.get(uploadId).status).toBe('pending');
    expect(state.dishes.get(childDishId)).toMatchObject({
      parentDishId: 'current-parent',
      status: 'offline',
    });
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
    expect(state.uploads.get('parent-upload').approvedDishId).toBe(
      'parent-dish',
    );
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

  it('never uses an accepted correction as the creation source when preserving child references', async () => {
    const state = fixture();
    const childId = await state.createChild();
    const source = state.uploads.get('parent-upload');
    state.uploads.delete('parent-upload');
    state.uploads.set('earlier-correction', {
      id: 'earlier-correction',
      kind: 'update',
      targetDishId: 'parent-dish',
      approvedDishId: 'parent-dish',
      status: 'approved',
      canteenId: 'canteen',
    });
    state.uploads.set('parent-upload', source);
    await state.manage.deleteAdminDish('parent-dish', admin);
    expect(state.uploads.get(childId).parentUploadId).toBe('parent-upload');
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
