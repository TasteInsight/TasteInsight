import { defineStore } from 'pinia';
import { wechatLogin, getUserProfile } from '@/api/modules/user';
import type { User } from '@/types/api';

interface UserState {
  token: string | null;
  userInfo: User | null;
}

export const useUserStore = defineStore('user', {
  // 状态：定义核心数据
  state: (): UserState => ({
    token: uni.getStorageSync('token') || null,
    userInfo: (() => {
      const userInfoStr = uni.getStorageSync('userInfo');
      if (userInfoStr) {
        try {
          return JSON.parse(userInfoStr) as User;
        } catch {
          return null;
        }
      }
      return null;
    })(),
  }),

  // 用于派生状态
  getters: {
    /**
     * @description 是否已登录
     * @returns {boolean}
     */
    isLoggedIn: (state): boolean => !!state.token,
    
    /**
     * @description 用户头像，带默认值
     * @returns {string}
     */
    avatar: (state): string => state.userInfo?.avatar || '/static/images/default-avatar.png',
    
    /**
     * @description 用户昵称，带默认值
     * @returns {string}
     */
    nickname: (state): string => state.userInfo?.nickname || '游客',
  },

  // Actions：定义修改 state 的方法
  actions: {
    /**
     * @description 微信登录流程
     * @param {string} code - uni.login 获取的 code
     */
    async loginAction(code: string): Promise<User> {
      try {
        // wechatLogin 返回的是 LoginData，包含 { token: string, user: User }
        const loginData = await wechatLogin(code);
        const { token, user } = loginData;

        // 使用 this 来访问 state
        this.token = token;
        this.userInfo = user;

        // 持久化存储
        uni.setStorageSync('token', token);
        uni.setStorageSync('userInfo', JSON.stringify(user)); // 对象转为字符串存储
        
        return user;
      } catch (error) {
        // 清理旧数据，以防万一
        this.logoutAction();
        throw error; 
      }
    },

    /**
     * @description 退出登录
     */
    logoutAction(): void {
      this.token = null;
      this.userInfo = null;
      uni.removeStorageSync('token');
      uni.removeStorageSync('userInfo');
      
      // 可以选择性地跳转到首页或登录页
      // uni.reLaunch({ url: '/pages/index/index' });
    },
    
    /**
     * @description 从服务器刷新最新的用户信息
     */
    async fetchProfileAction(): Promise<void> {
      if (!this.isLoggedIn) {
        console.warn('用户未登录，无法获取用户信息');
        return;
      }
      
      try {
        // getUserProfile 返回的直接是 User 对象，不是 { data: User }
        const user = await getUserProfile();
        this.userInfo = user;
        uni.setStorageSync('userInfo', JSON.stringify(user));
      } catch (error) {
        console.error('获取用户信息失败:', error);
        throw error;
      }
    },
    
    /**
     * @description 更新本地用户信息（不调用接口）
     * @param {Partial<User>} userInfo - 部分用户信息
     */
    updateLocalUserInfo(userInfo: Partial<User>): void {
      if (this.userInfo) {
        this.userInfo = { ...this.userInfo, ...userInfo };
        uni.setStorageSync('userInfo', JSON.stringify(this.userInfo));
      }
    },
  },
});