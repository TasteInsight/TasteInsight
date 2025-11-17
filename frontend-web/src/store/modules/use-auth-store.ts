import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/modules/auth';
import type { LoginCredentials, Admin } from '@/types/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token'));
  const refreshToken = ref<string | null>(localStorage.getItem('admin_refresh_token') || sessionStorage.getItem('admin_refresh_token'));
  
  // 初始化用户信息
  const getStoredUser = (): Admin | null => {
    const stored = localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user');
    return stored ? JSON.parse(stored) : null;
  };
  
  const user = ref<Admin | null>(getStoredUser());
  const isAuthenticated = ref<boolean>(!!token.value);

  const isLoggedIn = computed(() => !!token.value && isAuthenticated.value);

  const login = async (credentials: LoginCredentials & { remember?: boolean }) => {
    try {
      // 调用登录 API
      const response = await authApi.adminLogin({
        username: credentials.username,
        password: credentials.password
      });

      if (response.code === 200 && response.data) {
        const { token: tokenInfo, admin, permissions } = response.data;
        
        // 保存 token 和用户信息
        token.value = tokenInfo.accessToken;
        refreshToken.value = tokenInfo.refreshToken;
        user.value = admin;
        isAuthenticated.value = true;

        // 根据 remember 选项决定存储位置
        if (credentials.remember) {
          localStorage.setItem('admin_token', tokenInfo.accessToken);
          localStorage.setItem('admin_refresh_token', tokenInfo.refreshToken);
          localStorage.setItem('admin_user', JSON.stringify(admin));
          localStorage.setItem('admin_permissions', JSON.stringify(permissions));
        } else {
          sessionStorage.setItem('admin_token', tokenInfo.accessToken);
          sessionStorage.setItem('admin_refresh_token', tokenInfo.refreshToken);
          sessionStorage.setItem('admin_user', JSON.stringify(admin));
          sessionStorage.setItem('admin_permissions', JSON.stringify(permissions));
        }

        return {
          token: tokenInfo.accessToken,
          data: {
            user: admin,
            permissions
          }
        };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      // 清除可能已保存的 token
      token.value = null;
      refreshToken.value = null;
      user.value = null;
      isAuthenticated.value = false;
      
      throw error;
    }
  };

  const logout = () => {
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    isAuthenticated.value = false;
    
    // 清除所有存储的认证信息
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_permissions');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_refresh_token');
    sessionStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_permissions');
  };

  return {
    token,
    refreshToken,
    user,
    isAuthenticated,
    isLoggedIn,
    login,
    logout
  };
});