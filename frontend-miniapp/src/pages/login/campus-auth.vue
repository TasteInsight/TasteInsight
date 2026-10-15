<template>
  <web-view v-if="url" :src="url" /><view v-else class="campus-error">{{ message }}</view>
</template>
<script setup lang="ts">
import { ref, onScopeDispose } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { startCampusLogin } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import { saveCampusLoginPending } from '@/utils/campus-login';
const url = ref('');
const message = ref('正在打开校园登录…');
const user = useUserStore();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
onLoad(async () => {
  const session = user.sessionVersion;
  if (user.isLoggedIn) {
    message.value = '当前账号已登录，请返回应用。';
    return;
  }
  try {
    const response = await startCampusLogin();
    if (!disposed && session === user.sessionVersion && !user.isLoggedIn) {
      saveCampusLoginPending(response.data);
      url.value = response.data.authorizationUrl;
    }
  } catch {
    if (!disposed && session === user.sessionVersion)
      message.value = '登录页面暂时无法打开，请返回重试。';
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
