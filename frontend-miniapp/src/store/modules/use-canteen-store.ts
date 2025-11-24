import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  getCanteenList,
  getCanteenDetail,
  getWindowList,
  getWindowDetail,
} from '@/api/modules/canteen';
import type {
  Canteen,
  Window,
  PaginationParams,
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
  
  // 分页信息
  const pagination = ref({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  
  // 加载状态
  const loading = ref(false);
  
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

      if (!(response && response.code === 200)) {
        throw new Error(response?.message || '获取窗口详情失败');
      }

      const payload = response.data;
      // 后端可能在这个接口返回分页列表（{ items: [...] }），也可能直接返回单个对象
      if (payload && (payload as any).items && Array.isArray((payload as any).items)) {
        const items = (payload as any).items as Window[];
        const found = items.find(w => String(w.id) === String(windowId));
        if (found) {
          currentWindow.value = found;
        } else if (items.length === 1) {
          // 有时后端会把单个对象也放在 items 中
          currentWindow.value = items[0];
        } else {
          throw new Error('未在返回的窗口列表中找到对应窗口');
        }
      } else if (payload && (payload as any).id) {
        // 直接返回单个窗口对象
        currentWindow.value = payload as Window;
      } else {
        throw new Error('返回的数据格式不符合预期');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取窗口详情失败:', err);
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
      pageSize: 10,
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
    pagination,
    loading,
    error,
    
    // Getters
    hasCanteens,
    hasWindows,
    getCanteenById,
    getWindowById,
    
    // Actions
    fetchCanteenList,
    fetchCanteenDetail,
    fetchWindowList,
    fetchWindowDetail,
    
    // Utilities
    clearCurrentCanteen,
    clearCurrentWindow,
    clearAll,
  };
});