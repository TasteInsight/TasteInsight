<template>
  <web-view v-if="url" :src="url" /><view v-else class="campus-error">{{ message }}</view>
</template>
<script setup lang="ts">
import { t } from '@/i18n';
import { computed, ref, onScopeDispose } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { startCampusOAuth, startCampusLoginBinding } from '@/api/modules/auth';
import { useUserStore } from '@/store/modules/use-user-store';
import { saveCampusOAuthPending } from '@/utils/campus-oauth';
const url = ref('');
const messageKey = ref('account.profile.openingCampusVerification');
const message = computed(() => t(messageKey.value));
const user = useUserStore();
let disposed = false;
onScopeDispose(() => {
  disposed = true;
});
onLoad(async query => {
  const session = user.sessionVersion;
  const owner = user.userInfo?.id;
  if (!user.isLoggedIn || !owner) {
    messageKey.value = 'account.profile.signInBeforeStartingCampus';
    return;
  }
  const purpose = query?.purpose ?? 'VERIFICATION';
  if (purpose !== 'VERIFICATION' && purpose !== 'LOGIN_BIND') {
    messageKey.value = 'account.profile.invalidAuthorizationRequestGoBack';
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
      messageKey.value = 'account.profile.unableToOpenVerificationGo';
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
