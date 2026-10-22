<template>
  <web-view v-if="url" :src="url" /><view v-else class="campus-error">{{ message }}</view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref, onScopeDispose } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { startCampusLogin } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import { saveCampusLoginPending } from '@/utils/campus-login';
const url = ref('');
const messageKey = ref('account.login.openingCampusSignIn');
const message = computed(() => t(messageKey.value));
const user = useUserStore();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
onLoad(async () => {
  const session = user.sessionVersion;
  if (user.isLoggedIn) {
    messageKey.value = 'account.login.youAreSignedInReturn';
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
      messageKey.value = 'account.login.unableToOpenSignIn';
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
