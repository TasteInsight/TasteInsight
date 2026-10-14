<template>
  <web-view v-if="url" :src="url" /><view v-else class="campus-error">{{ message }}</view>
</template>
<script setup lang="ts">
import { ref, onScopeDispose } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { startCampusOAuth, startCampusLoginBinding } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import { saveCampusOAuthPending } from '@/utils/campus-oauth';
const url = ref('');
const message = ref('正在打开校园认证…');
const user = useUserStore();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
onLoad(async query => {
  const session = user.sessionVersion;
  const owner = user.userInfo?.id;
  if (!user.isLoggedIn || !owner) {
    message.value = '请先登录，再发起校园认证。';
    return;
  }
  const purpose = query?.purpose ?? 'VERIFICATION';
  if (purpose !== 'VERIFICATION' && purpose !== 'LOGIN_BIND') {
    message.value = '授权操作无效，请返回重试。';
    return;
  }
  try {
    const response = await (purpose === 'LOGIN_BIND'
      ? startCampusLoginBinding()
      : startCampusOAuth());
    if (!disposed && session === user.sessionVersion && owner === user.userInfo?.id) {
      saveCampusOAuthPending(owner, response.data);
      url.value = response.data.authorizationUrl;
    }
  } catch {
    if (!disposed && session === user.sessionVersion)
      message.value = '认证页面暂时无法打开，请返回重试。';
  }
});
</script>
<style scoped>
.campus-error {
  padding: 32px 20px;
  font-size: 15px;
  line-height: 1.6;
  color: #667085;
}
</style>
