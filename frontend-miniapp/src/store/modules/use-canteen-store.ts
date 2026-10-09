import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useUserStore } from './use-user-store';
import { getCanteenList } from '@/api/modules/canteen';
import type { Canteen, PaginationParams } from '@/types/api';

export const useCanteenStore = defineStore('canteen', () => {
  const userStore = useUserStore();
  let listRequest = 0;
  const canteenList = ref<Canteen[]>([]);
  const pagination = ref({
    page: 1,
    pageSize: 9,
    total: 0,
    totalPages: 0,
  });
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);

  const hasCanteens = computed(() => canteenList.value.length > 0);
  const getCanteenById = computed(() => {
    return (id: string) => canteenList.value.find(canteen => canteen.id === id);
  });

  const normalizePaginationMeta = (meta: any) => {
    const page = Number(meta?.page ?? 1) || 1;
    const pageSize = Number(meta?.pageSize ?? pagination.value.pageSize ?? 9) || 9;
    const total = Number(meta?.total ?? 0) || 0;
    const rawTotalPages = meta?.totalPages;
    const totalPages =
      typeof rawTotalPages === 'number' && !Number.isNaN(rawTotalPages)
        ? rawTotalPages
        : total > 0
          ? Math.ceil(total / pageSize)
          : 0;

    return { page, pageSize, total, totalPages };
  };

  async function fetchCanteenList(params?: PaginationParams, isOperationCurrent: () => boolean = () => true) {
    const sessionVersion = userStore.sessionVersion;
    const request = ++listRequest;
    const ownsRequest = () => userStore.sessionVersion === sessionVersion && request === listRequest;
    loading.value = true;
    error.value = null;

    try {
      const response = await getCanteenList(params);
      if (!ownsRequest() || !isOperationCurrent()) return;

      if (response.code === 200 && response.data) {
        canteenList.value = response.data.items;
        pagination.value = normalizePaginationMeta(response.data.meta);
      } else {
        throw new Error(response.message || '获取食堂列表失败');
      }
    } catch (err) {
      if (!ownsRequest() || !isOperationCurrent()) return;
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取食堂列表失败:', err);
      throw err;
    } finally {
      if (ownsRequest()) loading.value = false;
    }
  }

  async function loadMoreCanteenList() {
    const sessionVersion = userStore.sessionVersion;
    const totalPages = pagination.value.totalPages;
    if (loadingMore.value) return;
    // totalPages <= 0 视为未知：允许尝试加载更多一次，由后端返回空列表终止
    if (totalPages > 0 && pagination.value.page >= totalPages) return;

    loadingMore.value = true;
    error.value = null;

    try {
      const nextPage = pagination.value.page + 1;
      const response = await getCanteenList({
        page: nextPage,
        pageSize: pagination.value.pageSize,
      });
      if (userStore.sessionVersion !== sessionVersion) return;

      if (response.code === 200 && response.data) {
        const items = response.data.items || [];
        if (items.length > 0) {
          canteenList.value = [...canteenList.value, ...items];
        }
        pagination.value = normalizePaginationMeta(response.data.meta);
      } else {
        throw new Error(response.message || '加载更多食堂失败');
      }
    } catch (err) {
      if (userStore.sessionVersion !== sessionVersion) return;
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('加载更多食堂失败:', err);
      throw err;
    } finally {
      if (userStore.sessionVersion === sessionVersion) loadingMore.value = false;
    }
  }

  function clearAll() {
    listRequest += 1;
    canteenList.value = [];
    pagination.value = {
      page: 1,
      pageSize: 9,
      total: 0,
      totalPages: 0,
    };
    error.value = null;
    loading.value = false;
    loadingMore.value = false;
  }

  watch(() => userStore.sessionVersion, () => {
    loading.value = false;
    loadingMore.value = false;
    error.value = null;
  }, { flush: 'sync' });

  return {
    canteenList,
    pagination,
    loading,
    loadingMore,
    error,
    hasCanteens,
    getCanteenById,
    fetchCanteenList,
    loadMoreCanteenList,
    clearAll,
  };
});
