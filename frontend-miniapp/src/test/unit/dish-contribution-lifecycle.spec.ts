import { effectScope, reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useAddDish } from '@/pages/add-dish/composables/use-add-dish';
import { getDishById, uploadDish } from '@/api/modules/dish';
import { getMyUpload, updateMyUpload } from '@/api/modules/user';
import { getCanteenList } from '@/api/modules/canteen';
import { uploadImage } from '@/api/modules/upload';

const mockUser = reactive({
  sessionVersion: 1,
  isLoggedIn: true,
  userInfo: { id: 'A', capabilities: { canContribute: true } },
});
jest.mock('@/store/modules/use-user-store', () => ({ useUserStore: () => mockUser }));
jest.mock('@/api/modules/dish', () => ({ getDishById: jest.fn(), uploadDish: jest.fn() }));
jest.mock('@/api/modules/user', () => ({ getMyUpload: jest.fn(), updateMyUpload: jest.fn() }));
jest.mock('@/api/modules/canteen', () => ({ getCanteenList: jest.fn() }));
jest.mock('@/api/modules/upload', () => ({ uploadImage: jest.fn() }));

const storage = new Map<string, any>();
const scopes: ReturnType<typeof effectScope>[] = [];
const fileSystem = { saveFile: jest.fn(), removeSavedFile: jest.fn() };
const uniMock = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: jest.fn((key, value) => storage.set(key, JSON.parse(JSON.stringify(value)))),
  removeStorageSync: (key: string) => storage.delete(key),
  getFileSystemManager: () => fileSystem,
  getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn(),
  chooseImage: jest.fn(),
  setNavigationBarTitle: jest.fn(),
};
const target = {
  id: 'dish',
  name: '面条',
  price: 12,
  priceUnit: '碗',
  canteenId: 'c',
  canteenName: '食堂',
  windowId: 'w',
  windowName: '面食',
  windowNumber: '1',
  floorLevel: '2',
  availableMealTime: ['lunch'],
  images: ['https://cdn.test/existing.jpg'],
  ingredients: ['面粉'],
  tags: ['面食'],
  allergens: ['小麦'],
  status: 'online',
  updatedAt: '2026-10-11T01:00:00Z',
};
const state = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useAddDish())!;
};
const valid = (form: ReturnType<typeof useAddDish>) =>
  Object.assign(form.formData, {
    name: '菜',
    price: 0,
    canteenId: 'c',
    canteenName: '食堂',
    availableMealTime: ['lunch'],
  });
const pick = (form: ReturnType<typeof useAddDish>, paths: string[]) => {
  uniMock.chooseImage.mockImplementation(({ success }) => success({ tempFilePaths: paths }));
  form.chooseImages();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  storage.clear();
  Object.assign(mockUser, {
    sessionVersion: 1,
    isLoggedIn: true,
    userInfo: { id: 'A', capabilities: { canContribute: true } },
  });
  (global as any).uni = uniMock;
  fileSystem.saveFile.mockImplementation(({ tempFilePath, success }) =>
    success({ savedFilePath: '/saved/' + tempFilePath.split('/').pop() })
  );
  (getCanteenList as jest.Mock).mockResolvedValue({
    code: 200,
    data: { items: [{ id: 'c', name: '食堂', windows: [] }] },
  });
  (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: target });
  (uploadDish as jest.Mock).mockResolvedValue({
    code: 201,
    data: { id: 'upload', status: 'pending', revision: 1 },
  });
});
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('requires student access before initialization and before any image or submission work', async () => {
  mockUser.userInfo.capabilities.canContribute = false;
  const form = state();
  valid(form);
  expect(await form.initialize()).toBe(false);
  pick(form, ['/tmp/photo.jpg']);
  expect(await form.submitForm()).toBe(false);
  expect(getCanteenList).not.toHaveBeenCalled();
  expect(uniMock.chooseImage).not.toHaveBeenCalled();
  expect(uploadImage).not.toHaveBeenCalled();
  expect(uploadDish).not.toHaveBeenCalled();
});

test('blank price is invalid while an explicit zero is accepted', async () => {
  const form = state();
  expect(form.formData.price).toBe('');
  valid(form);
  form.formData.price = '';
  expect(await form.submitForm()).toBe(false);
  expect(form.fieldErrors.value.price).toBeTruthy();
  form.formData.price = 0;
  expect(await form.submitForm()).toBe(true);
});

test('prefills a target and submits only changed fields with the original target version', async () => {
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  expect(form.formData).toMatchObject({
    name: '面条',
    price: 12,
    priceUnit: '碗',
    ingredients: ['面粉'],
  });
  form.selectCanteen({ id: 'other', name: '另一食堂', windows: [] } as any);
  expect(form.formData.canteenId).toBe('c');
  form.formData.price = 13;
  expect(await form.submitForm()).toBe(true);
  expect(uploadImage).not.toHaveBeenCalled();
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({
      targetDishId: 'dish',
      targetDishUpdatedAt: target.updatedAt,
      changedFields: ['price'],
      price: 13,
      ingredients: ['面粉'],
    })
  );
});

test('retains successful image uploads after a partial failure and reuses the request key', async () => {
  const form = state();
  valid(form);
  pick(form, ['/tmp/one.jpg', '/tmp/two.jpg']);
  (uploadImage as jest.Mock)
    .mockResolvedValueOnce({ url: 'https://cdn.test/one.jpg' })
    .mockRejectedValueOnce(new Error('offline'));
  expect(await form.submitForm()).toBe(false);
  const key = form.clientRequestId.value;
  (uploadImage as jest.Mock).mockResolvedValue({ url: 'https://cdn.test/two.jpg' });
  expect(await form.submitForm()).toBe(true);
  expect(uploadImage).toHaveBeenCalledTimes(3);
  expect(uploadImage).toHaveBeenLastCalledWith(expect.stringContaining('two.jpg'), {
    purpose: 'dish-contribution',
  });
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({
      clientRequestId: key,
      images: ['https://cdn.test/one.jpg', 'https://cdn.test/two.jpg'],
    })
  );
});

test('a lost success response persists the exact request across page recreation', async () => {
  const form = state();
  valid(form);
  (uploadDish as jest.Mock).mockRejectedValueOnce(new Error('network timeout'));
  expect(await form.submitForm()).toBe(false);
  const sent = (uploadDish as jest.Mock).mock.calls[0][0];
  scopes.splice(0).forEach(scope => scope.stop());
  const restored = state();
  await restored.initialize();
  expect(restored.awaitingConfirmation.value).toBe(true);
  expect(await restored.submitForm()).toBe(true);
  expect((uploadDish as jest.Mock).mock.calls[1][0]).toEqual(sent);
});

test('drafts are isolated by owner and target and restore saved local files', async () => {
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  form.formData.description = '补全介绍';
  pick(form, ['/tmp/photo.jpg']);
  expect(await form.saveDraft()).toBe(true);
  const same = state();
  await same.initialize({ targetDishId: 'dish' });
  expect(same.formData.description).toBe('补全介绍');
  expect(same.formData.images).toContain('/saved/photo.jpg');
  const different = state();
  await different.initialize();
  expect(different.formData.description).toBe('');
  mockUser.userInfo = { id: 'B', capabilities: { canContribute: true } };
  mockUser.sessionVersion++;
  const other = state();
  await other.initialize({ targetDishId: 'dish' });
  expect(other.formData.description).toBe('');
});

test('editing a rejected contribution uses its revision and never creates a second upload', async () => {
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      ...target,
      id: 'upload',
      kind: 'create',
      revision: 4,
      status: 'rejected',
      rejectReason: '请核实价格',
    },
  });
  (updateMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { id: 'upload', revision: 5, status: 'pending' },
  });
  const form = state();
  await form.initialize({ uploadId: 'upload' });
  form.formData.price = 10;
  expect(await form.submitForm()).toBe(true);
  expect(updateMyUpload).toHaveBeenCalledWith(
    'upload',
    expect.objectContaining({ price: 10, revision: 4 })
  );
  expect(uploadDish).not.toHaveBeenCalled();
});

test('storage failure is visible and never claims a draft was saved', async () => {
  const form = state();
  valid(form);
  uniMock.setStorageSync.mockImplementationOnce(() => {
    throw new Error('QuotaExceededError');
  });
  expect(await form.saveDraft()).toBe(false);
  expect(form.draftError.value).toBeTruthy();
  expect(form.formData.name).toBe('菜');
});

test('expired uploaded URLs are cleared while saved originals remain available for retry', async () => {
  const form = state();
  valid(form);
  pick(form, ['/tmp/photo.jpg']);
  (uploadImage as jest.Mock)
    .mockResolvedValueOnce({ url: 'https://cdn.test/expired.jpg' })
    .mockResolvedValueOnce({ url: 'https://cdn.test/fresh.jpg' });
  (uploadDish as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('expired'), { statusCode: 410, code: 'IMAGE_EXPIRED' })
  );
  expect(await form.submitForm()).toBe(false);
  expect(form.awaitingConfirmation.value).toBe(false);
  expect(form.error.value).toContain('重新上传');
  expect(await form.submitForm()).toBe(true);
  expect(uploadImage).toHaveBeenCalledTimes(2);
  expect(uploadImage).toHaveBeenLastCalledWith('/saved/photo.jpg', {
    purpose: 'dish-contribution',
  });
  expect((uploadDish as jest.Mock).mock.calls[1][0].images).toEqual(['https://cdn.test/fresh.jpg']);
});

test('an old session cannot publish or save upload completion into the next account', async () => {
  let resolve!: (value: unknown) => void;
  (uploadImage as jest.Mock).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const form = state();
  valid(form);
  pick(form, ['/tmp/A.jpg']);
  const pending = form.submitForm();
  await flushPromises();
  mockUser.userInfo = { id: 'B', capabilities: { canContribute: true } };
  mockUser.sessionVersion++;
  resolve({ url: 'https://cdn.test/A.jpg' });
  await pending;
  expect(uploadDish).not.toHaveBeenCalled();
  expect(form.formData.name).toBe('');
  expect([...storage.keys()].some(key => key.startsWith('dish_contribution:B:'))).toBe(false);
});

test('a definitive validation error unlocks edits without losing draft fields', async () => {
  const form = state();
  valid(form);
  (uploadDish as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('请核实食堂'), { statusCode: 400, code: 'INVALID_CANTEEN' })
  );
  expect(await form.submitForm()).toBe(false);
  expect(form.awaitingConfirmation.value).toBe(false);
  expect(form.formLocked.value).toBe(false);
  expect(form.formData.name).toBe('菜');
});

test('an identity change clears optional server fields as well as visible inputs', async () => {
  (getDishById as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      ...target,
      spicyLevel: 3,
      availableDates: [{ startDate: '2026-10-01', endDate: '2026-10-31' }],
    },
  });
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  expect(form.formData.spicyLevel).toBe(3);
  mockUser.sessionVersion++;
  expect(form.formData.spicyLevel).toBeUndefined();
  expect(form.formData.availableDates).toBeUndefined();
});

test('a lost edit response confirms the saved revision instead of posting it twice', async () => {
  const original = { ...target, id: 'upload', kind: 'create', revision: 4, status: 'rejected' };
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: original });
  (updateMyUpload as jest.Mock).mockRejectedValueOnce(new Error('network timeout'));
  const form = state();
  await form.initialize({ uploadId: 'upload' });
  form.formData.price = 10;
  expect(await form.submitForm()).toBe(false);
  const payload = (updateMyUpload as jest.Mock).mock.calls[0][1];
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      ...payload,
      id: 'upload',
      revision: 5,
      status: 'pending',
      spicyLevel: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
    },
  });
  expect(await form.submitForm()).toBe(true);
  expect(updateMyUpload).toHaveBeenCalledTimes(1);
});

test('two immediate submit activations share a single in-flight command', async () => {
  let resolve!: (value: unknown) => void;
  (uploadDish as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const form = state();
  valid(form);
  const first = form.submitForm();
  const second = form.submitForm();
  await flushPromises();
  expect(uploadDish).toHaveBeenCalledTimes(1);
  resolve({ code: 201, data: { id: 'upload', status: 'pending', revision: 1 } });
  expect(await first).toBe(true);
  expect(await second).toBe(false);
});

test('corrections keep published images while allowing removal of new selections', async () => {
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  form.removeImage(0);
  expect(form.formData.images).toEqual(target.images);
  pick(form, ['/tmp/extra.jpg']);
  form.removeImage(1);
  expect(form.formData.images).toEqual(target.images);
});

test('a target conflict preserves edits until an explicit draft discard loads the current baseline', async () => {
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  form.formData.price = 15;
  const updated = { ...target, price: 13, updatedAt: '2026-10-11T02:00:00Z' };
  (getDishById as jest.Mock).mockResolvedValue({ code: 200, data: updated });
  (uploadDish as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('菜品资料已更新，请刷新后补全'), { statusCode: 409 })
  );
  expect(await form.submitForm()).toBe(false);
  expect(form.conflict.value).toBe('target');
  expect(form.formData.price).toBe(15);
  expect(form.canDiscardDraft.value).toBe(true);
  expect(await form.submitForm()).toBe(false);
  expect(uploadDish).toHaveBeenCalledTimes(1);

  scopes.splice(0).forEach(scope => scope.stop());
  const restored = state();
  await restored.initialize({ targetDishId: 'dish' });
  expect(restored.conflict.value).toBe('target');
  expect(restored.formData.price).toBe(15);
  expect(restored.canDiscardDraft.value).toBe(true);
  expect(restored.clearDraft()).toBe(true);
  expect(await restored.initialize()).toBe(true);
  expect(restored.conflict.value).toBe('');
  expect(restored.formData.price).toBe(13);
  restored.formData.description = '核实后的介绍';
  expect(await restored.submitForm()).toBe(true);
  expect((uploadDish as jest.Mock).mock.calls[1][0]).toMatchObject({
    targetDishUpdatedAt: updated.updatedAt,
    price: 13,
    changedFields: ['description'],
  });
});

test('an existing upload revision conflict reloads that upload without creating a new contribution', async () => {
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...target, id: 'upload', kind: 'create', revision: 4, status: 'pending' },
  });
  const form = state();
  await form.initialize({ uploadId: 'upload' });
  form.formData.price = 15;
  (updateMyUpload as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('资料已更新'), { statusCode: 409 })
  );
  expect(await form.submitForm()).toBe(false);
  expect(form.conflict.value).toBe('upload');
  expect(form.canDiscardDraft.value).toBe(true);
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...target, id: 'upload', kind: 'create', revision: 5, status: 'approved' },
  });
  form.clearDraft();
  await form.initialize();
  expect(form.readOnly.value).toBe(true);
  expect(form.uploadId.value).toBe('upload');
  expect(uploadDish).not.toHaveBeenCalled();
});

test.each([{ targetDishId: 'dish' }, { uploadId: 'upload' }])(
  'access-gated initialization retains its route for later authentication: %p',
  async options => {
    mockUser.userInfo.capabilities.canContribute = false;
    const form = state();
    expect(await form.initialize(options)).toBe(false);
    expect(getDishById).not.toHaveBeenCalled();
    expect(getMyUpload).not.toHaveBeenCalled();
    mockUser.userInfo.capabilities.canContribute = true;
    (getMyUpload as jest.Mock).mockResolvedValue({
      code: 200,
      data: { ...target, id: 'upload', kind: 'create', revision: 1, status: 'pending' },
    });
    expect(await form.initialize()).toBe(true);
    if ('targetDishId' in options) expect(getDishById).toHaveBeenCalledWith('dish');
    else expect(getMyUpload).toHaveBeenCalledWith('upload');
    expect(form.formData.name).toBe('面条');
  }
);

const managedImage = 'https://api.example.test/content-moderation/images/asset_identity_123456';
const oldPreview = managedImage + '?expires=1000&signature=old';
const freshPreview = managedImage + '?expires=2000&signature=fresh';
const managedUpload = () => ({
  ...target,
  id: 'upload',
  kind: 'update',
  revision: 1,
  status: 'pending',
  targetDishId: 'dish',
  images: [oldPreview],
  baseSnapshot: { ...target, images: [managedImage] },
  targetDish: { ...target, images: [managedImage] },
});

test('recognizes target images across refreshed signatures and submits only text changes', async () => {
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: managedUpload() });
  (updateMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { id: 'upload', revision: 2, status: 'pending' },
  });
  const form = state();
  await form.initialize({ uploadId: 'upload' });
  expect(form.isExistingImage(oldPreview)).toBe(true);
  form.removeImage(0);
  expect(form.formData.images).toEqual([oldPreview]);
  form.formData.description = '只改文字';
  expect(await form.submitForm()).toBe(true);
  expect((updateMyUpload as jest.Mock).mock.calls[0][1].changedFields).toEqual(['description']);
});

test.each([false, true])(
  'confirms a saved update by image identity while preserving order changes: reordered=%s',
  async reordered => {
    const another = 'https://api.example.test/content-moderation/images/another_asset_123456';
    const original = {
      ...target,
      id: 'upload',
      kind: 'create',
      revision: 4,
      status: 'rejected',
      images: [oldPreview, another],
    };
    (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: original });
    (updateMyUpload as jest.Mock).mockRejectedValueOnce(new Error('network timeout'));
    const form = state();
    await form.initialize({ uploadId: 'upload' });
    form.formData.price = 10;
    expect(await form.submitForm()).toBe(false);
    const payload = (updateMyUpload as jest.Mock).mock.calls[0][1];
    (getMyUpload as jest.Mock).mockResolvedValue({
      code: 200,
      data: {
        ...payload,
        id: 'upload',
        revision: 5,
        status: 'pending',
        images: reordered ? [another, freshPreview] : [freshPreview, another],
      },
    });
    expect(await form.submitForm()).toBe(!reordered);
    expect(updateMyUpload).toHaveBeenCalledTimes(1);
    if (reordered) expect(form.conflict.value).toBe('upload');
  }
);

test('restores text drafts with the current authorized remote image preview', async () => {
  (getMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: managedUpload() });
  const first = state();
  await first.initialize({ uploadId: 'upload' });
  first.formData.description = '保存的文字';
  expect(await first.saveDraft()).toBe(true);
  scopes.splice(0).forEach(scope => scope.stop());
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...managedUpload(), images: [freshPreview] },
  });
  const restored = state();
  await restored.initialize({ uploadId: 'upload' });
  expect(restored.formData.description).toBe('保存的文字');
  expect(restored.formData.images).toEqual([freshPreview]);
});

test('normalizes optional nutrition, preserves zero, and rejects nonfinite or negative input', async () => {
  const form = state();
  await form.initialize();
  valid(form);
  for (const value of [-1, 'Infinity', 'NaN']) {
    form.formData.calories = value;
    expect(await form.submitForm()).toBe(false);
    expect(form.fieldErrors.value.calories).toBeTruthy();
  }
  Object.assign(form.formData, { calories: '0', protein: '12.5', carbohydrate: '', fat: ' ' });
  expect(await form.submitForm()).toBe(true);
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({ calories: 0, protein: 12.5, carbohydrate: null, fat: null })
  );
});

test('uses changedFields for nutrition clearing and preserves untouched nutrition during target editing', async () => {
  (getDishById as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...target, calories: 200, protein: 0, carbohydrate: 30, fat: null },
  });
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  expect(form.formData).toMatchObject({ calories: 200, protein: 0, carbohydrate: 30, fat: '' });
  form.formData.calories = '';
  form.formData.carbohydrate = '30';
  expect(await form.submitForm()).toBe(true);
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({
      changedFields: ['calories'],
      calories: null,
      protein: 0,
      carbohydrate: 30,
    })
  );
});

test('restores nutrition in a rejected upload and resubmits the same record with its revision', async () => {
  (getMyUpload as jest.Mock).mockResolvedValue({
    code: 200,
    data: {
      ...target,
      id: 'upload',
      status: 'rejected',
      revision: 7,
      calories: 0,
      protein: 16.5,
      carbohydrate: null,
      fat: 4,
      rejectReason: '核对分量',
    },
  });
  (updateMyUpload as jest.Mock).mockResolvedValue({ code: 200, data: { id: 'upload' } });
  const form = state();
  await form.initialize({ uploadId: 'upload' });
  expect(form.formData.calories).toBe(0);
  form.formData.protein = '18.5';
  expect(await form.submitForm()).toBe(true);
  expect(updateMyUpload).toHaveBeenCalledWith(
    'upload',
    expect.objectContaining({ revision: 7, calories: 0, protein: 18.5, carbohydrate: null, fat: 4 })
  );
});

test('uses complete normalized allergen terms for selection and submission', async () => {
  const form = state();
  await form.initialize();
  valid(form);
  form.customAllergenInput.value = '  Pine\t Nuts  ';
  form.addCustomAllergen();
  form.customAllergenInput.value = 'PINE\u3000NUTS';
  form.addCustomAllergen();
  expect(form.formData.allergens).toEqual(['Pine Nuts']);
  expect(form.isAllergenSelected('pine\u00A0nuts')).toBe(true);
  expect(form.isAllergenSelected('Pine nutshell')).toBe(false);
  form.toggleAllergen('PINE  NUTS');
  expect(form.formData.allergens).toEqual([]);
  form.formData.allergens = [' Private\t\nphrase ', 'PRIVATE  PHRASE', 'Private phrase extra'];
  expect(await form.submitForm()).toBe(true);
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({ allergens: ['Private phrase', 'Private phrase extra'] })
  );
});

test('compares existing allergen terms with the same normalization when choosing contribution fields', async () => {
  (getDishById as jest.Mock).mockResolvedValue({
    code: 200,
    data: { ...target, allergens: [' Pine\tNuts '] },
  });
  const form = state();
  await form.initialize({ targetDishId: 'dish' });
  form.formData.allergens = ['PINE  NUTS', 'pine nuts'];
  form.formData.price = 13;
  expect(await form.submitForm()).toBe(true);
  expect(uploadDish).toHaveBeenCalledWith(
    expect.objectContaining({ changedFields: ['price'], allergens: ['PINE NUTS'] })
  );
});
