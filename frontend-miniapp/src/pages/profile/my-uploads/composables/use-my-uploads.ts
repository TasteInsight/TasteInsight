import { computed, ref, watch, getCurrentScope, onScopeDispose } from 'vue';
import { getMyUploads, getMyUpload, withdrawMyUpload } from '@/api/modules/user';
import { useUserStore } from '@/store/modules/use-user-store';
import { requireStudent } from '@/utils/student-access';
import { toUserFriendlyErrorMessage } from '@/utils/user-friendly-error';
import type { MyUploadItem, MyUploadDetail } from '@/types/api';

function uploadSummary(item: MyUploadItem | MyUploadDetail): MyUploadItem {
  const {
    id,
    name,
    canteenName,
    price,
    priceUnit,
    windowName,
    images,
    status,
    kind,
    targetDishId,
    approvedDishId,
    revision,
    rejectReason,
    createdAt,
  } = item;
  return {
    id,
    name,
    canteenName,
    price,
    priceUnit,
    windowName,
    images,
    status,
    kind,
    targetDishId,
    approvedDishId,
    revision,
    rejectReason,
    createdAt,
  };
}

export function useMyUploads() {
  const user = useUserStore();
  const items = ref<MyUploadItem[]>([]);
  const focusedUpload = ref<MyUploadItem | null>(null);
  const detachedUpload = computed(() =>
    focusedUpload.value && !items.value.some(item => item.id === focusedUpload.value!.id)
      ? focusedUpload.value
      : null
  );
  const focusId = ref('');
  const focusError = ref('');
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref('');
  const actionError = ref('');
  const withdrawing = ref('');
  const hasMore = ref(true);
  let page = 0;
  let version = 0;
  let disposed = false;
  let failedAppend = false;
  const capture = () => {
    const session = user.sessionVersion;
    const owner = user.userInfo?.id;
    return () => !disposed && session === user.sessionVersion && owner === user.userInfo?.id;
  };
  const reset = () => {
    version++;
    items.value = [];
    focusedUpload.value = null;
    loading.value = false;
    initialized.value = false;
    error.value = '';
    actionError.value = '';
    withdrawing.value = '';
    hasMore.value = true;
    page = 0;
    focusId.value = '';
    focusError.value = '';
  };
  const load = async (append = false): Promise<boolean> => {
    if (disposed || !user.isLoggedIn || (append && (loading.value || !hasMore.value))) return false;
    const isCurrent = capture();
    const request = ++version;
    loading.value = true;
    error.value = '';
    if (!append) {
      focusedUpload.value = null;
      focusError.value = '';
    }
    failedAppend = append;
    try {
      const next: MyUploadItem[] = [];
      let loaded = append ? page + 1 : 1;
      let totalPages = 1;
      const through = append ? loaded : Math.max(page, 1);
      for (let current = loaded; current <= through; current++) {
        const response = await getMyUploads({ page: current, pageSize: 10 });
        if (!isCurrent() || request !== version) return false;
        if (response.code !== 200 || !response.data)
          throw new Error(response.message || '上传记录加载失败');
        next.push(...response.data.items);
        loaded = current;
        totalPages = response.data.meta.totalPages;
        if (current >= totalPages) break;
      }
      items.value = [
        ...new Map(
          [...(append ? items.value : []), ...next].map(item => [item.id, uploadSummary(item)])
        ).values(),
      ].sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
      );
      page = loaded;
      hasMore.value = loaded < totalPages;
      initialized.value = true;
      const listedTarget = items.value.find(item => item.id === focusId.value);
      if (listedTarget) focusedUpload.value = listedTarget;
      else if (focusId.value && !append) {
        try {
          const response = await getMyUpload(focusId.value);
          if (!isCurrent() || request !== version) return false;
          if (response.code !== 200 || !response.data)
            throw Object.assign(new Error(response.message || '上传详情加载失败'), {
              statusCode: response.code,
            });
          focusedUpload.value = uploadSummary(response.data);
        } catch (cause: any) {
          if (!isCurrent() || request !== version) return false;
          focusedUpload.value = null;
          if (cause?.statusCode === 404 || cause?.statusCode === 403) focusId.value = '';
          focusError.value = toUserFriendlyErrorMessage(cause);
        }
      }
      return true;
    } catch (cause) {
      if (isCurrent() && request === version) error.value = toUserFriendlyErrorMessage(cause);
      return false;
    } finally {
      if (isCurrent() && request === version) loading.value = false;
    }
  };
  const refresh = (id = focusId.value) => {
    focusId.value = id;
    return load(false);
  };
  const replace = (item: MyUploadItem) => {
    const summary = uploadSummary(item);
    items.value = items.value.map(previous =>
      previous.id === item.id ? { ...previous, ...summary } : previous
    );
    if (focusedUpload.value?.id === item.id)
      focusedUpload.value = { ...focusedUpload.value, ...summary };
  };
  const withdraw = async (item: MyUploadItem): Promise<boolean> => {
    if (
      disposed ||
      withdrawing.value ||
      !['pending', 'rejected'].includes(item.status) ||
      !requireStudent()
    )
      return false;
    const isCurrent = capture();
    withdrawing.value = item.id;
    actionError.value = '';
    try {
      const response = await withdrawMyUpload(item.id, item.revision);
      if (!isCurrent()) return false;
      if (response.code !== 200 && response.code !== 201)
        throw new Error(response.message || '撤回失败');
      version++;
      loading.value = false;
      replace({ ...item, status: 'withdrawn', revision: item.revision + 1 });
      return true;
    } catch (cause) {
      if (!isCurrent()) return false;
      actionError.value = toUserFriendlyErrorMessage(cause);
      try {
        const current = await getMyUpload(item.id);
        if (isCurrent() && current.code === 200 && current.data) replace(current.data);
      } catch {
        /* 保留列表和操作错误，供用户再次刷新。 */
      }
      return false;
    } finally {
      if (isCurrent()) withdrawing.value = '';
    }
  };
  watch(() => user.sessionVersion, reset, { flush: 'sync' });
  watch(
    focusId,
    () => {
      version++;
      loading.value = false;
      focusedUpload.value = null;
      focusError.value = '';
    },
    { flush: 'sync' }
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true;
      version++;
    });
  return {
    items,
    focusedUpload,
    detachedUpload,
    focusId,
    focusError,
    loading,
    initialized,
    error,
    actionError,
    withdrawing,
    hasMore,
    refresh,
    loadMore: () => load(true),
    retry: () => load(failedAppend),
    withdraw,
  };
}
