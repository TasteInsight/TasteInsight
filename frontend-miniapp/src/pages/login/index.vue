<template>
  <view class="page-content login-page">
    <view class="login-content">
      <LoginForm ref="form" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import LoginForm from './components/LoginForm.vue';
import { useUserStore } from '@/store/modules/use-user-store';
import { returnFromLogin } from '@/utils/login-navigation';
const user = useUserStore();
const form = ref<InstanceType<typeof LoginForm> | null>(null);
onShow(() => {
  if (user.isLoggedIn && !form.value?.loading) returnFromLogin();
});
</script>
<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  padding-top: calc(40px + var(--status-bar-height, 0px));
}
.login-content {
  width: 100%;
  max-width: 400px;
}
</style>
