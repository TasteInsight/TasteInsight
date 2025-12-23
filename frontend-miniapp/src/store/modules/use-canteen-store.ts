import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  getCanteenList,
  getCanteenDetail,
  getWindowList,
  getWindowDetail,
  getWindowDishes,
} from '@/api/modules/canteen';
import type {
  Canteen,
  Window,
  PaginationParams,
  Dish,
} from '@/types/api';

export const useCanteenStore = defineStore('canteen', () => {
  // ==================== State ====================
  
  // 食堂列表
  const canteenList = ref<Canteen[]>([]);
  
  // 当前食堂详情
  const currentCanteen = ref<Canteen | null>(null);
  
  // 窗口列表
  const windowList = ref<Window[]>([]);
  
  // 当前窗口详情
  const currentWindow = ref<Window | null>(null);

  // 当前窗口菜品
  const currentWindowDishes = ref<Dish[]>([]);
  
  // 分页信息
  const pagination = ref({
    page: 1,
    pageSize: 9,
    total: 0,
    totalPages: 0,
  });
  
  // 加载状态
  const loading = ref(false);
  
  // 加载更多状态
  const loadingMore = ref(false);
  
  // 错误信息
  const error = ref<string | null>(null);

  // ==================== Getters ====================
  
  /**
   * 是否有食堂数据
   */
  const hasCanteens = computed(() => canteenList.value.length > 0);
  
  /**
   * 是否有窗口数据
   */
  const hasWindows = computed(() => windowList.value.length > 0);
  
  /**
   * 根据ID获取食堂
   */
  const getCanteenById = computed(() => {
    return (id: string) => canteenList.value.find(canteen => canteen.id === id);
  });
  
  /**
   * 根据ID获取窗口
   */
  const getWindowById = computed(() => {
    return (id: string) => windowList.value.find(window => window.id === id);
  });

  // ==================== Actions ====================

  /**
   * 获取食堂列表
   */
  async function fetchCanteenList(params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await getCanteenList(params);
      
      if (response.code === 200 && response.data) {
        canteenList.value = response.data.items;
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '获取食堂列表失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取食堂列表失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 加载更多食堂列表
   */
  async function loadMoreCanteenList() {
    if (loadingMore.value || pagination.value.page >= pagination.value.totalPages) {
      return;
    }
    
    loadingMore.value = true;
    error.value = null;
    
    try {
      const nextPage = pagination.value.page + 1;
      const response = await getCanteenList({ page: nextPage, pageSize: pagination.value.pageSize });
      
      if (response.code === 200 && response.data) {
        canteenList.value = [...canteenList.value, ...response.data.items];
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '加载更多食堂失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('加载更多食堂失败:', err);
      throw err;
    } finally {
      loadingMore.value = false;
    }
  }

  /**
   * 获取食堂详情
   */
  async function fetchCanteenDetail(canteenId: string, params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await getCanteenDetail(canteenId, params);
      
      if (response.code === 200 && response.data) {
        currentCanteen.value = response.data;
      } else {
        throw new Error(response.message || '获取食堂详情失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取食堂详情失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取窗口列表
   */
  async function fetchWindowList(canteenId: string, params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await getWindowList(canteenId, params);
      
      if (response.code === 200 && response.data) {
        windowList.value = response.data.items;
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '获取窗口列表失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取窗口列表失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取窗口详情
   */
  async function fetchWindowDetail(windowId: string, params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      console.log('[store] fetchWindowDetail ->', windowId, params);
      const response = await getWindowDetail(windowId, params);
      console.log('[store] fetchWindowDetail response ->', response);

      if (!(response && response.code === 200 && response.data)) {
        throw new Error(response?.message || '获取窗口详情失败');
      }

      // 直接使用后端返回的窗口对象
      currentWindow.value = response.data as Window;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取窗口详情失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取窗口菜品
   */
  async function fetchWindowDishes(windowId: string, params?: PaginationParams) {
    loading.value = true;
    error.value = null;

    try {
      const response = await getWindowDishes(windowId, params);
      if (response.code === 200 && response.data) {
        currentWindowDishes.value = response.data.items || [];
        pagination.value = response.data.meta ?? pagination.value;
      } else {
        throw new Error(response.message || '获取窗口菜品失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取窗口菜品失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 清空当前食堂
   */
  function clearCurrentCanteen() {
    currentCanteen.value = null;
  }

  /**
   * 清空当前窗口
   */
  function clearCurrentWindow() {
    currentWindow.value = null;
    currentWindowDishes.value = [];
  }

  /**
   * 清空所有数据
   */
  function clearAll() {
    canteenList.value = [];
    currentCanteen.value = null;
    windowList.value = [];
    currentWindow.value = null;
    pagination.value = {
      page: 1,
      pageSize: 9,
      total: 0,
      totalPages: 0,
    };
    error.value = null;
  }

  return {
    // State
    canteenList,
    currentCanteen,
    windowList,
    currentWindow,
    currentWindowDishes,
    pagination,
    loading,
    loadingMore,
    error,
    
    // Getters
    hasCanteens,
    hasWindows,
    getCanteenById,
    getWindowById,
    
    // Actions
    fetchCanteenList,
    loadMoreCanteenList,
    fetchCanteenDetail,
    fetchWindowList,
    fetchWindowDetail,
    fetchWindowDishes,
    
    // Utilities
    clearCurrentCanteen,
    clearCurrentWindow,
    clearAll,
  };
});