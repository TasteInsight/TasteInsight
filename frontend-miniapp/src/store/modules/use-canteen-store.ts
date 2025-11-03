import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  getCanteenList,
  getCanteenDetail,
  getWindowList,
  getWindowDetail,
  
} from '@/api/modules/canteen';
import {
  adminGetCanteenList,
  adminGetWindowList,
  createCanteen,
  updateCanteen,
  deleteCanteen,
  createWindow,
  updateWindow,
  deleteWindow,
} from '@/api/modules/admin';
import type {
  Canteen,
  Window,
  PaginationParams,
  CanteenCreateRequest,
  CanteenUpdateRequest,
  WindowCreateRequest,
  WindowUpdateRequest,
} from '@/types/api';
import type { format } from 'path';

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
      const response = await getWindowDetail(windowId, params);
      
      if (response.code === 200 && response.data) {
        currentWindow.value = response.data;
      } else {
        throw new Error(response.message || '获取窗口详情失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('获取窗口详情失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // ==================== 管理端 Actions ====================

  /**
   * 管理端获取食堂列表
   */
  async function adminFetchCanteenList(params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await adminGetCanteenList(params);
      
      if (response.code === 200 && response.data) {
        canteenList.value = response.data.items;
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '获取食堂列表失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('管理端获取食堂列表失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 管理端获取窗口列表
   */
  async function adminFetchWindowList(canteenId: string, params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await adminGetWindowList(canteenId, params);
      
      if (response.code === 200 && response.data) {
        windowList.value = response.data.items;
        pagination.value = response.data.meta;
      } else {
        throw new Error(response.message || '获取窗口列表失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('管理端获取窗口列表失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建食堂
   */
  async function addCanteen(data: CanteenCreateRequest) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await createCanteen(data);
      
      if (response.code === 200 && response.data) {
        // 将新食堂添加到列表中
        canteenList.value.unshift(response.data);
        return response.data;
      } else {
        throw new Error(response.message || '创建食堂失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('创建食堂失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新食堂
   */
  async function modifyCanteen(id: string, data: CanteenUpdateRequest) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await updateCanteen(id, data);
      
      if (response.code === 200 && response.data) {
        // 更新列表中的食堂信息
        const index = canteenList.value.findIndex(canteen => canteen.id === id);
        if (index !== -1) {
          canteenList.value[index] = response.data;
        }
        
        // 如果是当前食堂，也更新当前食堂信息
        if (currentCanteen.value?.id === id) {
          currentCanteen.value = response.data;
        }
        
        return response.data;
      } else {
        throw new Error(response.message || '更新食堂失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('更新食堂失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除食堂
   */
  async function removeCanteen(id: string) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await deleteCanteen(id);
      
      if (response.code === 200) {
        // 从列表中移除
        canteenList.value = canteenList.value.filter(canteen => canteen.id !== id);
        
        // 如果是当前食堂，清空当前食堂信息
        if (currentCanteen.value?.id === id) {
          currentCanteen.value = null;
        }
      } else {
        throw new Error(response.message || '删除食堂失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('删除食堂失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 创建窗口
   */
  async function addWindow(data: WindowCreateRequest) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await createWindow(data);
      
      if (response.code === 200 && response.data) {
        // 将新窗口添加到列表中
        windowList.value.unshift(response.data);
        return response.data;
      } else {
        throw new Error(response.message || '创建窗口失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('创建窗口失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 更新窗口
   */
  async function modifyWindow(id: string, data: WindowUpdateRequest) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await updateWindow(id, data);
      
      if (response.code === 200 && response.data) {
        // 更新列表中的窗口信息
        const index = windowList.value.findIndex(window => window.id === id);
        if (index !== -1) {
          windowList.value[index] = response.data;
        }
        
        // 如果是当前窗口，也更新当前窗口信息
        if (currentWindow.value?.id === id) {
          currentWindow.value = response.data;
        }
        
        return response.data;
      } else {
        throw new Error(response.message || '更新窗口失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('更新窗口失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 删除窗口
   */
  async function removeWindow(id: string) {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await deleteWindow(id);
      
      if (response.code === 200) {
        // 从列表中移除
        windowList.value = windowList.value.filter(window => window.id !== id);
        
        // 如果是当前窗口，清空当前窗口信息
        if (currentWindow.value?.id === id) {
          currentWindow.value = null;
        }
      } else {
        throw new Error(response.message || '删除窗口失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      console.error('删除窗口失败:', err);
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
    
    // Actions - 用户端
    fetchCanteenList,
    fetchCanteenDetail,
    fetchWindowList,
    fetchWindowDetail,
    
    // Actions - 管理端
    adminFetchCanteenList,
    adminFetchWindowList,
    addCanteen,
    modifyCanteen,
    removeCanteen,
    addWindow,
    modifyWindow,
    removeWindow,
    
    // Utilities
    clearCurrentCanteen,
    clearCurrentWindow,
    clearAll,
  };
});