import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // 引入 ref 和 computed
import { wechatLogin, getUserProfile, updateUserProfile } from '@/api/modules/user';
import type { User, UserProfileUpdateRequest } from '@/types/api';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(uni.getStorageSync('token') || null);
  const refreshToken = ref<string | null>(uni.getStorageSync('refreshToken') || null);
  // 登录/退出切换会话代际；token 轮换保留当前代际。
  const sessionVersion = ref(0);
  let profileRequest = 0;
  // 并发读取可先完成初始化，已应用的新资料不被更早的响应覆盖。
  let appliedProfileRequest = 0;

  const initialUserInfo = (() => {
    const info = uni.getStorageSync('userInfo');
    try {
      return info ? (JSON.parse(info) as User) : null;
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
    logoutAction();
    const loginSession = sessionVersion.value;
    try {
      const loginData = (await wechatLogin(code)).data;
      assertCurrentSession(loginSession);
      const { token: newToken, user } = loginData;

      // 最低要求：必须拿到 accessToken
      if (!newToken?.accessToken) {
        throw new Error('登录失败：未获取到有效的 token');
      }

      // 先保存 token（以便后续请求能够携带 token 拉取 profile）
      updateTokens(loginSession, newToken.accessToken, newToken.refreshToken);

      // 情况1：后端同时返回用户信息，直接做容错处理
      if (user) {
        // 若后端返回的用户信息缺少昵称或头像，使用默认值
        const safeUser: User = {
          id: user.id || '',
          openId: user.openId || '',
          nickname: user.nickname || '微信用户',
          avatar: user.avatar || '/static/images/default-avatar.png',
          preferences: user.preferences || {},
          allergens: user.allergens || [],
          myFavoriteDishes: user.myFavoriteDishes || [],
          myReviews: user.myReviews || [],
          myComments: user.myComments || [],
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
        } as User;

        // 若缺少关键标识（id 或 openId），尝试通过 profile 接口补全
        if (!safeUser.id || !safeUser.openId) {
          try {
            await fetchProfileAction();
            assertCurrentSession(loginSession);
            if (userInfo.value) {
              return userInfo.value;
            }
          } catch (err) {
            throw new Error('用户信息不完整');
          }
        }

        userInfo.value = safeUser;
        uni.setStorageSync('userInfo', JSON.stringify(safeUser));
        // 确保获取最新的profile数据
        await fetchProfileAction();
        assertCurrentSession(loginSession);
        return userInfo.value!;
      }

      // 情况2：后端未返回用户信息，仅返回 token，则使用 profile 接口获取
      try {
        await fetchProfileAction();
        assertCurrentSession(loginSession);
        if (userInfo.value) {
          return userInfo.value;
        }
        throw new Error('登录失败：未能获取到用户信息');
      } catch (err) {
        // 清理已存 token
        if (sessionVersion.value === loginSession) logoutAction();
        throw err;
      }
    } catch (error) {
      if (sessionVersion.value === loginSession) logoutAction();
      throw error;
    }
  }

  /**
   * 退出登录
   */
  function logoutAction(): void {
    sessionVersion.value += 1;
    token.value = null;
    refreshToken.value = null;
    userInfo.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('refreshToken');
    uni.removeStorageSync('userInfo');
  }

  function assertCurrentSession(expectedSession: number): void {
    if (sessionVersion.value !== expectedSession) throw new Error('登录会话已变更');
  }

  function updateTokens(
    expectedSession: number,
    accessToken: string,
    nextRefreshToken?: string
  ): boolean {
    if (sessionVersion.value !== expectedSession) return false;
    token.value = accessToken;
    uni.setStorageSync('token', accessToken);
    if (nextRefreshToken) {
      refreshToken.value = nextRefreshToken;
      uni.setStorageSync('refreshToken', nextRefreshToken);
    }
    return true;
  }

  /**
   * 从服务器刷新最新的用户信息
   */
  async function fetchProfileAction(isOperationCurrent: () => boolean = () => true): Promise<void> {
    if (!isLoggedIn.value) {
      // 直接使用 computed getter
      console.warn('用户未登录，无法获取用户信息');
      return;
    }

    const profileSession = sessionVersion.value;
    const request = ++profileRequest;
    const ownsResult = () => sessionVersion.value === profileSession &&
      request >= appliedProfileRequest && isOperationCurrent();
    try {
      const response = await getUserProfile();
      if (!ownsResult()) return;
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message || '获取用户信息失败');
      }

      const user = response.data;
      appliedProfileRequest = request;
      userInfo.value = user;
      uni.setStorageSync('userInfo', JSON.stringify(user));
    } catch (error) {
      if (!ownsResult()) return;
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
      appliedProfileRequest = ++profileRequest;
      // 合并新旧信息
      userInfo.value = { ...userInfo.value, ...newInfo };
      uni.setStorageSync('userInfo', JSON.stringify(userInfo.value));
    }
  }

  async function updateProfileAction(payload: UserProfileUpdateRequest): Promise<void> {
    const session = sessionVersion.value;
    const request = ++profileRequest;
    const response = await updateUserProfile(payload);
    if (session !== sessionVersion.value) return;
    if (response.code !== 200 || !response.data) {
      throw new Error(response.message || '保存失败');
    }

    if (request >= appliedProfileRequest) {
      updateLocalUserInfo(response.data);
      return;
    }

    // PUT 返回完整资料；较早的快照不能覆盖其它页面已提交的更新。
    const refresh = ++profileRequest;
    try {
      const current = await getUserProfile();
      if (session !== sessionVersion.value || refresh < appliedProfileRequest) return;
      if (current.code !== 200 || !current.data) {
        throw new Error(current.message || '资料同步失败');
      }
      updateLocalUserInfo(current.data);
    } catch (error) {
      if (session !== sessionVersion.value || refresh < appliedProfileRequest) return;
      // 持久化已成功，读回失败仅保留较新的本地资料，不引导重复提交。
      console.warn('资料已保存，但刷新资料失败:', error);
    }
  }

  // **必须**返回所有需要暴露给外部的状态、getters 和 actions
  return {
    // State
    token,
    refreshToken,
    sessionVersion,
    userInfo,
    // Getters
    isLoggedIn,
    avatar,
    nickname,
    // Actions
    loginAction,
    logoutAction,
    fetchProfileAction,
    updateProfileAction,
    updateLocalUserInfo,
    updateTokens,
  };
});
