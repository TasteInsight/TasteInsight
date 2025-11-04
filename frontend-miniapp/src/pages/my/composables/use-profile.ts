// @/pages/my/composables/use-profile.ts (已修正)

import { ref, computed, onMounted, watch } from 'vue';
import { useUserStore } from '@/store/modules/use-user-store';
import type { UserProfileUpdateRequest } from '@/types/api';
import { updateUserProfile } from '@/api/modules/user';

export function useProfile() {
  const userStore = useUserStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- State ---
  // 从 Pinia store 中获取响应式的用户信息和登录状态
  const userInfo = computed(() => userStore.userInfo);
  const isLoggedIn = computed(() => userStore.isLoggedIn);

  // --- Actions ---

  /**
   * 刷新用户信息
   * 直接调用 Store 中已封装好的 action
   */
  const fetchProfile = async () => {
    loading.value = true;
    error.value = null;
    try {
      // 修正: 调用 store 中定义的 fetchProfileAction
      await userStore.fetchProfileAction();
    } catch (err) {
      const message = err instanceof Error ? err.message : '刷新用户信息失败';
      error.value = message;
      console.error(message, err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 更新用户信息
   * @param data - 需要更新的用户信息
   */
  const updateProfile = async (data: UserProfileUpdateRequest) => {
    loading.value = true;
    error.value = null;
    try {
      // 1. 调用 API 更新后端数据
      const updatedUser = await updateUserProfile(data);

      // 2. 使用 store 中提供的 action 更新本地和持久化存储
      // 修正: 调用 store 中定义的 updateLocalUserInfo
      userStore.updateLocalUserInfo(updatedUser.data);
      
      uni.showToast({ title: '更新成功', icon: 'success' });
      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : '更新用户信息失败';
      error.value = message;
      console.error(message, err);
      uni.showToast({ title: '更新失败', icon: 'none' });
      return false;
    } finally {
      loading.value = false;
    }
  };
  
  // --- Lifecycle ---

  // 监听登录状态变化，如果用户变为登录状态，则自动获取一次用户信息
  watch(isLoggedIn, (newStatus, oldStatus) => {
    if (newStatus === true && oldStatus === false) {
      fetchProfile();
    }
  });

  // 在 Composable 被使用时（组件挂载时）获取一次数据
  onMounted(() => {
    // 只有在已登录状态下才去获取
    if (isLoggedIn.value) {
      fetchProfile();
    }
  });

  return {
    loading,
    error,
    userInfo,
    isLoggedIn,
    fetchProfile,
    updateProfile,
  };
}