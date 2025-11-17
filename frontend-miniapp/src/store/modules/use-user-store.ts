import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // 引入 ref 和 computed
import { wechatLogin, getUserProfile } from '@/api/modules/user';
import type { User, UserProfileUpdateRequest } from '@/types/api';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(uni.getStorageSync('token') || null);
  
  const initialUserInfo = (() => {
    const info = uni.getStorageSync('userInfo');
    try {
      return info ? JSON.parse(info) as User : null;
    } catch {
      return null;
    }
  })();
  const userInfo = ref<User | null>(initialUserInfo);

  // ==================== Getters ====================

  
  /**
   * 是否已登录
   */
  const isLoggedIn = computed(() => !!token.value);
  
  /**
   * 用户头像，带默认值
   */
  const avatar = computed(() => userInfo.value?.avatar || '/static/images/default-avatar.png');
  
  /**
   * 用户昵称，带默认值
   */
  const nickname = computed(() => userInfo.value?.nickname || '游客');

  // ==================== Actions ====================

  /**
   * 微信登录流程
   */
  async function loginAction(code: string): Promise<User> {
    try {
      const loginData = (await wechatLogin(code)).data;
      const { token: newToken, user } = loginData;

      // 添加空值检查
      if (!newToken?.accessToken || !user) {
        throw new Error('登录失败：未获取到有效的 token 或用户信息');
      }

      // 确保用户信息完整
      if (!user.id || !user.openId || !user.nickname || !user.avatar) {
        throw new Error('用户信息不完整');
      }

      // 直接修改 ref 的 .value
      token.value = newToken?.accessToken;
      userInfo.value = user;

      // 只存储 accessToken 字符串，保持与初始化时的类型一致
      uni.setStorageSync('token', newToken.accessToken);
      uni.setStorageSync('userInfo', JSON.stringify(user));
      
      return user;
    } catch (error) {
      logoutAction(); // 直接调用函数
      throw error; 
    }
  }

  /**
   * 退出登录
   */
  function logoutAction(): void {
    token.value = null;
    userInfo.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('userInfo');
  }
    
  /**
   * 从服务器刷新最新的用户信息
   */
  async function fetchProfileAction(): Promise<void> {
    if (!isLoggedIn.value) { // 直接使用 computed getter
      console.warn('用户未登录，无法获取用户信息');
      return;
    }
    
    try {
      const response = await getUserProfile();
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message || '获取用户信息失败');
      }
      
      const user = response.data;
      userInfo.value = user;
      uni.setStorageSync('userInfo', JSON.stringify(user));
    } catch (error) {
      console.error('获取用户信息失败:', error);
      uni.showToast({
        title: '用户信息刷新失败',
        icon: 'none',
      });
      throw error;
    }
  }
    
  /**
   * 更新本地用户信息（不调用接口）
   */
  function updateLocalUserInfo(newInfo: Partial<User>): void {
    if (userInfo.value) {
      // 合并新旧信息
      userInfo.value = { ...userInfo.value, ...newInfo };
      uni.setStorageSync('userInfo', JSON.stringify(userInfo.value));
    }
  }

  // **必须**返回所有需要暴露给外部的状态、getters 和 actions
  return {
    // State
    token,
    userInfo,
    // Getters
    isLoggedIn,
    avatar,
    nickname,
    // Actions
    loginAction,
    logoutAction,
    fetchProfileAction,
    updateLocalUserInfo,
  };
});