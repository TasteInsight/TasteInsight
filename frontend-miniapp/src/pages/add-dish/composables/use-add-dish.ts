import { allergenOptions, loadAllergenCatalog } from '@/utils/allergen-catalog';
import { t } from '@/i18n';
import { ref, reactive, computed, watch, getCurrentScope, onScopeDispose } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { getDishById, uploadDish } from '@/api/modules/dish';
import { getMyUpload, updateMyUpload } from '@/api/modules/user';
import { getCanteenList } from '@/api/modules/canteen';
import { uploadImage } from '@/api/modules/upload';
import { requireStudent } from '@/utils/student-access';
import { moderationImageIdentity as imageIdentity } from '@/utils/moderation-image';
import type {
  DishUserCreateRequest,
  DishContributionField,
  MyUploadDetail,
  Canteen,
  Window,
} from '@/types/api';
import {
  persistDraftImage,
  serializeDraftImage,
  restoreDraftImage,
  removeSavedDraftImages,
  type DraftImage,
} from './draft-images';

export const nutritionFields = [
  {
    key: 'calories',
    get label() {
      return t('food.caloriesKcal');
    },
  },
  {
    key: 'protein',
    get label() {
      return t('food.proteinG');
    },
  },
  {
    key: 'carbohydrate',
    get label() {
      return t('food.carbohydratesG');
    },
  },
  {
    key: 'fat',
    get label() {
      return t('food.fatG');
    },
  },
] as const;
type NutritionField = (typeof nutritionFields)[number]['key'];
const nutritionValue = (value: unknown): number | null =>
  value == null || String(value).trim() === '' ? null : Number(value);
type FormData = Omit<DishUserCreateRequest, 'price' | NutritionField> &
  Record<NutritionField, number | string | null> & {
    name: string;
    floor: string;
    price: number | string;
  };
type RouteOptions = { keyword?: string; targetDishId?: string; uploadId?: string };
type PendingSubmission = { payload: DishUserCreateRequest; revision: number; uploadId: string };
type SavedDraft = {
  version: 1;
  form: FormData;
  images: DraftImage[];
  clientRequestId: string;
  baseline: FormData | null;
  targetDishUpdatedAt?: string;
  revision: number;
  customTag: string;
  customAllergen: string;
  timestamp: number;
};
const fields: DishContributionField[] = [
  'name',
  'nameEn',
  'descriptionEn',
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
  ...nutritionFields.map(field => field.key),
  'windowId',
  'windowName',
  'windowNumber',
  'availableMealTime',
  'availableDates',
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const requestId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 3) | 8).toString(16);
  });
const blankForm = (): FormData => ({
  name: '',
  nameEn: '',
  descriptionEn: '',
  calories: '',
  protein: '',
  carbohydrate: '',
  fat: '',
  price: '',
  priceUnit: '',
  description: '',
  images: [],
  tags: [],
  ingredients: [],
  allergens: [],
  canteenId: '',
  canteenName: '',
  windowId: '',
  windowNumber: '',
  windowName: '',
  floor: '',
  availableMealTime: [],
  status: 'online',
});
const toForm = (value: any): FormData => {
  const form = blankForm();
  for (const field of [
    ...fields,
    'canteenId',
    'canteenName',
    'parentDishId',
    'subDishId',
  ] as const) {
    if (value[field] != null) (form as any)[field] = clone(value[field]);
  }
  form.floor = value.floorLevel || '';
  return form;
};

const equivalent = (left: unknown, right: unknown, field?: DishContributionField) => {
  if (Array.isArray(left) && Array.isArray(right)) {
    const comparable = (values: any[]) =>
      field === 'images' ? [...new Set(values.map(imageIdentity))] : [...values].sort();
    return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
  }
  return JSON.stringify(left ?? '') === JSON.stringify(right ?? '');
};

export function useAddDish() {
  const userStore = useUserStore();
  let disposed = false;
  let navigationTimer: ReturnType<typeof setTimeout> | null = null;
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let options: RouteOptions = {};
  let ready = false;
  let formBaseline: FormData | null = null;
  let targetDishUpdatedAt: string | undefined;
  const images = new Map<string, DraftImage>();
  const restoredBlobUrls = new Set<string>();
  const uncommittedFiles = new Set<string>();
  const formData = reactive<FormData>(blankForm());
  const clientRequestId = ref(requestId());
  const targetDishId = ref('');
  const uploadId = ref('');
  const revision = ref(0);
  const rejectionReason = ref('');
  const readOnly = ref(false);
  const conflict = ref<'' | 'target' | 'upload' | 'request'>('');
  const pending = ref<PendingSubmission | null>(null);
  const awaitingConfirmation = computed(() => !!pending.value);
  const customTagInput = ref('');
  const customAllergenInput = ref('');
  const customTags = ref<string[]>([]);
  const customAllergens = ref<string[]>([]);
  const canteenList = ref<Canteen[]>([]);
  const windowList = ref<Window[]>([]);
  const selectedCanteen = ref<Canteen | null>(null);
  const loading = ref(false);
  const initializing = ref(false);
  const initializationError = ref('');
  const submitting = ref(false);
  const submitted = ref(false);
  const savingDraft = ref(false);
  const draftSaved = ref(false);
  const draftRestored = ref(false);
  const draftError = ref('');
  const error = ref('');
  const canteenError = ref('');
  const validationAttempted = ref(false);
  const busy = computed(
    () => submitting.value || submitted.value || initializing.value || savingDraft.value
  );
  const formLocked = computed(
    () =>
      busy.value ||
      awaitingConfirmation.value ||
      readOnly.value ||
      !!conflict.value ||
      !!initializationError.value
  );
  const canDiscardDraft = computed(
    () => !busy.value && !awaitingConfirmation.value && conflict.value !== 'request'
  );
  const captureOperation = () => {
    const session = userStore.sessionVersion;
    const owner = userStore.userInfo?.id;
    return () =>
      !disposed && session === userStore.sessionVersion && owner === userStore.userInfo?.id;
  };
  const draftKey = () =>
    userStore.userInfo?.id
      ? `dish_contribution:${userStore.userInfo.id}:${options.uploadId ? 'upload:' + options.uploadId : options.targetDishId ? 'dish:' + options.targetDishId : 'create'}`
      : '';
  const submissionKey = () => `${draftKey()}:submission`;
  const cancelTimers = () => {
    if (navigationTimer !== null) clearTimeout(navigationTimer);
    if (draftTimer !== null) clearTimeout(draftTimer);
    navigationTimer = draftTimer = null;
  };
  const snapshot = () =>
    JSON.stringify({
      formData,
      customTag: customTagInput.value,
      customAllergen: customAllergenInput.value,
    });
  const baseline = ref(snapshot());
  const dirty = computed(() => !submitted.value && snapshot() !== baseline.value);
  const markPristine = () => {
    baseline.value = snapshot();
  };
  const validationErrors = computed(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t('food.enterADishName');
    if (formData.price === '' || String(formData.price).trim() === '')
      errors.price = t('food.enterADishPrice');
    else if (!Number.isFinite(Number(formData.price)) || Number(formData.price) < 0)
      errors.price = t('food.priceMustBeZeroOrMore');
    for (const { key, label } of nutritionFields) {
      const value = nutritionValue(formData[key]);
      if (value !== null && (!Number.isFinite(value) || value < 0))
        errors[key] = t('food.labelMustBeZeroOrMore', { label: label });
    }
    if (!formData.canteenName.trim()) errors.canteen = t('food.selectACanteen');
    if (!formData.availableMealTime.length)
      errors.availableMealTime = t('food.selectAtLeastOneMealTime');
    return errors;
  });
  const fieldErrors = computed(() => (validationAttempted.value ? validationErrors.value : {}));
  const isFormValid = computed(() => Object.keys(validationErrors.value).length === 0);
  const mealTimeOptions = [
    {
      get label() {
        return t('food.breakfast');
      },
      value: 'breakfast',
    },
    {
      get label() {
        return t('food.lunch');
      },
      value: 'lunch',
    },
    {
      get label() {
        return t('food.dinner');
      },
      value: 'dinner',
    },
    {
      get label() {
        return t('food.lateNight');
      },
      value: 'nightsnack',
    },
  ];
  const commonTags = [
    {
      value: '辣',
      get label() {
        return t('food.spicy');
      },
    },
    {
      value: '甜',
      get label() {
        return t('food.sweetTag');
      },
    },
    {
      value: '清淡',
      get label() {
        return t('food.light');
      },
    },
    {
      value: '油腻',
      get label() {
        return t('food.oilyTag');
      },
    },
    {
      value: '新品',
      get label() {
        return t('food.new');
      },
    },
    {
      value: '招牌',
      get label() {
        return t('food.signature');
      },
    },
    {
      value: '米饭',
      get label() {
        return t('food.rice');
      },
    },
    {
      value: '面食',
      get label() {
        return t('food.noodlesAndWheatDishes');
      },
    },
    {
      value: '小炒',
      get label() {
        return t('food.stirFry');
      },
    },
    {
      value: '汤类',
      get label() {
        return t('food.soup');
      },
    },
    {
      value: '素食',
      get label() {
        return t('food.vegetarianTag');
      },
    },
    {
      value: '荤菜',
      get label() {
        return t('food.meatDishes');
      },
    },
    {
      value: '凉菜',
      get label() {
        return t('food.coldDishes');
      },
    },
    {
      value: '主食',
      get label() {
        return t('food.staples');
      },
    },
    {
      value: '小吃',
      get label() {
        return t('food.snacks');
      },
    },
  ];
  const commonAllergens = allergenOptions;
  void loadAllergenCatalog();
  const updateCustomChoices = () => {
    customTags.value = (formData.tags || []).filter(
      tag => !commonTags.some(option => option.value === tag)
    );
    customAllergens.value = (formData.allergens || []).filter(
      tag => !commonAllergens.value.some(option => option.value === tag)
    );
  };
  const syncLocation = () => {
    selectedCanteen.value = canteenList.value.find(item => item.id === formData.canteenId) || null;
    windowList.value = selectedCanteen.value?.windows || [];
  };
  const loadCanteenList = async () => {
    if (loading.value) return false;
    const isCurrent = captureOperation();
    loading.value = true;
    canteenError.value = '';
    try {
      const response = await getCanteenList({ page: 1, pageSize: 100 });
      if (!isCurrent()) return false;
      if (response.code !== 200 || !response.data) throw new Error(t('food.couldNotLoadCanteens'));
      canteenList.value = response.data.items;
      syncLocation();
      return true;
    } catch {
      if (isCurrent()) canteenError.value = t('food.couldNotLoadCanteensTryAgain');
      return false;
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };
  const clearWindow = () => {
    if (formLocked.value) return;
    formData.windowId = '';
    formData.windowName = '';
    formData.windowNumber = '';
    formData.floor = '';
  };
  const selectCanteen = (canteen: Canteen) => {
    if (formLocked.value || targetDishId.value) return;
    selectedCanteen.value = canteen;
    formData.canteenId = canteen.id;
    formData.canteenName = canteen.name;
    windowList.value = canteen.windows || [];
    clearWindow();
  };
  const selectWindow = (window: Window) => {
    if (formLocked.value) return;
    formData.windowId = window.id;
    formData.windowNumber = window.number || '';
    formData.windowName = window.name;
    formData.floor = window.floor?.level || '';
  };
  const toggleMealTime = (value: 'breakfast' | 'lunch' | 'dinner' | 'nightsnack') => {
    if (formLocked.value) return;
    const index = formData.availableMealTime.indexOf(value);
    if (index < 0) formData.availableMealTime.push(value);
    else formData.availableMealTime.splice(index, 1);
  };
  const toggleTag = (tag: string) => {
    if (formLocked.value) return;
    formData.tags ||= [];
    const index = formData.tags.indexOf(tag);
    if (index < 0) formData.tags.push(tag);
    else formData.tags.splice(index, 1);
  };
  const addCustomTag = () => {
    if (formLocked.value) return;
    const tag = customTagInput.value.trim();
    if (!tag) return;
    if (!formData.tags?.includes(tag)) toggleTag(tag);
    customTagInput.value = '';
    updateCustomChoices();
  };
  const removeCustomTag = (tag: string) => {
    if (formLocked.value) return;
    formData.tags = formData.tags?.filter(item => item !== tag);
    updateCustomChoices();
  };
  const toggleAllergen = (tag: string) => {
    if (formLocked.value) return;
    formData.allergens ||= [];
    const index = formData.allergens.indexOf(tag);
    if (index < 0) formData.allergens.push(tag);
    else formData.allergens.splice(index, 1);
  };
  const addCustomAllergen = () => {
    if (formLocked.value) return;
    const tag = customAllergenInput.value.trim();
    if (!tag) return;
    if (!formData.allergens?.includes(tag)) toggleAllergen(tag);
    customAllergenInput.value = '';
    updateCustomChoices();
  };
  const removeCustomAllergen = (tag: string) => {
    if (formLocked.value) return;
    formData.allergens = formData.allergens?.filter(item => item !== tag);
    updateCustomChoices();
  };
  const chooseImages = () => {
    if (formLocked.value || !requireStudent() || (formData.images?.length || 0) >= 9) return;
    const isCurrent = captureOperation();
    uni.chooseImage({
      count: 9 - (formData.images?.length || 0),
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: result => {
        if (!isCurrent() || formLocked.value) return;
        for (const path of result.tempFilePaths) images.set(path, { path, source: 'temporary' });
        formData.images = [...(formData.images || []), ...result.tempFilePaths];
      },
    });
  };
  const isExistingImage = (path: string) =>
    !!targetDishId.value &&
    !!formBaseline?.images?.some(existing => imageIdentity(existing) === imageIdentity(path));
  const removeImage = (index: number) => {
    const path = formData.images?.[index];
    if (path && !formLocked.value && !isExistingImage(path)) formData.images!.splice(index, 1);
  };
  const assetFor = (path: string): DraftImage => images.get(path) || { path, source: 'temporary' };
  const storageFailure = () => {
    draftSaved.value = false;
    draftError.value = t('food.draftUnsavedStorageIsFullOrPhotosCould');
  };
  const saveDraft = async (): Promise<boolean> => {
    if (disposed || savingDraft.value || submitted.value || !draftKey()) return false;
    if (draftTimer !== null) clearTimeout(draftTimer);
    const key = draftKey();
    const isCurrent = captureOperation();
    savingDraft.value = true;
    draftError.value = '';
    try {
      const selected = [...(formData.images || [])];
      const savedImages: DraftImage[] = [];
      for (const path of selected) {
        const before = assetFor(path);
        const saved = await persistDraftImage(before);
        if (!isCurrent()) {
          if (saved.source === 'saved' && before.source !== 'saved')
            removeSavedDraftImages([saved]);
          return false;
        }
        if (saved.source === 'saved' && before.source !== 'saved') uncommittedFiles.add(saved.path);
        images.set(path, saved);
        images.set(saved.path, saved);
        const index = formData.images!.indexOf(path);
        if (index >= 0) formData.images![index] = saved.path;
        savedImages.push(serializeDraftImage(saved));
      }
      const previous = uni.getStorageSync(key) as SavedDraft | undefined;
      const form = clone(formData);
      form.images = [];
      const draft: SavedDraft = {
        version: 1,
        form,
        images: savedImages,
        clientRequestId: clientRequestId.value,
        baseline: formBaseline,
        targetDishUpdatedAt,
        revision: revision.value,
        customTag: customTagInput.value,
        customAllergen: customAllergenInput.value,
        timestamp: Date.now(),
      };
      uni.setStorageSync(key, draft);
      const retained = new Set(savedImages.map(image => image.path));
      removeSavedDraftImages((previous?.images || []).filter(image => !retained.has(image.path)));
      savedImages.forEach(image => uncommittedFiles.delete(image.path));
      draftSaved.value = true;
      return true;
    } catch {
      if (isCurrent()) storageFailure();
      return false;
    } finally {
      if (isCurrent()) savingDraft.value = false;
    }
  };
  const clearDraft = () => {
    const key = draftKey();
    if (!key) return false;
    try {
      const draft = uni.getStorageSync(key) as SavedDraft | undefined;
      uni.removeStorageSync(key);
      uni.removeStorageSync(submissionKey());
      removeSavedDraftImages([...(draft?.images || []), ...Array.from(images.values())]);
      uncommittedFiles.clear();
      draftSaved.value = false;
      return true;
    } catch {
      storageFailure();
      return false;
    }
  };
  const releaseLocalResources = () => {
    restoredBlobUrls.forEach(url => URL.revokeObjectURL(url));
    restoredBlobUrls.clear();
    removeSavedDraftImages([...uncommittedFiles].map(path => ({ path, source: 'saved' })));
    uncommittedFiles.clear();
    images.clear();
  };
  const resetForm = () => {
    releaseLocalResources();
    Object.keys(formData).forEach(key => delete (formData as any)[key]);
    Object.assign(formData, blankForm());
    selectedCanteen.value = null;
    windowList.value = [];
    error.value = '';
    rejectionReason.value = '';
    customTags.value = [];
    customAllergens.value = [];
    customTagInput.value = '';
    customAllergenInput.value = '';
    submitted.value = false;
    validationAttempted.value = false;
    pending.value = null;
    draftSaved.value = false;
    draftRestored.value = false;
    draftError.value = '';
    conflict.value = '';
    clientRequestId.value = requestId();
    formBaseline = null;
    targetDishUpdatedAt = undefined;
    revision.value = 0;
    markPristine();
  };
  const initialize = async (route: RouteOptions = options): Promise<boolean> => {
    options = { ...route };
    if (!userStore.isLoggedIn || !userStore.userInfo?.capabilities?.canContribute) {
      initializationError.value = t('food.verifyYourCampusIdentityToSuggestDishes');
      return false;
    }
    ready = false;
    cancelTimers();
    resetForm();
    uploadId.value = route.uploadId || '';
    targetDishId.value = route.targetDishId || '';
    initializing.value = true;
    initializationError.value = '';
    readOnly.value = false;
    const isCurrent = captureOperation();
    try {
      let source: MyUploadDetail | any;
      if (uploadId.value) {
        const response = await getMyUpload(uploadId.value);
        if (!isCurrent()) return false;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || t('food.couldNotLoadTheUpload'));
        source = response.data;
        revision.value = source.revision;
        targetDishId.value = source.targetDishId || '';
        rejectionReason.value = source.rejectReason || '';
        readOnly.value = !['pending', 'rejected'].includes(source.status);
        if (targetDishId.value) {
          formBaseline = toForm(source.baseSnapshot || source.targetDish || source);
          targetDishUpdatedAt = source.targetDish?.updatedAt;
        }
      } else if (targetDishId.value) {
        const response = await getDishById(targetDishId.value);
        if (!isCurrent()) return false;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || t('food.couldNotLoadTheDish'));
        source = response.data;
        formBaseline = toForm(source);
        targetDishUpdatedAt = source.updatedAt;
      }
      if (source) Object.assign(formData, toForm(source));
      else if (route.keyword) formData.name = route.keyword;
      (formData.images || []).forEach(path => images.set(path, { source: 'remote', path }));
      markPristine();
      const draft = uni.getStorageSync(draftKey()) as SavedDraft | undefined;
      const currentTargetVersion = targetDishUpdatedAt;
      pending.value = (uni.getStorageSync(submissionKey()) || null) as PendingSubmission | null;
      if (draft?.version === 1 && draft.revision === revision.value && !readOnly.value) {
        const remotePreviews = new Map(
          (formData.images || []).map(path => [imageIdentity(path), path])
        );
        Object.assign(formData, clone(draft.form));
        formData.images = draft.images.map(image => {
          const restored = restoreDraftImage(image);
          if (restored.source === 'remote')
            restored.path = remotePreviews.get(imageIdentity(restored.path)) || restored.path;
          images.set(restored.path, restored);
          if (restored.source === 'embedded') restoredBlobUrls.add(restored.path);
          return restored.path;
        });
        clientRequestId.value = draft.clientRequestId;
        formBaseline = draft.baseline;
        targetDishUpdatedAt = draft.targetDishUpdatedAt;
        customTagInput.value = draft.customTag;
        customAllergenInput.value = draft.customAllergen;
        draftRestored.value = true;
        draftSaved.value = true;
        if (
          !pending.value &&
          draft.targetDishUpdatedAt &&
          currentTargetVersion &&
          new Date(draft.targetDishUpdatedAt).getTime() !== new Date(currentTargetVersion).getTime()
        )
          conflict.value = 'target';
      } else if (draft && !pending.value)
        draftError.value = t('food.thisUploadHasChangedYourPreviousDraftWas');
      if (pending.value) {
        clientRequestId.value = pending.value.payload.clientRequestId || clientRequestId.value;
        if (!draftRestored.value) {
          Object.assign(formData, toForm(pending.value.payload));
          (formData.images || []).forEach(path => images.set(path, { source: 'remote', path }));
        }
      }
      updateCustomChoices();
      ready = true;
      await loadCanteenList();
      return isCurrent();
    } catch (err: any) {
      if (isCurrent())
        initializationError.value = err.message || t('food.couldNotLoadUploadDetailsTryAgain');
      return false;
    } finally {
      if (isCurrent()) initializing.value = false;
    }
  };
  const payloadFor = (draft: FormData, urls: string[]): DishUserCreateRequest => {
    const payload: DishUserCreateRequest = {
      name: draft.name.trim(),
      price: Number(draft.price),
      canteenId: draft.canteenId,
      canteenName: draft.canteenName,
      availableMealTime: draft.availableMealTime,
      images: urls,
      clientRequestId: clientRequestId.value,
    };
    for (const field of fields)
      if (
        !['name', 'price', 'images', 'availableMealTime'].includes(field) &&
        draft[field] !== undefined
      )
        (payload as any)[field] = draft[field];
    for (const { key } of nutritionFields) payload[key] = nutritionValue(draft[key]);
    if (!draft.windowId) {
      payload.windowId = undefined;
      payload.windowName = undefined;
      payload.windowNumber = undefined;
    }
    if (targetDishId.value && formBaseline) {
      payload.targetDishId = targetDishId.value;
      payload.targetDishUpdatedAt = targetDishUpdatedAt;
      payload.changedFields = fields.filter(
        field =>
          !equivalent(
            field === 'price'
              ? Number(draft.price)
              : nutritionFields.some(item => item.key === field)
                ? nutritionValue(draft[field])
                : field === 'name'
                  ? draft.name.trim()
                  : draft[field],
            formBaseline![field],
            field
          )
      );
      if (payload.changedFields.includes('windowId')) {
        for (const field of ['windowName', 'windowNumber'] as const)
          if (!payload.changedFields.includes(field)) payload.changedFields.push(field);
        payload.windowId = draft.windowId;
        payload.windowName = draft.windowName;
        payload.windowNumber = draft.windowNumber;
      }
    } else {
      payload.parentDishId = draft.parentDishId;
      payload.subDishId = draft.subDishId;
      payload.status = draft.status;
    }
    return payload;
  };
  const complete = (id?: string) => {
    submitted.value = true;
    clearDraft();
    pending.value = null;
    uni.showToast({
      title: targetDishId.value
        ? t('food.updateSuggestedAwaitingReview')
        : t('food.dishSuggestedAwaitingReview'),
      icon: 'success',
    });
    const isCurrent = captureOperation();
    navigationTimer = setTimeout(() => {
      navigationTimer = null;
      if (isCurrent())
        uni.redirectTo({
          url:
            '/pages/profile/records/my-uploads/index' + (id ? '?id=' + encodeURIComponent(id) : ''),
        });
    }, 1500);
  };
  const submitForm = async (): Promise<boolean> => {
    if (
      busy.value ||
      !!conflict.value ||
      (readOnly.value && !pending.value) ||
      initializationError.value ||
      !requireStudent()
    )
      return false;
    const isCurrent = captureOperation();
    if (!isCurrent()) return false;
    validationAttempted.value = true;
    if (!pending.value && !isFormValid.value) {
      uni.showToast({ title: t('food.completeTheRequiredFields'), icon: 'none' });
      return false;
    }
    const submissionForm = clone(formData);
    submitting.value = true;
    error.value = '';
    try {
      if (!pending.value) await saveDraft();
      if (!isCurrent()) return false;
      if (!pending.value) {
        const urls: string[] = [];
        for (const path of submissionForm.images || []) {
          const asset = assetFor(path);
          if (asset.source === 'remote') urls.push(asset.path);
          else {
            if (!asset.uploadedUrl) {
              const response = await uploadImage(asset.path, { purpose: 'dish-contribution' });
              if (!isCurrent()) return false;
              asset.uploadedUrl = response.url;
              images.set(path, asset);
              await saveDraft();
              if (!isCurrent()) return false;
            }
            urls.push(asset.uploadedUrl);
          }
        }
        const payload = payloadFor(submissionForm, urls);
        if (payload.targetDishId && !payload.changedFields?.length)
          throw new Error(t('food.changeTheDishInformationBeforeSubmitting'));
        const record = { payload, revision: revision.value, uploadId: uploadId.value };
        // 发出写请求前保存确认记录，关闭页面后仍使用同一请求标识。
        try {
          uni.setStorageSync(submissionKey(), record);
        } catch {
          throw new Error(t('food.couldNotSaveSubmissionStatusFreeUpLocal'));
        }
        pending.value = record;
      } else if (pending.value.uploadId) {
        const current = await getMyUpload(pending.value.uploadId);
        if (!isCurrent()) return false;
        if (
          current.code === 200 &&
          current.data &&
          current.data.revision > pending.value.revision
        ) {
          const saved = current.data;
          const matches = fields.every(
            field =>
              pending.value!.payload[field] === undefined ||
              equivalent(saved[field], pending.value!.payload[field], field)
          );
          if (saved.status === 'pending' && matches) {
            complete(saved.id);
            return true;
          }
          throw Object.assign(new Error(t('food.theseDetailsHaveChangedCheckMyUploadsFor')), {
            code: 409,
          });
        }
      }
      const record = pending.value!;
      const response = record.uploadId
        ? await updateMyUpload(record.uploadId, { ...record.payload, revision: record.revision })
        : await uploadDish(record.payload);
      if (!isCurrent()) return false;
      if (response.code !== 200 && response.code !== 201)
        throw Object.assign(new Error(response.message || t('food.submissionFailed')), {
          code: response.code,
        });
      complete(response.data?.id || record.uploadId);
      return true;
    } catch (err: any) {
      if (!isCurrent()) return false;
      const code = err.statusCode || err.status || Number(err.code);
      if (code >= 400 && code < 500) {
        pending.value = null;
        uni.removeStorageSync(submissionKey());
        if (code === 410) {
          images.forEach(asset => {
            if (asset.source !== 'remote') delete asset.uploadedUrl;
          });
          await saveDraft();
        }
        if (code === 409)
          conflict.value = uploadId.value ? 'upload' : targetDishId.value ? 'target' : 'request';
      }
      error.value =
        code === 410
          ? t('food.theSavedPhotosHaveExpiredRetryingWillUpload')
          : pending.value
            ? t('food.submissionStatusIsPendingRetryToConfirmThen')
            : err.message || t('food.submissionFailedTryAgainLater');
      uni.showToast({ title: error.value, icon: 'none' });
      return false;
    } finally {
      if (isCurrent()) submitting.value = false;
    }
  };
  watch(snapshot, () => {
    if (!ready || formLocked.value) return;
    draftSaved.value = false;
    if (draftTimer !== null) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      draftTimer = null;
      void saveDraft();
    }, 500);
  });
  watch(
    () => userStore.sessionVersion,
    () => {
      ready = false;
      cancelTimers();
      resetForm();
      canteenList.value = [];
      canteenError.value = '';
      loading.value = false;
      submitting.value = false;
      initializing.value = false;
      savingDraft.value = false;
      initializationError.value = t('food.yourAccountHasChangedReopenTheDishSubmission');
    },
    { flush: 'sync' }
  );
  watch(
    () => userStore.isLoggedIn && userStore.userInfo?.capabilities?.canContribute,
    allowed => {
      if (allowed && !disposed && !ready && !initializing.value) void initialize();
    }
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      cancelTimers();
      releaseLocalResources();
    });
  return {
    formData,
    clientRequestId,
    targetDishId,
    uploadId,
    rejectionReason,
    readOnly,
    conflict,
    canDiscardDraft,
    awaitingConfirmation,
    initializing,
    initializationError,
    initialize,
    formLocked,
    savingDraft,
    draftSaved,
    draftRestored,
    draftError,
    saveDraft,
    clearDraft,
    canteenList,
    windowList,
    selectedCanteen,
    loading,
    submitting,
    submitted,
    busy,
    dirty,
    fieldErrors,
    canteenError,
    markPristine,
    clearWindow,
    error,
    isFormValid,
    mealTimeOptions,
    commonTags,
    commonAllergens,
    customTagInput,
    customAllergenInput,
    customTags,
    customAllergens,
    loadCanteenList,
    selectCanteen,
    selectWindow,
    toggleMealTime,
    toggleTag,
    addCustomTag,
    removeCustomTag,
    toggleAllergen,
    addCustomAllergen,
    removeCustomAllergen,
    chooseImages,
    isExistingImage,
    removeImage,
    submitForm,
    resetForm,
  };
}
