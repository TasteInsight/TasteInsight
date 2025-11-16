import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LoginCredentials, Admin } from '@/types/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'));
  const user = ref<Admin | null>(JSON.parse(localStorage.getItem('admin_user') || 'null'));
  const isAuthenticated = ref<boolean>(!!localStorage.getItem('admin_token'));

  const isLoggedIn = computed(() => !!token.value && isAuthenticated.value);

  const login = async (credentials: LoginCredentials & { remember?: boolean }) => {
    token.value = 'mock_token_' + Date.now();
    user.value = {
      username: credentials.username,
      id: Date.now().toString(),
      permissions: [],
      role: 'admin',
      createdAt: new Date().toISOString()
    } as Admin;
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
  };

  return {
    token,
    user,
    isAuthenticated,
    isLoggedIn,
    login,
    logout
  };
});