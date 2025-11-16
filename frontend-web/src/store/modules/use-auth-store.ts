import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'));
  const user = ref<any>(JSON.parse(localStorage.getItem('admin_user') || 'null'));
  const isAuthenticated = ref<boolean>(!!localStorage.getItem('admin_token'));

  const isLoggedIn = computed(() => !!token.value && isAuthenticated.value);

  const login = async (credentials: any) => {
    token.value = 'mock_token_' + Date.now();
    user.value = {
      username: credentials.username || '管理员',
      name: credentials.username || '管理员',
      id: Date.now()
    };
    isAuthenticated.value = true;

    if (credentials.remember) {
      localStorage.setItem('admin_token', token.value);
      localStorage.setItem('admin_user', JSON.stringify(user.value));
    } else {
      sessionStorage.setItem('admin_token', token.value);
      sessionStorage.setItem('admin_user', JSON.stringify(user.value));
    }

    return {
      token: token.value,
      data: {
        user: user.value
      }
    };
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    isAuthenticated.value = false;

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
  };

  const initAuth = () => {
    const storedToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const storedUser = localStorage.getItem('admin_user') || sessionStorage.getItem('admin_user');

    if (storedToken) {
      token.value = storedToken;
      isAuthenticated.value = true;
    }

    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  };

  return {
    token,
    user,
    isAuthenticated,
    isLoggedIn,
    login,
    logout,
    initAuth
  };
});